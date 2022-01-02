import { writable } from 'svelte/store';

export const notes = writable([]);

export const isAuthenticated = writable(false);
export const user = writable({});
export const popupOpen = writable(false);
export const error = writable();

export const token = writable("");