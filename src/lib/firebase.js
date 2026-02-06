import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// We use trim() to handle accidental spaces in GitHub Secrets
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim()
};

// Debug helper (will only show true/false in console, not your real key)
console.log("Firebase Key Loaded:", !!firebaseConfig.apiKey);

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
