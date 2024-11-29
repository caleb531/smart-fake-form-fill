<script lang="ts">
	let formSelector = $state('#app-embed::shadow form');

	async function fillForm(event: SubmitEvent) {
		event.preventDefault();
		console.log(`Fill the form at: ${formSelector}`);
	}
</script>

<svelte:head>
	<title>Smart Fake Form Fill</title>
</svelte:head>

<h1>Smart Fake Form Fill</h1>

<form onsubmit={fillForm}>
	<p>
		<label for="formSelector">Form Selector</label>
		<input id="formSelector" name="formSelector" type="text" bind:value={formSelector} />
	</p>

	<button>Fill Form</button>
</form>
