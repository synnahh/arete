// Stand-in for 'virtual:pwa-register' in builds that have no service worker (Tauri desktop, dev server).
export function registerSW() { return async () => {}; }
