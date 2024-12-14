import { mount } from 'svelte';
import ContentScriptUI from './scripts/components/ContentScriptUI.svelte';
import type {
	FieldPopulatorRequest,
	FieldPopulatorResponse,
	FieldValueGetterRequest,
	FieldValueGetterResponse,
	FieldValues,
	FormFillerRequest,
	FormFillerResponse
} from './scripts/types';
import contentScriptUICSS from './styles/content-script-ui.scss?inline';

// The ID of the element that contains the extension UI
const EXTENSION_ROOT_CONTAINER_ID = 'sfff-root';

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

// Return a simplified HTML string representation of the given form element,
// with all attributes omitted except the relevant ones
function getFormHTML(form: HTMLFormElement): string {
	const allowedAttributes = ['name', 'type', 'pattern'];
	function traverse(node: Node): string[] {
		const parts: string[] = [];

		if (node instanceof Element) {
			// Start tag with tag name
			parts.push(`<${node.tagName.toLowerCase()}`);

			// Include allowed attributes if present
			if (
				node instanceof HTMLInputElement ||
				node instanceof HTMLSelectElement ||
				node instanceof HTMLTextAreaElement
			) {
				allowedAttributes.forEach((attr) => {
					const attrValue = node.getAttribute(attr);
					if (attrValue) {
						parts.push(` ${attr}=${attrValue}`);
					}
				});
			}

			// Check if the element has no child nodes
			if (node.childNodes.length === 0) {
				parts.push(` />`); // Self-closing tag
			} else {
				parts.push(`>`); // Close start tag

				// Recursively process child nodes
				node.childNodes.forEach((child) => {
					parts.push(...traverse(child));
				});

				// End tag
				parts.push(`</${node.tagName.toLowerCase()}>`);
			}
		} else if (node instanceof Text) {
			// Text node
			parts.push(node.textContent || '');
		}

		return parts;
	}

	// Join the parts into a single string when returning
	return traverse(form).join('');
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
		console.error('Could not find input for value:', value);
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
	tabId,
	formSelector
}: {
	tabId: number | undefined;
	formSelector: string | undefined;
}): Promise<FormFillerResponse> {
	lastSelectedForm = formSelector
		? getFormFromSelector(formSelector)
		: getFormFromLastClickedElement();
	if (!lastSelectedForm) {
		throw new Error('Cannot find form element; aborting.');
	}
	const formHTML = getFormHTML(lastSelectedForm);
	// Once we have the field definitions, send them to OpenAI to generate
	// fake values for the respective fields
	const fieldValueGetterRequest: FieldValueGetterRequest = {
		action: 'getFieldValues',
		tabId,
		formHTML
	};
	const fieldValueGetterResponse: FieldValueGetterResponse =
		await chrome.runtime.sendMessage(fieldValueGetterRequest);
	if (fieldValueGetterResponse.errorMessage) {
		throw new Error(fieldValueGetterResponse.errorMessage);
	}
	return fieldValueGetterResponse;
}

// Write handleMessage()
async function handleMessage({
	message,
	sendResponse
}: {
	message: FormFillerRequest | FieldPopulatorRequest;
	sendResponse: (response: FormFillerResponse | FieldPopulatorResponse) => void;
}) {
	try {
		switch (message.action) {
			case 'fillForm': {
				const { formSelector } = message as FormFillerRequest;
				appendUIToPage();
				sendResponse(await fillForm({ formSelector, tabId: message.tabId }));
				break;
			}
			case 'populateFieldsIntoForm': {
				const { fieldValues } = message as FieldPopulatorRequest;
				if (!lastSelectedForm) {
					console.log('No form selected; aborting.');
					break;
				}
				console.log('Populating fields:', fieldValues);
				populateFieldsIntoForm({ form: lastSelectedForm, fieldValues });
				sendResponse({ status: { code: 'SUCCESS' } } as FieldPopulatorResponse);
				break;
			}
		}
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			sendResponse({ status: { code: 'ERROR', message: error.message } });
		}
	}
}

chrome.runtime.onMessage.addListener(
	(message: FormFillerRequest | FieldPopulatorRequest, sender, sendResponse) => {
		// Only return true (meaning that the browser will expect us to call
		// sendResponse at some point) if and only if the action is one of the
		// handled actions for this event listener
		if (['fillForm', 'populateFieldsIntoForm'].includes(message.action)) {
			handleMessage({ message, sendResponse });
			return true;
		}
	}
);

// Append the extension UI to the current page
async function appendUIToPage() {
	// Do not append the extension UI if it already exists on the page
	if (document.getElementById(EXTENSION_ROOT_CONTAINER_ID)) {
		return;
	}
	// Create a shadow DOM container to hold the extension UI
	const shadowContainer = document.createElement('div');
	shadowContainer.id = EXTENSION_ROOT_CONTAINER_ID;
	shadowContainer.style.display = 'block';
	shadowContainer.attachShadow({ mode: 'open' });
	document.body.appendChild(shadowContainer);
	if (shadowContainer.shadowRoot) {
		// Normally, importing a *.css or *.scss file in a Svelte component
		// appends the stylesheet to the document head, even if the component is
		// mounted within a shadow DOM; to solve this, we create a <style>
		// element within the shadow DOM and insert the processed CSS contents
		// into it
		const style = document.createElement('style');
		style.textContent = contentScriptUICSS;
		shadowContainer.shadowRoot.appendChild(style);
		const shadowContainerMain = document.createElement('main');
		shadowContainer.shadowRoot.appendChild(shadowContainerMain);
		mount(ContentScriptUI, { target: shadowContainerMain });
	}
}
