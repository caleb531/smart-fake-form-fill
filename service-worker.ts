import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import type {
	FieldDefinition,
	FieldValueGetterRequest,
	FieldValueGetterResponse
} from './scripts/types';

interface CompletionMessage {
	fieldDefinitions: FieldDefinition[];
}

// When the JSON is returned from the OpenAI API, it is wrapped in a Markdown
// code block; we must unwrap it so we can parse it as JSON
function unwrapJSONStringFromMarkdown(markdownString: string): string {
	return markdownString.replace(/^```json\n/, '').replace(/\s*```$/, '');
}

async function getCompletions(message: CompletionMessage, port: chrome.runtime.Port) {
	try {
		const { apiKey } = await chrome.storage.local.get('apiKey');
		if (!apiKey) {
			throw new Error('OpenAI API key missing; please define it is the extension settings');
		}
		const openai = new OpenAI({ apiKey });
		console.log('system prompt:', systemPrompt);
		console.log('field definitions:', message.fieldDefinitions);
		const completionStream = await openai.chat.completions.create({
			model: 'gpt-4o-mini',
			stream: true,
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
		for await (const chunk of completionStream) {
			// console.log('received chunk from OpenAI API:', chunk);
			port.postMessage({
				action: 'populateFieldsIntoForm',
				status: 'partial',
				chunk: chunk.choices[0]?.delta.content
			} as FieldValueGetterResponse);
		}
		port.postMessage({
			action: 'populateFieldsIntoForm',
			status: 'success',
			fieldValues: {}
		} as FieldValueGetterResponse);
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			port.postMessage({ status: 'error', errorMessage: error.message });
		}
	}
}

chrome.runtime.onConnect.addListener((port) => {
	port.onMessage.addListener((message: FieldValueGetterRequest) => {
		if (message.action === 'getFieldValues') {
			getCompletions(message, port);
		}
	});
});
