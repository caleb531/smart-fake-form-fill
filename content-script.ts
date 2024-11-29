import type {
	FieldDefinition,
	FieldDefinitionGetterRequest,
	FieldPopulatorRequest,
	FieldValues
} from './scripts/types';

let lastSelectedForm: HTMLFormElement | null = null;

function getForm(formSelector: string): HTMLFormElement {
	const selectorParts = formSelector.split('::shadow-root');
	let currentElement: Element | null = document.body;
	selectorParts.forEach((selectorPart) => {
		currentElement = currentElement?.querySelector(`& ${selectorPart}`) ?? null;
		if (currentElement?.shadowRoot) {
			currentElement = currentElement?.shadowRoot?.firstElementChild;
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
function getFieldDefinitions(form: HTMLFormElement): FieldDefinition[] {
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

async function populateFieldsIntoForm({
	form,
	fieldValues
}: {
	form: HTMLFormElement;
	fieldValues: FieldValues;
}): Promise<void> {
	console.log('about to populate fields; fieldValues:', fieldValues);
	// First store an object literal of the fieldsets within this form, where the
	// key is the fieldset name and the value is DOM element for that fieldset
	const fieldsetsByName: Record<string, HTMLFieldSetElement> = Object.fromEntries(
		Array.from(form.querySelectorAll('fieldset')).map((fieldset) => {
			return [fieldset.name, fieldset];
		})
	);
	console.log('fieldsetsByName', fieldsetsByName);
	// Object.entries(fieldValues).forEach(([fieldName, fieldValue]) => {});
}

chrome.runtime.onMessage.addListener(
	(message: FieldDefinitionGetterRequest | FieldPopulatorRequest, sender, sendResponse) => {
		try {
			if (message.action === 'getFieldDefinitions') {
				const { formSelector } = message as FieldDefinitionGetterRequest;
				lastSelectedForm = getForm(formSelector);
				const fieldDefinitions = getFieldDefinitions(lastSelectedForm);
				sendResponse({ fieldDefinitions });
			} else if (message.action === 'populateFieldsIntoForm') {
				const { fieldValues } = message as FieldPopulatorRequest;
				console.log('fieldValues', fieldValues);
				if (!lastSelectedForm) {
					console.log('No form selected; aborting.');
					return;
				}
				populateFieldsIntoForm({ form: lastSelectedForm, fieldValues });
				sendResponse({ success: true });
			}
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				sendResponse({ errorMessage: error.message });
			}
		}
	}
);
