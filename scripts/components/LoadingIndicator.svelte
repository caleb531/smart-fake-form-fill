<script lang="ts">
	const { label }: { label: string } = $props();
</script>

<article class="loading-indicator">
	<svg viewBox="0 0 320 320" class="loading-indicator-icon">
		<path d="M 40,160 A 80,80 0,0,0 280,160" />
	</svg>
	<span class="loading-indicator-label">{label}</span>
</article>
