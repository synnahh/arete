//  spotify.js  Spotify OAuth PKCE + API 
// Uses Authorization Code with PKCE  no client secret needed, works in browser.

const CLIENT_ID    = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/callback`;
const SCOPES       = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'playlist-read-private',
].join(' ');

const STORAGE = {
  token:        'valerie_spotify_token',
  refresh:      'valerie_spotify_refresh',
  expiry:       'valerie_spotify_expiry',
  verifier:     'valerie_spotify_verifier',
  connected:    'valerie_spotify_connected',
};

//  PKCE helpers 
function generateVerifier(length = 128) {
  const chars  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const arr    = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join('');
}

async function generateChallenge(verifier) {
  const data    = new TextEncoder().encode(verifier);
  const digest  = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

//  Auth 
export async function spotifyLogin() {
  const verifier   = generateVerifier();
  const challenge  = await generateChallenge(verifier);
  localStorage.setItem(STORAGE.verifier, verifier);

  const params = new URLSearchParams({
    client_id:             CLIENT_ID,
    response_type:         'code',
    redirect_uri:          REDIRECT_URI,
    scope:                 SCOPES,
    code_challenge_method: 'S256',
    code_challenge:        challenge,
  });

  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

export async function handleSpotifyCallback(code) {
  const verifier = localStorage.getItem(STORAGE.verifier);
  if (!verifier) throw new Error('No PKCE verifier found');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  saveTokens(data);
  localStorage.removeItem(STORAGE.verifier);
  return data;
}

export async function refreshSpotifyToken() {
  const refresh = localStorage.getItem(STORAGE.refresh);
  if (!refresh) return null;

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID,
      grant_type:    'refresh_token',
      refresh_token: refresh,
    }),
  });

  if (!res.ok) { spotifyDisconnect(); return null; }
  const data = await res.json();
  saveTokens(data);
  return data.access_token;
}

function saveTokens({ access_token, refresh_token, expires_in }) {
  localStorage.setItem(STORAGE.token,     access_token);
  localStorage.setItem(STORAGE.expiry,    Date.now() + (expires_in - 60) * 1000);
  localStorage.setItem(STORAGE.connected, 'true');
  if (refresh_token) localStorage.setItem(STORAGE.refresh, refresh_token);
}

export function spotifyDisconnect() {
  Object.values(STORAGE).forEach(k => localStorage.removeItem(k));
}

export function isSpotifyConnected() {
  return localStorage.getItem(STORAGE.connected) === 'true' &&
    !!localStorage.getItem(STORAGE.token);
}

async function getToken() {
  const expiry = +localStorage.getItem(STORAGE.expiry) || 0;
  if (Date.now() > expiry) return refreshSpotifyToken();
  return localStorage.getItem(STORAGE.token);
}

//  API calls 
async function spotifyFetch(path, options = {}) {
  const token = await getToken();
  if (!token) return null;

  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });

  if (res.status === 401) { spotifyDisconnect(); return null; }
  if (res.status === 204 || res.status === 202) return null;
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

export async function getNowPlaying() {
  return spotifyFetch('/me/player/currently-playing');
}

export async function getPlaybackState() {
  return spotifyFetch('/me/player');
}

export async function pausePlayback() {
  return spotifyFetch('/me/player/pause', { method: 'PUT' });
}

export async function resumePlayback() {
  return spotifyFetch('/me/player/play', { method: 'PUT' });
}

export async function skipNext() {
  return spotifyFetch('/me/player/next', { method: 'POST' });
}

export async function skipPrev() {
  return spotifyFetch('/me/player/previous', { method: 'POST' });
}

export async function setVolume(pct) {
  return spotifyFetch(`/me/player/volume?volume_percent=${Math.round(pct)}`, { method: 'PUT' });
}
