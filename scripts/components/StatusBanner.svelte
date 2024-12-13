<script lang="ts">
	import { MESSAGES } from '../config';
	import type { Status, StatusUpdateRequest } from '../types';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let status: Status | null = $state(null);
	let justFinishedFillingForm = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	$effect(() => {
		chrome.runtime.onMessage.addListener((message: StatusUpdateRequest) => {
			if (message.action === 'updateStatus') {
				status = message.status;
			}
		});
	});
	$effect(() => {
		if (status?.code === 'SUCCESS') {
			justFinishedFillingForm = true;
			setTimeout(() => {
				justFinishedFillingForm = false;
			}, successDelay);
		}
	});
</script>

<div class="status-banner" class:visible={status?.code === 'PROCESSING' || justFinishedFillingForm}>
	<h1>Smart Fake Form Fill</h1>
	<div class="status-banner-status">
		{#if status?.code === 'PROCESSING'}
			<LoadingIndicator />
			{MESSAGES.PROCESSING}
		{:else if status?.code === 'ERROR'}
			{status.message}
		{:else if status !== null}
			{MESSAGES[status?.code]}
		{/if}
	</div>
</div>
