import { db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { addLog } from "./logs";

const DOC_PATH = "app/state"; // collection/doc

async function loadFromFirestore() {
  try {
    const ref = doc(db, "clore", "state");
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data()?.payload || null;
  } catch (e) {
    console.warn("Firestore load failed:", e);
  }
  return null;
}

async function saveToFirestore(data) {
  try {
    const ref = doc(db, "clore", "state");
    await setDoc(ref, { payload: data });
    // audit log
    try {
      const auth = getAuth();
      const uid = auth?.currentUser?.uid || null;
      addLog(uid, "update_state", "clore/state", { size: JSON.stringify(data).length });
    } catch (e) { /* ignore */ }
    return true;
  } catch (e) {
    console.warn("Firestore save failed:", e);
    return false;
  }
}

export async function loadData() {
  // Load app state from Firestore (no local data fallback). Returns null if no remote state.
  const remote = await loadFromFirestore();
  return remote || null;
}

export async function saveData(data) {
  // Persist the full app state to Firestore `clore/state` if signed-in.
  let ok = false;
  try {
    const auth = getAuth();
    const uid = auth?.currentUser?.uid || null;
    if (uid) {
      ok = await saveToFirestore(data);
    } else {
      ok = false; // do not save when not signed-in
    }
  } catch (e) {
    console.warn('saveData failed', e);
    ok = false;
  }

  // Dispatch an event so UI can show save/sync status
  try {
    window.dispatchEvent(new CustomEvent('clore:save', { detail: { ok } }));
  } catch (e) { /* ignore */ }
  return ok;
}
