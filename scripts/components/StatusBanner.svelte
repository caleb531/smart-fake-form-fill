<script lang="ts">
	import { UI_MESSAGES } from '../config';
	import type { Status, StatusUpdateRequest } from '../types';
	import CancelIcon from './CancelIcon.svelte';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let status: Status | null = $state(null);
	let isClosingBanner = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	// Close the banner by waiting a specified amount of time, then closing
	function closeBanner() {
		isClosingBanner = true;
		setTimeout(() => {
			isClosingBanner = false;
		}, successDelay);
	}

	// Retrieve the initial status of the form fill job
	async function getStatus() {
		const { status } = await chrome.runtime.sendMessage({ action: 'getStatus' });
		return status ?? null;
	}

	$effect(() => {
		(async () => {
			status = await getStatus();
			chrome.runtime.onMessage.addListener((message: StatusUpdateRequest) => {
				if (message.action === 'updateStatus') {
					status = message.status;
				}
			});
		})();
	});
	$effect(() => {
		if (status?.code === 'SUCCESS') {
			closeBanner();
		}
	});

	async function cancelRequest() {
		await chrome.runtime.sendMessage({ action: 'cancelRequest' });
		closeBanner();
	}
</script>

<div class="status-banner" class:visible={status?.code === 'PROCESSING' || isClosingBanner}>
	<h1>Smart Fake Form Fill</h1>
	<div class="status-banner-status">
		{#if status?.code === 'PROCESSING'}
			<LoadingIndicator />
			{UI_MESSAGES.PROCESSING}
		{:else if status?.code === 'ERROR'}
			{status.message}
		{:else if status !== null}
			{UI_MESSAGES[status?.code]}
		{/if}
	</div>
	<button
		class="status-banner-close-button"
		title="Cancel Form Fill"
		onclick={cancelRequest}
		disabled={status?.code !== 'PROCESSING'}><CancelIcon /></button
	>
</div>
