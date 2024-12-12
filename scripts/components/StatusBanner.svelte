<script lang="ts">
	import { MESSAGES } from '../config';
	import type { Status, StatusUpdateRequest } from '../types';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let status: Status | null = $state(null);

	$effect(() => {
		chrome.runtime.onMessage.addListener((message: StatusUpdateRequest) => {
			if (message.action === 'updateStatus') {
				status = message.status;
			}
		});
	});
</script>

<div class="status-banner" class:visible={status !== null}>
	<h1>Smart Fake Form Fill</h1>
	<div class="status-banner-status">
		{#if status !== null}
			{#if status?.code === 'PROCESSING'}
				<LoadingIndicator />
			{/if}
			{MESSAGES[status?.code]}
		{/if}
	</div>
</div>
