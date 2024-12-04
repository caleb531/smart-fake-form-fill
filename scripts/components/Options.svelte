<script lang="ts">
	import { debounce } from 'es-toolkit';
	import { DEFAULT_AI_MODEL } from '../config';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let savedOptionsPromise: Promise<{ openai_api_key: string; openai_model: string }> = $state(
		new Promise((resolve, reject) => {
			(async () => {
				try {
					resolve({
						openai_api_key: (await chrome.storage.local.get(['openai_api_key']))?.openai_api_key,
						openai_model:
							(await chrome.storage.sync.get(['openai_model']))?.openai_model || DEFAULT_AI_MODEL
					});
				} catch (error) {
					reject(error);
				}
			})();
		})
	);

	let justSaved = $state(false);
	// The number of milliseconds to wait (after the user stops typing) before
	// saving the option
	const saveDelay = 500;
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	const saveOption = debounce(async (event: Event) => {
		const input = event.target as HTMLInputElement;
		await chrome.storage.local.set({ [input.name]: input.value });
		justSaved = true;
		setTimeout(() => {
			justSaved = false;
		}, successDelay);
	}, saveDelay);

	async function changeOption(event: Event) {
		event.preventDefault();
		saveOption(event);
	}
</script>

<svelte:head>
	<title>Options | Smart Fake Form Fill</title>
</svelte:head>

<h1>Options | Smart Fake Form Fill</h1>

{#await savedOptionsPromise}
	<LoadingIndicator />
{:then savedOptions}
	<form oninput={changeOption}>
		<p>
			<label for="openai_api_key">OpenAI API Key</label>
			<input
				type="password"
				name="openai_api_key"
				id="openai_api_key"
				required
				bind:value={savedOptions.openai_api_key}
			/>
		</p>
		<p>
			<label for="openai_model">AI Model</label>
			<select name="openai_model" id="openai_model" bind:value={savedOptions.openai_model}>
				<option value="gpt-4o-mini">gpt-4o-mini</option>
				<option value="gpt-4o">gpt-4o</option>
			</select>
		</p>
		<p class="autosave-hint">
			{#if justSaved}
				Saved!
			{:else}
				Changes are automatically saved.
			{/if}
		</p>
	</form>
{/await}
