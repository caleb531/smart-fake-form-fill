import OpenAI from 'openai';
import systemPrompt from './prompts/system.txt?raw';
import type {
	FieldDefinition,
	FieldValueGetterRequest,
	FieldValueGetterResponse,
	FieldValues
} from './scripts/types';

interface CompletionMessage {
	fieldDefinitions: FieldDefinition[];
}

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
		const chunkParts: string[] = [];
		for await (const chunk of completionStream) {
			chunkParts.push(chunk.choices[0]?.delta.content || '');
			const fieldValues = getFieldValuesFromCurrentChunk(chunkParts.join(''));
			// console.log('received chunk from OpenAI API:', chunk);
			if (fieldValues) {
				port.postMessage({
					action: 'populateFieldsIntoForm',
					status: 'partial',
					fieldValues
				} as FieldValueGetterResponse);
			}
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
