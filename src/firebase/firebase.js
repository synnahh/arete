//  Firebase initialisation 
import { initializeApp }                              from 'firebase/app';
import { initializeFirestore, persistentLocalCache }  from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { setSentryUser } from '../utils/sentry.js';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

export const auth = getAuth(app);

//  Anonymous Authentication 
// Signs in silently on every launch. Provides request.auth for Firestore rules.
// IMPORTANT: The Firebase UID is NOT used as the Firestore path key  we keep
// the existing device ID (valerie_device_id) as the path so existing user data
// is never broken. Firebase Auth just supplies the auth token for the rules check.
let _authReady = false;

signInAnonymously(auth).catch(err => {
  console.warn('[VALERIE/Auth] Anonymous sign-in failed:', err.message);
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    _authReady = true;
    // Store Firebase UID separately  do NOT overwrite valerie_device_id.
    // valerie_device_id is the Firestore path key; changing it would orphan all data.
    localStorage.setItem('valerie_firebase_uid', user.uid);
    setSentryUser(user.uid);
  }
});

//  Stable data path identifier 
// Returns the device ID that is used as the Firestore path key.
// This is stable across all sessions and is never replaced by the Firebase UID.
export function getUserIdSync() {
  let id = localStorage.getItem('valerie_device_id');
  if (!id) {
    id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('valerie_device_id', id);
  }
  return id;
}

// Resolves once anonymous auth has completed
export function waitForAuth() {
  if (_authReady) return Promise.resolve();
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, user => {
      if (user) { unsub(); resolve(); }
    });
  });
}

