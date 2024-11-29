import type { FieldDefinition } from './scripts/types';

function getForm(formSelector: string): HTMLFormElement {
	const selectorParts = formSelector.split('::shadow-root');
	let currentElement: Element | null = document.body;
	selectorParts.forEach((selectorPart) => {
		console.log('currentElement before', currentElement);
		currentElement = currentElement?.querySelector(`& ${selectorPart}`) ?? null;
		console.log(`currentElement after "& ${selectorPart}":`, currentElement);
		if (currentElement?.shadowRoot) {
			currentElement = currentElement?.shadowRoot?.firstElementChild;
			console.log('after shadow!!!', currentElement);
		}
	});
	if (!currentElement) {
		throw new Error('No element found with the provided selector');
	}
	if (!(currentElement instanceof HTMLFormElement)) {
		throw new Error('Selected element is not a form element');
	}
	return currentElement;
}

// The an array of field definitions to send to the OpenAI API
function getfieldDefinitions(form: HTMLFormElement): FieldDefinition[] {
	return (
		Array.from(
			form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLFieldSetElement>(
				'[name]:not(fieldset [name]), fieldset'
			)
		)
			.map((element) => {
				if (element instanceof HTMLFieldSetElement) {
					return {
						name: element.name,
						label: String(element.querySelector('legend')?.textContent),
						values:
							Array.from(element.querySelectorAll<HTMLInputElement>('input[name]'))
								.map((input) => {
									return form.querySelector(`label[for="${input.id}"]`)?.textContent;
								})
								.filter((label) => label) ?? []
					};
				} else {
					return {
						name: element.name,
						...('pattern' in element && element.pattern ? { pattern: element.pattern } : undefined),
						label: String(form.querySelector(`label[for="${element.id}"]`)?.textContent)
					};
				}
			})
			// Filter out blank labels
			.filter((field) => field.label)
	);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	try {
		if (message.action === 'getfieldDefinitions') {
			const form = getForm(message.formSelector);
			const fieldDefinitions = getfieldDefinitions(form);
			console.log('form', form);
			console.log('fieldDefinitions', fieldDefinitions);
			sendResponse({ fieldDefinitions });
		}
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			sendResponse({ errorMessage: error.message });
		}
	}
});
