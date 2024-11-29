import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

export default defineConfig({
	css: {
		preprocessorOptions: {
			scss: {
				api: 'modern-compiler'
			}
		}
	},
	plugins: [svelte()],
	build: {
		rollupOptions: {
			input: {
				popup: 'popup.html',
				options: 'options.html',
				'service-worker': 'service-worker.ts'
			},
			output: {
				entryFileNames: '[name].js' // Ensures proper file naming
			}
		}
	}
});
