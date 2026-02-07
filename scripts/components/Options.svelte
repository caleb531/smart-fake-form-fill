<script lang="ts">
	import { debounce } from 'es-toolkit';
	import { DEFAULT_OPENAI_MODEL } from '../config';
	import type { OpenAiModelListResponse } from '../types';
	import LoadingIndicator from './LoadingIndicator.svelte';

	type SavedOptions = { openai_api_key: string; openai_model: string; custom_instructions: string };

	let savedOptionsPromise: Promise<SavedOptions> = $state(
		new Promise((resolve, reject) => {
			(async () => {
				try {
					resolve({
						openai_api_key: (await chrome.storage.local.get('openai_api_key'))?.openai_api_key,
						openai_model:
							(await chrome.storage.sync.get(['openai_model']))?.openai_model ||
							DEFAULT_OPENAI_MODEL,
						custom_instructions:
							(await chrome.storage.sync.get(['custom_instructions']))?.custom_instructions || ''
					});
				} catch (error) {
					reject(error);
				}
			})();
		})
	);

	async function getFallbackModelList(): Promise<string[]> {
		try {
			const storedModel =
				(await chrome.storage.sync.get(['openai_model']))?.openai_model || DEFAULT_OPENAI_MODEL;
			return Array.from(new Set([storedModel, DEFAULT_OPENAI_MODEL])).sort();
		} catch (error) {
			console.error(error);
			return [DEFAULT_OPENAI_MODEL];
		}
	}

	const modelListPromise: Promise<string[]> = $state(
		new Promise((resolve) => {
			chrome.runtime.sendMessage(
				{ action: 'getModels' },
				(response: OpenAiModelListResponse | undefined) => {
					if (chrome.runtime.lastError) {
						getFallbackModelList().then(resolve);
						return;
					}
					if (response?.status.code === 'SUCCESS' && response.models?.length) {
						resolve(response.models);
						return;
					}
					getFallbackModelList().then(resolve);
				}
			);
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
		if (input.name === 'openai_api_key') {
			await chrome.storage.local.set({ openai_api_key: input.value });
		} else {
			await chrome.storage.sync.set({ [input.name]: input.value });
		}
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
				onfocus={(event) => event.currentTarget.select()}
			/>
			<span class="hint">
				<a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer"
					>Visit the OpenAI API Dashboard</a
				> to generate an API key.
			</span>
		</p>
		<p>
			<label for="openai_model">AI Model</label>
			<select name="openai_model" id="openai_model" bind:value={savedOptions.openai_model} required>
				{#await modelListPromise}
					<option disabled>Loading model list...</option>
				{:then modelList}
					{#each modelList as modelId (modelId)}
						<option value={modelId}>{modelId}</option>
					{/each}
				{:catch}
					<option disabled>
						Failed to load model list; defaulting to {DEFAULT_OPENAI_MODEL}
					</option>
				{/await}
			</select>
		</p>
		<p>
			<label for="custom_instructions">Custom Instructions</label>
			<textarea
				name="custom_instructions"
				id="custom_instructions"
				bind:value={savedOptions.custom_instructions}
			></textarea>
		</p>
		<p class="hint">
			{#if justSaved}
				Saved!
			{:else}
				Changes are automatically saved.
			{/if}
		</p>
	</form>
{/await}
