# Smart Fake Form Fill

_Copyright 2024 Caleb Evans_  
_Released under the MIT license_

Smart Fake Form Fill is a Chrome extension for populating forms with relevant,
AI-generated data. This is different from other fake data form-filling
extensions, which require you to specify field types, and which don't understand
the semantics of the fields they are populating.

Rather, this extension will send all form metadata (labels, formats, etc.) to
the LLM so it can produce more realistic fake data (as counterintuitive as that
sounds).

## Usage

### Build project

```sh
pnpm install
pnpm build
```

### Install from Chrome

Then, open [chrome://extensions](chrome://extensions) and enable **Developer
mode** in the top-right corner.

Once you see the Developer Mode toolbar appear, click the "Load unpacked"
button, then choose the `dist/` directory in the repository.

When the extension is installed, you'll need to enter your OpenAI API key to
start using the extension.
