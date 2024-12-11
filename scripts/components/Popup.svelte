<script lang="ts">
	import type { FormFillerRequest, FormFillerResponse } from '../types';
	import LoadingIcon from './LoadingIndicator.svelte';
	import OptionsIcon from './OptionsIcon.svelte';

	let formSelector = $state('#app-embed::shadow-root form');
	let formError: string | null = $state(null);
	let processingMessage: string | null = $state(null);
	let justFinishedFillingForm = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	async function fillForm(event: SubmitEvent) {
		event.preventDefault();
		try {
			formError = null;
			const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!activeTab?.id) {
				throw new Error('No active tab');
			}
			// First, collect the field definitions for the form matching the given
			// selector, throwing an error if the form cannot be found
			const formFillerRequest: FormFillerRequest = {
				action: 'fillForm',
				tabId: activeTab.id,
				formSelector
			};
			const formFillerResponse: FormFillerResponse = await chrome.tabs.sendMessage(
				activeTab.id,
				formFillerRequest
			);
			if (formFillerResponse.errorMessage) {
				throw new Error(formFillerResponse.errorMessage);
			}
			justFinishedFillingForm = true;
			setTimeout(() => {
				justFinishedFillingForm = false;
			}, successDelay);
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				formError = error.message || 'An unknown error occurred';
				processingMessage = null;
			}
		}
	}

	$effect(() => {
		(async () => {
			const local = await chrome.storage.local.get('processingMessage');
			if (local.processingMessage) {
				processingMessage = local.processingMessage;
			}
			// Hide processing state when the process is done, even if popup has been
			// closed/reopened since job was started
			chrome.storage.onChanged.addListener((changes) => {
				if (changes.processingMessage) {
					processingMessage = changes.processingMessage.newValue;
				}
			});
		})();
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
		{:else}
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
		{/if}
	</div>
	{#if processingMessage === null && !justFinishedFillingForm}
		<p class="hint">You can also right-click on a form to fill.</p>
	{/if}
</form>
