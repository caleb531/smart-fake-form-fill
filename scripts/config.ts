// The display name of the extension
export const EXTENSION_DISPLAY_NAME = 'Smart Fake Form Fill';
// Define the default AI model to use
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
// The maximum number of times to retry establishing a connection to the OpenAI
// API (note that this will be in addition to a guaranteed first attempt)
export const OPENAI_REQUEST_MAX_RETRIES = 1;
// The number of milliseconds to wait before timing out the OpenAI request
export const OPENAI_REQUEST_TIMEOUT = 5000;

// The possible messages to show within the UI based on the state of the
// extension
export const UI_MESSAGES = {
	PROCESSING: 'Generating smart fake values with AI…',
	SUCCESS: 'Success!',
	ERROR: 'An error occurred.',
	CANCELED: 'Canceled.'
} as const;
