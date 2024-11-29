import { mount } from 'svelte';
import Options from './components/Options.svelte';

const options = mount(Options, { target: document.getElementsByTagName('main')[0] });

export default options;
