<script lang="ts">
	import type {
		FieldDefinitionGetterRequest,
		FieldDefinitionGetterResponse,
		FieldPopulatorRequest,
		FieldPopulatorResponse,
		FieldValueGetterRequest,
		FieldValueGetterResponse
	} from '../types';
	import LoadingIcon from './LoadingIndicator.svelte';

	let formSelector = $state('#app-embed::shadow-root form');
	let formError: string | null = $state(null);
	let processingMessage: string | null = $state(null);

	async function fillForm(event: SubmitEvent) {
		event.preventDefault();
		try {
			processingMessage = 'Collecting form field details…';
			const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!activeTab?.id) {
				console.log('no active tab');
				return;
			}
			// First, collect the field definitions for the form matching the given
			// selector, throwing an error if the form cannot be found
			const fieldDefGetterRequest: FieldDefinitionGetterRequest = {
				action: 'getFieldDefinitions',
				formSelector
			};
			const fieldDefGetterResponse: FieldDefinitionGetterResponse = await chrome.tabs.sendMessage(
				activeTab.id,
				fieldDefGetterRequest
			);
			if (fieldDefGetterResponse.errorMessage) {
				throw new Error(fieldDefGetterResponse.errorMessage);
			}
			const { fieldDefinitions } = fieldDefGetterResponse;
			// Once we have the field definitions, send them to OpenAI to generate
			// fake values for the respective fields
			processingMessage = 'Generating smart fake values with AI…';
			const fieldValueGetterRequest: FieldValueGetterRequest = {
				action: 'getFieldValues',
				fieldDefinitions
			};
			const fieldValueGetterResponse: FieldValueGetterResponse =
				await chrome.runtime.sendMessage(fieldValueGetterRequest);
			if (fieldValueGetterResponse.errorMessage) {
				throw new Error(fieldValueGetterResponse.errorMessage);
			}
			// Finally, populate the form fields with the generated fake values from
			// the LLM
			processingMessage = 'Populating fake values into form fields…';
			const fieldPopulatorRequest: FieldPopulatorRequest = {
				action: 'populateFieldsIntoForm',
				fieldValues: fieldValueGetterResponse.fieldValues
			};
			const fieldPopulatorResponse: FieldPopulatorResponse = await chrome.tabs.sendMessage(
				activeTab.id,
				fieldPopulatorRequest
			);
			if (fieldPopulatorResponse.errorMessage) {
				throw new Error(fieldPopulatorResponse.errorMessage);
			}
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				formError = error.message || 'An unknown error occurred';
			}
		} finally {
			processingMessage = null;
		}
	}
</script>

<svelte:head>
	<title>Smart Fake Form Fill</title>
</svelte:head>

<h1>Smart Fake Form Fill</h1>

<form onsubmit={fillForm}>
	<div class="form-field">
		<label for="formSelector">Form Selector</label>
		<input id="formSelector" name="formSelector" type="text" bind:value={formSelector} />
		{#if formError}
			<p class="form-error">{formError}</p>
		{/if}
	</div>
	<div class="form-footer">
		{#if processingMessage !== null}
			<LoadingIcon label={processingMessage} />
		{:else}
			<button>Fill Form</button>
		{/if}
	</div>
</form>
