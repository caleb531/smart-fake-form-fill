import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import {
	DEFAULT_OPENAI_MODEL,
	DEFAULT_OPENAI_REQUEST_TIMEOUT,
	EXTENSION_DISPLAY_NAME,
	OPENAI_REQUEST_MAX_RETRIES
} from './scripts/config';
import type {
	FieldPopulatorRequest,
	FieldValueGetterResponse,
	FieldValues,
	OpenAiModelListResponse,
	Status,
	StatusUpdateRequest
} from './scripts/types';

// The ID of the context menu item used to trigger the extension
const CONTEXT_MENU_ITEM_ID = 'populateFieldsIntoForm';

// The regular expression used to filter which models are available for the
// extension
const MODEL_ID_PATTERN = /^(gpt(-\d[a-z0-9.]*)|o\d+)(-[a-z]+)?$/;

// Store the current status of the form fill job so we can retrieve the job
// status at any time
let currentStatus: Status | null = null;
// Store the AbortController instance so we can cancel the form fill job upon
// request
let abortController: AbortController | null = null;
// Store a flag to indicate when the current job has been aborted
let aborted = false;

function getFieldValuesFromCurrentChunk(partialJSONString: string): FieldValues | null {
	try {
		const fieldValues = JSON.parse(
			partialJSONString
				// Remove Markdown code fence wrappers around JSON string
				.replace(/^```(json)?\n/, '')
				.replace(/\s*```$/, '')
				// Remove leading comma after first opening brace
				.replace(/\{\s*,/, '{')
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
	// Update the context menu item to reflect the current status (specifically,
	// the context menu item should be disabled while the form fill job is in
	// progress)
	const isContextMenuEnabled = status?.code !== 'PROCESSING';
	chrome.contextMenus.update(CONTEXT_MENU_ITEM_ID, {
		title: isContextMenuEnabled
			? EXTENSION_DISPLAY_NAME
			: `${EXTENSION_DISPLAY_NAME} (Processing...)`,
		enabled: isContextMenuEnabled
	});
}

function getStatus({
	sendResponse
}: {
	sendResponse: (response: { status: Status | null }) => void;
}) {
	sendResponse({ status: currentStatus });
}

async function getModels({
	sendResponse
}: {
	sendResponse: (response: OpenAiModelListResponse) => void;
}) {
	try {
		const { openai_api_key } = await chrome.storage.local.get<{ openai_api_key: string }>(
			'openai_api_key'
		);
		if (!openai_api_key) {
			throw new Error('OpenAI API key missing; please define it is the extension settings');
		}
		const openai = new OpenAI({ apiKey: openai_api_key });
		const modelList = await openai.models.list();
		const allModelIds = modelList.data.map((model) => model.id);
		let filteredModelIds = allModelIds.filter((modelId) => MODEL_ID_PATTERN.test(modelId));
		if (filteredModelIds.length === 0) {
			filteredModelIds = allModelIds;
		}
		sendResponse({ status: { code: 'SUCCESS' }, models: filteredModelIds });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to load model list';
		sendResponse({ status: { code: 'ERROR', message } });
	}
}

// Fetch the relevant form values
async function fetchAndPopulateFormValues({
	tabId,
	formHTML,
	sendResponse
}: {
	tabId: number | undefined;
	formHTML: string;
	sendResponse: (response?: FieldValueGetterResponse) => void;
}) {
	try {
		const { openai_api_key } = await chrome.storage.local.get<{ openai_api_key: string }>(
			'openai_api_key'
		);
		const { custom_instructions } = await chrome.storage.sync.get<{ custom_instructions: string }>(
			'custom_instructions'
		);
		const openai_request_timeout_seconds = Number(
			(
				await chrome.storage.sync.get<{ openai_request_timeout_seconds: number }>([
					'openai_request_timeout_seconds'
				])
			)?.openai_request_timeout_seconds ?? DEFAULT_OPENAI_REQUEST_TIMEOUT
		);
		if (!openai_api_key) {
			throw new Error('OpenAI API key missing; please define it is the extension settings');
		}
		const model =
			(await chrome.storage.sync.get<{ openai_model: string }>('openai_model'))?.openai_model ||
			DEFAULT_OPENAI_MODEL;
		const openai = new OpenAI({ apiKey: openai_api_key });
		console.log('model:', model);
		console.log('system prompt:', systemPrompt);
		if (custom_instructions) {
			console.log('custom instructions:', custom_instructions);
		}
		console.log('form HTML:', formHTML);
		if (!tabId) {
			throw new Error('No active tab');
		}
		await updateStatus({ tabId, status: { code: 'PROCESSING' } });

		abortController = new AbortController();

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
						content: `\`\`\`\n${JSON.stringify(formHTML)}\n\`\`\``
					}
				]
			},
			{
				// Time out and throw an error after a certain amount of time has passed
				// without a response from OpenAI (multiplied by a maximum number of
				// attempts)
				maxRetries: OPENAI_REQUEST_MAX_RETRIES,
				timeout: openai_request_timeout_seconds * 1000,
				signal: abortController.signal
			}
		);
		const chunkParts: string[] = [];
		const allChunkParts: string[] = [];
		for await (const chunk of completionStream) {
			allChunkParts.push(chunk.choices[0]?.delta.content || '');
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
		if (aborted) {
			throw new Error('Form fill canceled by user');
		}
		sendResponse({ status: { code: 'SUCCESS' } });
		await updateStatus({ tabId, status: { code: 'SUCCESS' } });
		console.log('sent status success!');
	} catch (error) {
		console.error(error);
		if (tabId && error instanceof Error) {
			const code = aborted || error.name === 'AbortError' ? 'CANCELED' : 'ERROR';
			await updateStatus({ tabId, status: { code, message: error.message } });
			sendResponse({ status: { code, message: error.message } });
		}
	} finally {
		abortController = null;
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
				formHTML: message.formHTML,
				sendResponse
			});
			return true;
		case 'getStatus':
			getStatus({ sendResponse });
			return true;
		case 'getModels':
			getModels({ sendResponse });
			return true;
		case 'cancelRequest':
			aborted = true;
			abortController?.abort();
			sendResponse({ status: { code: 'CANCELED' } });
			return true;
		default:
			// See <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#addlistener_syntax>
			return false;
	}
});

chrome.runtime.onInstalled.addListener((object) => {
	// Add context menu item for selecting/populating form via right-click
	chrome.contextMenus.create({
		id: CONTEXT_MENU_ITEM_ID,
		title: EXTENSION_DISPLAY_NAME,
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
	if (info.menuItemId === CONTEXT_MENU_ITEM_ID && tab?.id) {
		chrome.tabs.sendMessage(tab.id, { action: 'fillForm', tabId: tab.id });
	}
});
