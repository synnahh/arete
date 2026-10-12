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

/** One line that explains the iOS wording, shown next to the Face ID switch. */
export const PASSKEY_NOTE = 'iPhone shows its Face ID sheet as a "passkey" for Arete. It is only used to unlock this app on this device, never to sign in anywhere. It appears in Settings > Passwords, where you can delete it.';

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

/** Plain-words reason for a failed attempt, from the error the browser raised. */
export function explainFaceIdError(e, label = 'Face ID') {
  const name = e?.name || '';
  if (name === 'NotAllowedError') return `${label} was cancelled or not allowed. Allow it when iOS asks, and check ${label} is set up in iOS Settings.`;
  if (name === 'SecurityError') return `The browser refused ${label} for this web address. Open the app from the Home Screen icon and try again.`;
  if (name === 'NotSupportedError' || name === 'InvalidStateError') return `This device or browser does not support ${label} here.`;
  if (name === 'TypeError' || !name) return `${label} is not available in this browser.`;
  return `${label} could not be turned on (${name}).`;
}

/**
 * Create the device credential. Must be called from a tap. Resolves { ok, error }:
 * a failure is never recorded as "declined", so you can try again.
 */
export async function enableFaceIdDetailed() {
  try {
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'Arete', id: location.hostname },
        user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Arete app lock', displayName: 'Arete app lock' },   // iOS shows this name in its passkey sheet
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60000,
      },
    });
    if (!cred) return { ok: false, error: explainFaceIdError(null) };
    write(KEY, toB64(cred.rawId));
    write(DECLINED, null);
    return { ok: true, error: null };
  } catch (e) { return { ok: false, error: explainFaceIdError(e) }; }
}

/** Same, as a plain yes/no. */
export async function enableFaceId() { return (await enableFaceIdDetailed()).ok; }

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
