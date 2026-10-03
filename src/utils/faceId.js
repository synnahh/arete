// faceId.js — biometric unlock for the PIN gate, using a WebAuthn platform
// credential (Face ID / Touch ID on iPhone, Windows Hello on desktop). Nothing is
// sent anywhere: the credential id is kept in localStorage and the browser asks
// the device to verify the person. Like the PIN this is a light lock on the
// device; the real protection is the Supabase sign-in.

const KEY = 'arete_faceid_cred';
const DECLINED = 'arete_faceid_declined';

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked */ } };

const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const challenge = () => crypto.getRandomValues(new Uint8Array(32));

export const biometricLabel = () =>
  (typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) ? 'Face ID' : 'biometric unlock';

export async function biometricAvailable() {
  try {
    return !!(window.PublicKeyCredential
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

export const faceIdEnabled = () => !!read(KEY);
export const faceIdDeclined = () => read(DECLINED) === '1';
export const declineFaceId = () => write(DECLINED, '1');
export const forgetFaceId = () => { write(KEY, null); write(DECLINED, null); };

/** Create the device credential. Must be called from a tap. Returns true on success. */
export async function enableFaceId() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'Arete', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'arete-owner', displayName: 'Arete' },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
      },
    });
    if (!cred) return false;
    write(KEY, toB64(cred.rawId));
    write(DECLINED, null);
    return true;
  } catch { return false; }
}

/** Ask the device to verify the person. Resolves true only after Face ID succeeds. */
export async function unlockWithFaceId() {
  const id = read(KEY);
  if (!id) return false;
  try {
    const got = await navigator.credentials.get({
      publicKey: {
        challenge: challenge(),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromB64(id), transports: ['internal'] }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!got;
  } catch { return false; }
}
