import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import type { FieldDefinition } from './scripts/types';

const openai = new OpenAI({ apiKey: import.meta.env.VITE_OPENAI_API_KEY });

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
		sendResponse({
			success: true,
			fieldValues: JSON.parse(
				unwrapJSONStringFromMarkdown(String(completion.choices[0]?.message.content))
			)
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
