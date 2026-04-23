// Firebase initialization and exports
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

// Helper to read environment variables from Vite (import.meta.env) or Node (process.env)
function envVar(names) {
  // Prefer Vite's import.meta.env when available. Access inside try/catch to avoid
  // syntax/runtime issues in non-Vite environments.
  try {
    // eslint-disable-next-line no-undef
    if (import.meta && import.meta.env) {
      for (const n of names) if (import.meta.env[n]) return import.meta.env[n];
    }
  } catch (e) {
    // import.meta may not be available in this environment — fall back to process.env
  }

  if (typeof process !== 'undefined' && process.env) {
    for (const n of names) if (process.env[n]) return process.env[n];
  }

  return undefined;
}

// Common name variants to support local .env, CRA, and GitHub Actions secrets

const firebaseConfig = {
  apiKey: envVar(["VITE_FIREBASE_API_KEY"]),
  authDomain: envVar(["VITE_FIREBASE_AUTH_DOMAIN"]),
  projectId: envVar(["VITE_FIREBASE_PROJECT_ID"]),
  storageBucket: envVar(["VITE_FIREBASE_STORAGE_BUCKET"]),
  messagingSenderId: envVar(["VITE_FIREBASE_MESSAGING_SENDER_ID"]),
  appId: envVar(["VITE_FIREBASE_APP_ID"]),
  measurementId: envVar(["VITE_FIREBASE_MEASUREMENT_ID"]),
};

const app = initializeApp(firebaseConfig);
// analytics may fail in some environments (SSR); guard it
let analytics = null;
try { analytics = getAnalytics(app); } catch (e) { /* ignore */ }

const db = getFirestore(app);

export { app, analytics, db };
