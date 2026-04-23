import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Add an audit log entry to Firestore logs collection
export async function addLog(actorUid, action, target, metadata = {}) {
  try {
    await addDoc(collection(db, "logs"), {
      actorUid: actorUid || null,
      action,
      target,
      metadata,
      ts: serverTimestamp(),
    });
  } catch (e) {
    console.warn("addLog failed", e);
  }
}
