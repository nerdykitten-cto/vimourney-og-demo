import { mount } from 'svelte';
import '@kbm/shared/theme.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
