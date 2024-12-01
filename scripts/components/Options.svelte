<script lang="ts">
	import { DEFAULT_AI_MODEL } from '../config';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let isLoading = $state(true);
	let isApiKeySet = $state(false);
	let aiModel = $state(DEFAULT_AI_MODEL);
	let justChangedApiKey = $state(false);
	let justChangedAiModel = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	async function submitApiKey(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const apiKey = form.apiKey.value;
		await chrome.storage.local.set({ apiKey });
		justChangedApiKey = true;
		setTimeout(() => {
			justChangedApiKey = false;
		}, successDelay);
	}

	async function submitAiModel(event: SubmitEvent) {
		event.preventDefault();
		const form = event.target as HTMLFormElement;
		const aiModel = form.aiModel.value;
		await chrome.storage.sync.set({ aiModel });
		justChangedAiModel = true;
		setTimeout(() => {
			justChangedAiModel = false;
		}, successDelay);
	}

	$effect(() => {
		(async () => {
			try {
				const sync = await chrome.storage.sync.get(['aiModel']);
				const local = await chrome.storage.local.get(['apiKey']);
				isApiKeySet = Boolean(local.apiKey);
				aiModel = sync.aiModel || DEFAULT_AI_MODEL;
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
	<form onsubmit={submitApiKey}>
		<p>
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
		</p>
	</form>
	<form onsubmit={submitAiModel}>
		<p>
			<label for="aiModel">AI Model</label>
			<select name="aiModel" id="aiModel" bind:value={aiModel}>
				<option value="gpt-4o-mini">gpt-4o-mini</option>
				<option value="gpt-4o">gpt-4o</option>
			</select>
			<button disabled={justChangedAiModel}>
				{#if justChangedAiModel}
					Saved!
				{:else}
					Change AI Model
				{/if}
			</button>
		</p>
	</form>
{/await}
