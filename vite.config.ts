import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import webExtension from 'vite-plugin-web-extension';

export default defineConfig({
	plugins: [svelte(), webExtension()]
});
