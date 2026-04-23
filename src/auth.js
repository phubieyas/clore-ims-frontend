import { getAuth, signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged } from "firebase/auth";
import { db } from "./firebase";
import { doc, getDoc } from "firebase/firestore";

const auth = getAuth();

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export async function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return fbSignOut(auth);
}

export function currentUser() {
  return auth.currentUser;
}

export async function checkAdmin(uid) {
  try {
    if (!uid) return false;
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return false;
    const data = snap.data();
    return data?.role === "Admin";
  } catch (e) {
    console.warn("checkAdmin failed", e);
    return false;
  }
}
