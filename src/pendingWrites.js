import { db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { onAuthChange } from "./auth";
import { addLog } from "./logs";

const MAX_ATTEMPTS = 5;
// In-memory queue only. This queue is not persisted and will be lost on page reload.
// The app relies on Firestore as the canonical data source.
let QUEUE = [];

function readQueue() { return [...QUEUE]; }
function writeQueue(queue) { QUEUE = Array.isArray(queue) ? [...queue] : []; }

export function enqueuePendingWrite(collectionName, docId, payload) {
  const queue = readQueue();
  queue.push({ collectionName, docId, payload, ts: Date.now(), attempts: 0 });
  writeQueue(queue);
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('clore:pendingChange', { detail: { count: queue.length } }));
    }
  } catch (e) { /* ignore */ }
}

export async function flushPendingWrites() {
  try {
    const auth = getAuth();
    const uid = auth?.currentUser?.uid || null;
    if (!uid) return; // only flush when signed-in

  let queue = readQueue();
  if (!queue.length) return;

    const remaining = [];
    for (const item of queue) {
      try {
        await setDoc(doc(db, item.collectionName, item.docId), item.payload);
        // audit log per item
        try { addLog(uid, 'flush_pending_write', `${item.collectionName}/${item.docId}`, { ts: item.ts }); } catch (e) {}
      } catch (e) {
        // increment attempts, keep if under limit
        item.attempts = (item.attempts || 0) + 1;
        if (item.attempts < MAX_ATTEMPTS) remaining.push(item);
        else console.warn('Dropping pending write after max attempts', item);
      }
    }
    writeQueue(remaining);
    try {
      if (typeof window !== 'undefined' && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('clore:pendingChange', { detail: { count: remaining.length } }));
      }
    } catch (e) { /* ignore */ }
  } catch (e) {
    console.warn('flushPendingWrites failed', e);
  }
}

// auto-flush when auth state becomes signed-in
onAuthChange((user) => {
  if (user) {
    // don't await - flush in background
    flushPendingWrites();
  }
});

export function pendingCount() { return readQueue().length; }
