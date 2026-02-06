import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const key = (import.meta.env.VITE_FIREBASE_API_KEY || "").trim();

// SAFE DEBUG: This logs the length and the ends of the key to catch mix-ups
console.log("--- KEY CHECK ---");
console.log("Length:", key.length);
console.log("Starts with:", key.substring(0, 7));
console.log("Ends with:", key.substring(key.length - 4));
console.log("-----------------");

const firebaseConfig = {
  apiKey: key,
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: (import.meta.env.VITE_FIREBASE_APP_ID || "").trim()
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
