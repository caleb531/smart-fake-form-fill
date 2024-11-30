import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import type { FieldDefinition } from './scripts/types';

interface CompletionMessage {
	fieldDefinitions: FieldDefinition[];
}

// When the JSON is returned from the OpenAI API, it is wrapped in a Markdown
// code block; we must unwrap it so we can parse it as JSON
function unwrapJSONStringFromMarkdown(markdownString: string): string {
	return markdownString.replace(/^```json\n/, '').replace(/\s*```$/, '');
}

async function getCompletions(
	message: CompletionMessage,
	sendResponse: (response?: object) => void
) {
	try {
		const { apiKey } = await chrome.storage.local.get('apiKey');
		if (!apiKey) {
			throw new Error('OpenAI API key missing; please define it is the extension settings');
		}
		const openai = new OpenAI({ apiKey });
		console.log('system prompt:', systemPrompt);
		console.log('field definitions:', message.fieldDefinitions);
		const completion = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: systemPrompt
				},
				{
					role: 'user',
					content: `\`\`\`\n${JSON.stringify(message.fieldDefinitions)}\n\`\`\``
				}
			]
		});
		const fieldValues = JSON.parse(
			unwrapJSONStringFromMarkdown(String(completion.choices[0]?.message.content))
		);
		console.log('generated field values:', fieldValues);
		sendResponse({
			success: true,
			fieldValues
		});
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			sendResponse({ success: false, errorMessage: error.message });
		}
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === 'getFieldValues') {
		// According to MDN, "Promise as a return value is not supported in Chrome
		// until Chrome bug 1185241 is resolved. As an alternative, return true and
		// use sendResponse." (see
		// <https://bugs.chromium.org/p/chromium/issues/detail?id=1185241>)
		getCompletions(message, sendResponse);
		return true;
	}
	// See <https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage#addlistener_syntax>
	return false;
});
