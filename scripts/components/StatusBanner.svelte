<script lang="ts">
	let processingMessage: string | null = $state(null);

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
				}
			});
		})();
	});
</script>

<div class="status-banner" class:visible={processingMessage !== null}>
	<h1>Smart Fake Form Fill</h1>
	{#if processingMessage !== null}
		<div class="status-banner-status">
			{processingMessage}
		</div>
	{/if}
</div>
