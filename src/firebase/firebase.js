// ─── Firebase initialisation ──────────────────────────────────────────────────
import { initializeApp }                         from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

// persistentLocalCache gives us automatic offline support via IndexedDB
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// ── Stable user/device identifier (no auth required) ──────────────────────────
// All data lives under users/{deviceId}/* in Firestore
export function getDeviceId() {
  let id = localStorage.getItem('valerie_device_id');
  if (!id) {
    id = 'user_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 6);
    localStorage.setItem('valerie_device_id', id);
  }
  return id;
}
