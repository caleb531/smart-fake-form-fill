<script lang="ts">
	import LoadingIndicator from './LoadingIndicator.svelte';

	let processingMessage: string | null = $state(null);
	let justFinishedFillingForm = $state(false);
	// The number of milliseconds to wait to indicate to the user that the API key
	// was successfully changed
	const successDelay = 2000;

	$effect(() => {
		(async () => {
			const local = await chrome.storage.local.get('processingMessage');
			if (local.processingMessage) {
				processingMessage = local.processingMessage;
			}
			// Hide processing state when the process is done
			chrome.storage.onChanged.addListener((changes) => {
				if (changes.processingMessage) {
					processingMessage = changes.processingMessage.newValue;
					if (processingMessage === null) {
						justFinishedFillingForm = true;
						setTimeout(() => {
							justFinishedFillingForm = false;
						}, successDelay);
					}
				}
			});
		})();
	});
</script>

<div class="status-banner" class:visible={processingMessage !== null || justFinishedFillingForm}>
	<h1>Smart Fake Form Fill</h1>
	<div class="status-banner-status">
		{#if justFinishedFillingForm}
			Done!
		{:else if processingMessage !== null}
			<LoadingIndicator />
			{processingMessage}
		{/if}
	</div>
</div>
