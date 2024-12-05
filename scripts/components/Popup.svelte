<script lang="ts">
	import { onMount } from 'svelte';
	import { FIELD_VALUE_GETTER_PORT_NAME } from '../config';
	import type {
		FieldDefinitionGetterRequest,
		FieldDefinitionGetterResponse,
		FieldValueGetterRequest,
		FieldValueGetterResponse
	} from '../types';
	import LoadingIcon from './LoadingIndicator.svelte';
	import OptionsIcon from './OptionsIcon.svelte';

	const MESSAGES = {
		COLLECTING_DETAILS: 'Collecting form field details…',
		GENERATING_VALUES: 'Generating smart fake values with AI…'
	};

	let formSelector = $state('#app-embed::shadow-root form');
	let formError: string | null = $state(null);
	let processingMessage: string | null = $state(null);
	let justFinishedFillingForm = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	async function fillForm(event: SubmitEvent) {
		event.preventDefault();
		const port = chrome.runtime.connect({ name: FIELD_VALUE_GETTER_PORT_NAME });
		try {
			formError = null;
			processingMessage = MESSAGES.COLLECTING_DETAILS;
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
			processingMessage = MESSAGES.GENERATING_VALUES;
			const fieldValueGetterRequest: FieldValueGetterRequest = {
				action: 'getFieldValues',
				fieldDefinitions
			};
			port.postMessage(fieldValueGetterRequest);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				formError = error.message || 'An unknown error occurred';
			}
			processingMessage = null;
		}
	}

	// Show processing state if popup was closed and reopened while service worker
	// is still generating jobs
	$effect(() => {
		(async () => {
			const local = await chrome.storage.local.get(['isProcessing']);
			if (local.isProcessing) {
				processingMessage = MESSAGES.GENERATING_VALUES;
			}
		})();
	});

	// Show success state when service worker has finished generating fake form
	// values
	onMount(() => {
		console.log('on mount!');
		chrome.runtime.onConnect.addListener((port) => {
			console.log('port name', port.name);
			if (port.name !== FIELD_VALUE_GETTER_PORT_NAME) {
				return;
			}
			port.onMessage.addListener((message: FieldValueGetterResponse) => {
				console.log('receive port message on popup side:', message);
				if (message.status === 'success') {
					console.log('receive success');
					justFinishedFillingForm = true;
					processingMessage = null;
					setTimeout(() => {
						justFinishedFillingForm = false;
					}, successDelay);
				} else if (message.status === 'error') {
					console.log('receive error', message);
					formError = message.errorMessage || 'An unknown error occurred';
					processingMessage = null;
				}
			});
		});
	});
</script>

<svelte:head>
	<title>Smart Fake Form Fill</title>
</svelte:head>

<a class="options-link" href="options.html" target="_blank" rel="noreferrer" title="Options"
	><OptionsIcon /></a
>

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
		{/if}
		<button
			type="submit"
			data-processing={processingMessage !== null}
			disabled={justFinishedFillingForm || processingMessage !== null}
		>
			{#if justFinishedFillingForm}
				Done!
			{:else}
				Fill Form
			{/if}
		</button>
	</div>
</form>
