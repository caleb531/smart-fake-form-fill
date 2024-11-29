import { mount } from 'svelte';
import Popup from './components/Popup.svelte';

const popup = mount(Popup, { target: document.getElementsByTagName('main')[0] });

export default popup;
