import { getAuth, onAuthStateChanged, signInWithCustomToken, signOut, type Auth, type User } from "firebase/auth";
import { getApp, getDb } from "../registro/firebase";

let authReady: Promise<User | null> | null = null;

export function getFirebaseAuth(): Auth {
  getDb(); // asegura initializeApp
  return getAuth(getApp());
}

/** Espera a que Firebase Auth restaure la sesión persistida. */
export function waitForAuth(): Promise<User | null> {
  if (!authReady) {
    const auth = getFirebaseAuth();
    authReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user);
      });
    });
  }
  return authReady;
}

export async function signInWithFirebaseToken(token: string): Promise<User> {
  const cred = await signInWithCustomToken(getFirebaseAuth(), token);
  authReady = Promise.resolve(cred.user);
  return cred.user;
}

export async function signOutFirebase(): Promise<void> {
  try {
    await signOut(getFirebaseAuth());
  } catch {
    /* ignore */
  }
  authReady = Promise.resolve(null);
}

export function currentAuthUid(): string | null {
  return getFirebaseAuth().currentUser?.uid ?? null;
}

/** ID token para APIs Admin (Authorization: Bearer …). */
export async function getIdToken(forceRefresh = false): Promise<string | null> {
  await waitForAuth();
  const user = getFirebaseAuth().currentUser;
  if (!user) return null;
  return user.getIdToken(forceRefresh);
}
