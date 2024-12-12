<script lang="ts">
	import { MESSAGES } from '../config';
	import type { Status, StatusUpdateRequest } from '../types';
	import LoadingIndicator from './LoadingIndicator.svelte';

	let status: Status | null = $state(null);

	$effect(() => {
		chrome.runtime.onMessage.addListener((message: StatusUpdateRequest) => {
			switch (message.action) {
				case 'updateStatus':
					status = message.status;
					break;
			}
		});
	});
</script>

<div class="status-banner" class:visible={status !== null}>
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
