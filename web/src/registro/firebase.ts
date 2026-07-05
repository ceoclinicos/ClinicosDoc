import { initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "AIzaSyCqYo-LQ2l-ETTRiNYx5U4tbnFVIEscbYw",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "clinicos-aed47.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "clinicos-aed47",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? "clinicos-aed47.firebasestorage.app",
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export function getDb(): Firestore {
  if (!db) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}
