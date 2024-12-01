import type {
	FieldDefinition,
	FieldDefinitionGetterRequest,
	FieldDefinitionGetterResponse,
	FieldPopulatorRequest,
	FieldPopulatorResponse,
	FieldValues,
	PicklistFieldDefinition,
	TextFieldDefinition
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

// Get all top-level elements representing form fields, whether an input,
// textarea, or fieldset; per this definition, inputs within fieldsets are
// excluded
function getTopLevelFieldElements(form: HTMLFormElement) {
	return Array.from(
		form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLFieldSetElement>(
			'[name]:not([readonly]):not([disabled]):not(fieldset [name]), fieldset'
		)
	);
}

// The an array of field definitions to send to the OpenAI API
function getFieldDefinitions(form: HTMLFormElement): FieldDefinition[] {
	return (
		getTopLevelFieldElements(form)
			.map((element) => {
				if (element instanceof HTMLFieldSetElement) {
					const valueInputs = Array.from(element.querySelectorAll<HTMLInputElement>('input[name]'));
					return {
						name: element.name,
						label: String(element.querySelector('legend')?.textContent),
						isMultiSelect: valueInputs[0]?.type === 'checkbox' && valueInputs.length > 1,
						values:
							valueInputs
								.map((input) => {
									return form.querySelector(`label[for="${input.id}"]`)?.textContent;
								})
								.filter((label) => label) ?? []
					} as PicklistFieldDefinition;
				} else {
					return {
						name: element.name,
						...('pattern' in element && element.pattern ? { pattern: element.pattern } : undefined),
						label: String(form.querySelector(`label[for="${element.id}"]`)?.textContent)
					} as TextFieldDefinition;
				}
			})
			// Filter out blank labels
			.filter((field) => field.label)
	);
}

// Populate the given input with the given value
export function populateInput(input: Element | null, value: string | number | boolean) {
	if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
		if (
			input instanceof HTMLInputElement &&
			(input.type === 'checkbox' || input.type === 'radio')
		) {
			input.checked = Boolean(value);
		} else {
			input.value = String(value);
		}
		input.dispatchEvent(new Event('input', { bubbles: true }));
		input.dispatchEvent(new Event('change', { bubbles: true }));
	} else {
		throw new Error('Could not find input');
	}
}

async function populateFieldsIntoForm({
	form,
	fieldValues
}: {
	form: HTMLFormElement;
	fieldValues: FieldValues;
}): Promise<void> {
	const topLevelFieldElements = getTopLevelFieldElements(form);
	topLevelFieldElements.forEach((element) => {
		const selectedValues = fieldValues[element.name];
		if (element instanceof HTMLFieldSetElement) {
			element.querySelectorAll<HTMLInputElement>('input[name]').forEach((input) => {
				const label = input.labels?.[0]?.textContent;
				if (!label) {
					return;
				}
				const trimmedLabel = label.trim();
				if (
					selectedValues === trimmedLabel ||
					(Array.isArray(selectedValues) && selectedValues.includes(trimmedLabel))
				) {
					populateInput(input, true);
				}
			});
		} else if (!Array.isArray(selectedValues) && selectedValues) {
			populateInput(element, selectedValues);
		}
	});
}

chrome.runtime.onMessage.addListener(
	(message: FieldDefinitionGetterRequest | FieldPopulatorRequest, sender, sendResponse) => {
		try {
			if (message.action === 'getFieldDefinitions') {
				const { formSelector } = message as FieldDefinitionGetterRequest;
				lastSelectedForm = getForm(formSelector);
				const fieldDefinitions = getFieldDefinitions(lastSelectedForm);
				sendResponse({ status: 'success', fieldDefinitions } as FieldDefinitionGetterResponse);
			} else if (message.action === 'populateFieldsIntoForm') {
				const { fieldValues } = message as FieldPopulatorRequest;
				if (!lastSelectedForm) {
					console.log('No form selected; aborting.');
					return;
				}
				console.log('Populating fields:', fieldValues);
				populateFieldsIntoForm({ form: lastSelectedForm, fieldValues });
				sendResponse({ status: 'success' } as FieldPopulatorResponse);
			}
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				sendResponse({ errorMessage: error.message });
			}
		}
	}
);
