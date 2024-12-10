import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import { DEFAULT_AI_MODEL } from './scripts/config';
import type {
	FieldDefinition,
	FieldPopulatorRequest,
	FieldValueGetterResponse,
	FieldValues
} from './scripts/types';

function getFieldValuesFromCurrentChunk(partialJSONString: string): FieldValues | null {
	try {
		const fieldValues = JSON.parse(
			partialJSONString
				// Remove Markdown code fence wrappers around JSON string
				.replace(/^```(json)?\n/, '')
				.replace(/\s*```$/, '')
				// Close out intermediate JSON object if possible
				.replace(/,\s*$/, '')
				.replace(/\}\s*$/, '') + '}'
		);
		return fieldValues;
		/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
	} catch (error) {
		// There are going to be many errors here as we are parsing the intermediate
		// JSON, and we don't want to clutter the console
		return null;
	}
}

// Fetch the relevant form values
async function fetchAndPopulateFormValues({
	fieldDefinitions,
	sendResponse
}: {
	fieldDefinitions: FieldDefinition[];
	sendResponse: (response?: FieldValueGetterResponse) => void;
}) {
	try {
		const { openai_api_key } = await chrome.storage.local.get('openai_api_key');
		const { custom_instructions } = await chrome.storage.sync.get('custom_instructions');
		if (!openai_api_key) {
			throw new Error('OpenAI API key missing; please define it is the extension settings');
		}
		const model = (await chrome.storage.sync.get('openai_model'))?.openai_model || DEFAULT_AI_MODEL;
		const openai = new OpenAI({ apiKey: openai_api_key });
		console.log('model:', model);
		console.log('system prompt:', systemPrompt);
		console.log('field definitions:', fieldDefinitions);
		const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!activeTab?.id) {
			throw new Error('No active tab');
		}
		const completionStream = await openai.chat.completions.create({
			model,
			stream: true,
			messages: [
				{
					role: 'system',
					content: systemPrompt
				},
				...(custom_instructions
					? [
							{
								role: 'system',
								content: custom_instructions?.toString() || ''
							} as const
						]
					: []),
				{
					role: 'user',
					content: `\`\`\`\n${JSON.stringify(fieldDefinitions)}\n\`\`\``
				}
			]
		});
		const chunkParts: string[] = [];
		for await (const chunk of completionStream) {
			chunkParts.push(chunk.choices[0]?.delta.content || '');
			const fieldValues = getFieldValuesFromCurrentChunk(chunkParts.join(''));
			if (fieldValues && Object.keys(fieldValues).length > 0) {
				// Don't send the same field values multiple times (this is safe to do
				// because the fact that we can parse the JSON means that we are at the
				// start of a new key-value pair boundary)
				chunkParts.length = 0;
				chunkParts.push('{');
				chrome.tabs.sendMessage(activeTab.id, {
					action: 'populateFieldsIntoForm',
					fieldValues
				} as FieldPopulatorRequest);
			}
		}
		sendResponse({ status: 'success' });
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			sendResponse({ status: 'error', errorMessage: error.message });
		}
	} finally {
		chrome.storage.local.set({ processingMessage: null });
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'getFieldValues') {
		// According to MDN, "Promise as a return value is not supported in Chrome
		// until Chrome bug 1185241 is resolved. As an alternative, return true and
		// use sendResponse." (see
		// <https://bugs.chromium.org/p/chromium/issues/detail?id=1185241>)
		fetchAndPopulateFormValues({
			fieldDefinitions: message.fieldDefinitions,
			sendResponse
		});
		return true;
	}
	// See <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#addlistener_syntax>
	return false;
});

chrome.runtime.onInstalled.addListener((object) => {
	// Add context menu item for selecting/populating form via right-click
	chrome.contextMenus.create({
		id: 'populateFieldsIntoForm',
		title: 'Smart Fake Form Fill',
		contexts: ['page', 'editable', 'selection']
	});
	// Open Options page (to enter API key) when extension is first installed
	const optionsPageUrl = chrome.runtime.getURL('options.html');
	if (object.reason === chrome.runtime.OnInstalledReason.INSTALL) {
		chrome.tabs.create({ url: optionsPageUrl });
	}
});

// When the user chooses the extension's context menu item, send a message to
// the content script to fill the form
chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === 'populateFieldsIntoForm' && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { action: 'fillForm' });
	}
});
