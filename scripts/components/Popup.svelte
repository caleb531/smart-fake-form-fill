<script lang="ts">
	import type { FieldDefinition } from '../types';
	let formSelector = $state('#app-embed::shadow-root form');
	let formError: string | null = $state(null);

	async function fillForm(event: SubmitEvent) {
		event.preventDefault();
		try {
			console.log(`Fill the form at: ${formSelector}`);
			const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
			console.log('activeTab', activeTab);
			if (!activeTab?.id) {
				console.log('no active tab');
				return;
			}
			const response: { fieldDefinitions: FieldDefinition[]; errorMessage?: string } =
				await chrome.tabs.sendMessage(activeTab.id, {
					action: 'getfieldDefinitions',
					formSelector
				});
			if (response.errorMessage) {
				console.log('the error message:', response.errorMessage);
				throw new Error(response.errorMessage);
			}
			const { fieldDefinitions } = response;
			console.log('sending field definitions to service worker:', fieldDefinitions);
			chrome.runtime.sendMessage({ action: 'getFormValues', fieldDefinitions }, (response) => {
				console.log('Response from service worker:', response);
			});
		} catch (error) {
			console.error(error);
			if (error instanceof Error) {
				formError = error.message || 'An unknown error occurred';
			}
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
	<button>Fill Form</button>
</form>
