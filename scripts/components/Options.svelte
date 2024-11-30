<script lang="ts">
	import LoadingIndicator from './LoadingIndicator.svelte';

	let isLoading = $state(true);
	let isApiKeySet = $state(false);
	let justChangedApiKey = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	let successDelay = 2000;

	async function submitForm(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const apiKey = form.apiKey.value;
		await chrome.storage.local.set({ apiKey });
		justChangedApiKey = true;
		setTimeout(() => {
			justChangedApiKey = false;
		}, successDelay);
	}

	$effect(() => {
		(async () => {
			try {
				const { apiKey } = await chrome.storage.local.get('apiKey');
				isApiKeySet = Boolean(apiKey);
				isLoading = false;
			} finally {
				isLoading = false;
			}
		})();
	});
</script>

<svelte:head>
	<title>Options | Smart Fake Form Fill</title>
</svelte:head>

<h1>Options | Smart Fake Form Fill</h1>

{#await isLoading}
	<LoadingIndicator />
{:then}
	{#if isApiKeySet}
		<p>OpenAI API key is already set, but you can change it below if needed:</p>
	{:else}
		<p>Please set an API key to use this extension:</p>
	{/if}
	<form onsubmit={submitForm}>
		<label for="apiKey">OpenAI API Key</label>
		<input type="password" name="apiKey" id="apiKey" required />
		<button disabled={justChangedApiKey}>
			{#if justChangedApiKey}
				Saved!
			{:else if isApiKeySet}
				Change API Key
			{:else}
				Set API Key
			{/if}
		</button>
	</form>
{/await}
