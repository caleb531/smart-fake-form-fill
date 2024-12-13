import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import {
	DEFAULT_AI_MODEL,
	OPENAI_REQUEST_MAX_RETRIES,
	OPENAI_REQUEST_TIMEOUT
} from './scripts/config';
import type {
	FieldDefinition,
	FieldPopulatorRequest,
	FieldValueGetterResponse,
	FieldValues,
	Status,
	StatusUpdateRequest
} from './scripts/types';

// Store the current status of the form fill job so we can retrieve the job
// status at any time
let currentStatus: Status | null = null;

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

// Send the latest status to the tab which started the form fill job, and also
// persist the status to the extension's local storage so that it can be
// accessed from the popup; allow for an optional error message to be supplied
async function updateStatus({ tabId, status }: { tabId: number; status: Status }) {
	currentStatus = status;
	const message: StatusUpdateRequest = {
		action: 'updateStatus',
		status
	};
	await chrome.tabs.sendMessage(tabId, message);
	try {
		await chrome.runtime.sendMessage(message);
		/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
	} catch (error) {
		// If the popup isn't open when we attempt to send the message, then an
		// connection error ("Could not establish connection. Receiving end does not
		// exist.") will be thrown; we want to ignore this error, but still allow it
		// and other errors to be viewable under a higher "verbose" log level
		console.debug(error);
	}
}

function getStatus({
	sendResponse
}: {
	sendResponse: (response: { status: Status | null }) => void;
}) {
	sendResponse({ status: currentStatus });
}

// Fetch the relevant form values
async function fetchAndPopulateFormValues({
	tabId,
	fieldDefinitions,
	sendResponse
}: {
	tabId: number | undefined;
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
		if (custom_instructions) {
			console.log('custom instructions:', custom_instructions);
		}
		console.log('field definitions:', fieldDefinitions);
		if (!tabId) {
			throw new Error('No active tab');
		}
		await updateStatus({ tabId, status: { code: 'PROCESSING' } });
		const completionStream = await openai.chat.completions.create(
			{
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
									content: custom_instructions || ''
								} as const
							]
						: []),
					{
						role: 'user',
						content: `\`\`\`\n${JSON.stringify(fieldDefinitions)}\n\`\`\``
					}
				]
			},
			{
				// Time out and throw an error after a certain amount of time has passed
				// without a response from OpenAI (multiplied by a maximum number of
				// attempts)
				maxRetries: OPENAI_REQUEST_MAX_RETRIES,
				timeout: OPENAI_REQUEST_TIMEOUT
			}
		);
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
				chrome.tabs.sendMessage(tabId, {
					action: 'populateFieldsIntoForm',
					fieldValues
				} as FieldPopulatorRequest);
			}
		}
		sendResponse({ status: { code: 'SUCCESS' } });
		await updateStatus({ tabId, status: { code: 'SUCCESS' } });
	} catch (error) {
		console.error(error);
		if (error instanceof Error && tabId) {
			await updateStatus({ tabId, status: { code: 'ERROR', message: error.message } });
			sendResponse({ status: { code: 'ERROR', message: error.message } });
		}
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	switch (message.action) {
		case 'getFieldValues':
			// According to MDN, "Promise as a return value is not supported in Chrome
			// until Chrome bug 1185241 is resolved. As an alternative, return true
			// and use sendResponse." (see
			// <https://bugs.chromium.org/p/chromium/issues/detail?id=1185241>)
			fetchAndPopulateFormValues({
				tabId: message.tabId,
				fieldDefinitions: message.fieldDefinitions,
				sendResponse
			});
			return true;
		case 'getStatus':
			getStatus({ sendResponse });
			return true;
		default:
			// See <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#addlistener_syntax>
			return false;
	}
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
		chrome.tabs.sendMessage(tab.id, { action: 'fillForm', tabId: tab.id });
	}
});
