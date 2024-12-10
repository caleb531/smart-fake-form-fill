import type {
	FieldDefinition,
	FieldDefinitionGetterRequest,
	FieldPopulatorRequest,
	FieldPopulatorResponse,
	FieldValueGetterRequest,
	FieldValueGetterResponse,
	FieldValues,
	FormFillerRequest,
	FormFillerResponse,
	PicklistFieldDefinition,
	TextFieldDefinition
} from './scripts/types';

// The messages to display in the UI
export const MESSAGES = {
	PROCESSING: 'Generating smart fake values with AI…'
} as const;

let lastSelectedForm: HTMLFormElement | null = null;
let lastRightClickedElement: Element | null = null;

// Get the form DOM element from the given CSS selector
function getFormFromSelector(formSelector: string): HTMLFormElement {
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

// Get the form element ancestor of the last-clicked element
function getFormFromLastClickedElement() {
	return lastRightClickedElement?.closest('form') ?? null;
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
						type: element.type && element.type !== 'text' ? element.type : undefined,
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

// Keep track of which element we last right-clicked so we determine which form
// to fill if the user selects the extension menu item from the context menu
document.addEventListener('contextmenu', (event) => {
	// The elment we click may be inside a shadow DOM tree, so we need to
	// recursively descend through each shadow boundary until we arrive at the
	// actual clicked element (with a cutoff to prevent infinite loops)
	let attempts = 0;
	const MAX_ATTEMPTS = 10;
	do {
		lastRightClickedElement = event.target as HTMLElement;
		const shadowRoot = lastRightClickedElement.shadowRoot;
		if (shadowRoot) {
			lastRightClickedElement = shadowRoot.elementFromPoint(event.clientX, event.clientY);
			attempts += 1;
		}
	} while (lastRightClickedElement?.shadowRoot && attempts < MAX_ATTEMPTS);
});

// The orchestration logic for the form-filling functionality
async function fillForm({
	formSelector
}: {
	formSelector: string | undefined;
}): Promise<FormFillerResponse> {
	lastSelectedForm = formSelector
		? getFormFromSelector(formSelector)
		: getFormFromLastClickedElement();
	if (!lastSelectedForm) {
		throw new Error('Cannot find form element; aborting.');
	}
	await chrome.storage.local.set({ processingMessage: MESSAGES.PROCESSING });
	const fieldDefinitions = getFieldDefinitions(lastSelectedForm);
	// Once we have the field definitions, send them to OpenAI to generate
	// fake values for the respective fields
	const fieldValueGetterRequest: FieldValueGetterRequest = {
		action: 'getFieldValues',
		fieldDefinitions
	};
	const fieldValueGetterResponse: FieldValueGetterResponse =
		await chrome.runtime.sendMessage(fieldValueGetterRequest);
	if (fieldValueGetterResponse.errorMessage) {
		throw new Error(fieldValueGetterResponse.errorMessage);
	}
	return fieldValueGetterResponse;
}

chrome.runtime.onMessage.addListener(
	(
		message: FormFillerRequest | FieldDefinitionGetterRequest | FieldPopulatorRequest,
		sender,
		sendResponse
	) => {
		try {
			if (message.action === 'fillForm') {
				const { formSelector } = message as FormFillerRequest;
				sendResponse(fillForm({ formSelector }));
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
		} finally {
			chrome.storage.local.set({ processingMessage: null });
		}
	}
);
