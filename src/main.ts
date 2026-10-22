import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { auth } from './lib/auth.svelte';
import { theme } from './lib/theme.svelte';

// The saved (or system) theme goes on the page before anything is drawn.
theme.init();

// A one-time sign-in link (#/token-login?t=...) is redeemed and removed from the address first.
void auth.consumeUrlToken();

export default mount(App, { target: document.getElementById('app')! });
