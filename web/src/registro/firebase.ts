import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyCqYo-LQ2l-ETTRiNYx5U4tbnFVIEscbYw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "clinicos-aed47.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "clinicos-aed47",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "clinicos-aed47.firebasestorage.app",
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

function ensureApp(): FirebaseApp {
  if (!app) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
  }
  return app;
}

export function getApp(): FirebaseApp {
  return ensureApp();
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(ensureApp());
  }
  return db;
}
