import React, { useState, useRef, useEffect } from "react";
import { fmtRM } from "../utils";
import { db } from "../firebase";
import { collection, onSnapshot, setDoc, addDoc, doc, deleteDoc, runTransaction, Timestamp } from "firebase/firestore";
import { addLog } from "../logs";
import { currentUser } from "../auth";
import { enqueuePendingWrite } from "../pendingWrites";

export default function PurchasesPage({ data, update, isAdmin }) {
  const [modal, setModal] = useState(false);
  // form uses canonical productid and quantity keys
  const [form, setForm] = useState({ supplier: "", invoice: "", date: new Date().toISOString().slice(0,10), productid: data.products[0]?.id || "", quantity: 1, costPrice: 0 });
  const [remotePurchases, setRemotePurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);

  const openAdd = () => { setForm({ supplier: "", invoice: "", date: new Date().toISOString().slice(0,10), productid: data.products[0]?.id || "", quantity: 1, costPrice: 0 }); setEditId(null); setModal(true); };
  const productRef = useRef(null);
  useEffect(() => { if (modal) setTimeout(() => productRef.current?.focus(), 0); }, [modal]);
  // current signed-in uid (for logging) — use isAdmin prop to gate actions
  const actorUid = currentUser()?.uid || null;

  useEffect(() => {
    // subscribe to purchases collection in Firestore
    try {
      const col = collection(db, 'purchases');
      const unsub = onSnapshot(col, (snap) => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // normalize docs to local shape
        const normalized = arr.map(d => {
          // normalize and coerce Firestore Timestamp objects to YYYY-MM-DD strings
          const rawDate = d.purcdate ?? d.date ?? d.purcDate ?? '';
          let dateStr = '';
          if (rawDate && typeof rawDate === 'object' && rawDate.seconds != null) {
            // Firestore Timestamp
            try { dateStr = new Date(rawDate.seconds * 1000).toISOString().slice(0,10); } catch (e) { dateStr = String(rawDate); }
          } else if (rawDate) {
            dateStr = String(rawDate);
          }

          const qty = Number(d.quantity ?? d.qty ?? 0);
          const cost = Number(d.costprice ?? d.costPrice ?? 0);
          const total = Number(d.totalprice ?? d.total ?? (qty * cost));

          return {
            id: d.id,
            supplier: d.supplier || d.Supplier || '',
            invoice: d.invoice || d.invoiceNo || '',
            date: dateStr,
            productid: d.productid || d.productId || d.product || '',
              quantity: qty,
            costPrice: cost,
            total
          };
        });
        setRemotePurchases(normalized);
        setLoading(false);
      }, (err) => { console.warn('purchases onSnapshot error', err); setLoading(false); });
      return () => unsub();
    } catch (e) { console.warn('subscribe purchases failed', e); setLoading(false); }
  }, []);

  const save = () => {
    const product = data.products.find(p => p.id === form.productid);
    if (!product) return;
    // prepare payload in canonical shape
    const payload = {
      supplier: form.supplier,
      invoice: form.invoice,
      purcdate: form.date,
      productid: form.productid,
      quantity: Number(form.quantity),
      costprice: Number(form.costPrice),
      totalprice: Number(form.quantity) * Number(form.costPrice || 0)
    };

  if (!isAdmin) { alert('Only Admin users can record purchases.'); return; }

  // optimistic local update — use a consistent temp id so we can reconcile after addDoc
    const tempId = `PU${Date.now().toString().slice(-6)}`;
    update(d => {
      if (editId) {
        const i = d.purchases.findIndex(x => x.id === editId);
        if (i >= 0) d.purchases[i] = { ...d.purchases[i], ...payload, id: editId };
      } else {
        d.purchases.push({ id: tempId, ...payload });
      }
      // product stock update locally (stock movements are canonical in Firestore)
      d.products = d.products.map(p => p.id === form.productid ? { ...p, stock: (p.stock || 0) + Number(form.quantity) } : p);
    });

    // Persist to Firestore when signed-in
    try {
      if (actorUid) {
        if (editId) {
          setDoc(doc(db, 'purchases', editId), payload).then(() => {
            try { addLog(actorUid, 'edit_purchase', `purchases/${editId}`, { invoice: payload.invoice }); } catch (e) {}
          }).catch(e => { console.warn('purchase write failed', e); });
        } else {
          // Use Firestore auto-generated ID for new purchases
          addDoc(collection(db, 'purchases'), payload).then((ref) => {
            try { addLog(actorUid, 'add_purchase', `purchases/${ref.id}`, { invoice: payload.invoice }); } catch (e) {}
                // reconcile local optimistic entry (replace tempId with real id)
                update(d => {
                  const i = d.purchases.findIndex(x => x.id === tempId);
                  if (i >= 0) d.purchases[i].id = ref.id;
                });

                // Also create a stocks record and increment product stock in Firestore
                try {
                  runTransaction(db, async (tx) => {
                    const prodRef = doc(db, 'products', payload.productid);
                    const prodSnap = await tx.get(prodRef);
                    let currentStock = 0;
                    if (prodSnap.exists()) {
                      const pd = prodSnap.data();
                      currentStock = Number(pd?.stock || 0);
                    }
                    const newStock = currentStock + Number(payload.quantity || 0);

                    if (prodSnap.exists()) tx.update(prodRef, { stock: newStock });
                    else tx.set(prodRef, { stock: newStock });

                    const stockRef = doc(collection(db, 'stocks'));
                    // write stock-in record with requested fields
                        tx.set(stockRef, {
                          productid: payload.productid,
                          quantity: payload.quantity,
                          reference: payload.invoice || '',
                          transdate: (payload.purcdate && typeof payload.purcdate === 'string') ? Timestamp.fromDate(new Date(payload.purcdate)) : (payload.purcdate && typeof payload.purcdate.toDate === 'function' ? payload.purcdate : (payload.date ? Timestamp.fromDate(new Date(payload.date)) : Timestamp.fromDate(new Date()))),
                          transtype: 'in'
                        });

                    return stockRef.id;
                  }).then((stockId) => {
                    try { addLog(actorUid, 'stock_in', `stocks/${stockId}`, { productid: payload.productid, quantity: payload.quantity }); } catch (e) {}
                  }).catch(e => {
                    console.warn('stock in transaction failed', e);
                  });
                } catch (e) {
                  console.warn('stock in write skipped', e);
                }
          }).catch(e => { console.warn('purchase write failed', e); });
        }
      } else {
        // actorUid missing; log will be skipped
      }
    } catch (e) { console.warn('purchase firestore write skipped', e); }

    setModal(false);
    setEditId(null);
  };

  const openEdit = (p) => {
    // coerce any Timestamp-like date to YYYY-MM-DD string
    const raw = p.purcdate ?? p.date ?? p.purcDate ?? '';
    let dateVal = new Date().toISOString().slice(0,10);
    if (raw && typeof raw === 'object' && raw.seconds != null) {
      try { dateVal = new Date(raw.seconds * 1000).toISOString().slice(0,10); } catch (e) { dateVal = String(raw); }
    } else if (raw) {
      dateVal = String(raw);
    }
    setForm({ supplier: p.supplier || '', invoice: p.invoice || '', date: dateVal, productid: p.productId || p.productid || '', quantity: p.qty || p.quantity || 1, costPrice: p.costPrice || p.costprice || 0 });
    setEditId(p.id);
    setModal(true);
  };

  const deleteRemote = async (id) => {
    if (!confirm('Delete this purchase from Firestore? This action cannot be undone.')) return;
    try { await deleteDoc(doc(db, 'purchases', id)); const actor = currentUser()?.uid || null; try { addLog(actor, 'delete_purchase', `purchases/${id}`, {}); } catch (e) {} } catch (e) { console.error(e); alert('Delete failed'); }
  };

  return (
    <div>
  <div className="row-space">
    <div><strong>Purchases</strong></div>
  <div><button className="page-header-btn" onClick={openAdd} disabled={!isAdmin} title={!isAdmin ? 'Admin only' : ''}>＋ New Purchase</button></div>
  </div>

      <div className="card">
        <table>
          <thead><tr><th>Invoice</th><th>Supplier</th><th>Product</th><th>Qty</th><th>Unit</th><th>Total</th><th>Date</th><th></th></tr></thead>
          <tbody>
            {(remotePurchases.length ? [...remotePurchases].reverse() : [...data.purchases].reverse()).map(pu => {
              const p = data.products.find(pp => pp.id === (pu.productId || pu.productid || pu.productid));
              return (
                <tr key={pu.id} style={{ cursor: isAdmin ? 'pointer' : 'default' }} onClick={isAdmin ? () => openEdit(pu) : undefined}>
                  <td style={{ fontFamily: 'monospace' }}>{pu.invoice}</td>
                  <td>{pu.supplier}</td>
                  <td>{p?.image} {p?.name}</td>
                  <td>{pu.quantity ?? pu.qty}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmtRM(pu.costPrice || pu.costprice)}</td>
                  <td style={{ fontFamily: 'monospace' }}>{fmtRM(pu.total)}</td>
                  <td style={{ color: '#666' }}>{pu.date}</td>
                  <td>{isAdmin ? <button className="ghost" onClick={(e) => { e.stopPropagation(); if (pu.id) deleteRemote(pu.id); }}>Remove</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Record Purchase</strong></div>
            <div className="modal-body">
              <div className="modal-form">
                <div className="form-group full">
                  <div className="form-label">Supplier</div>
                  <input className={`auth-input ${!(form.supplier||'').trim() ? 'input-invalid' : ''}`} placeholder="Supplier" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} />
                </div>

                <div className="two-col-grid">
                  <div>
                    <div className="form-label">Invoice</div>
                    <input className="auth-input" placeholder="Invoice" value={form.invoice} onChange={e => setForm(f => ({ ...f, invoice: e.target.value }))} />
                  </div>

                  <div>
                    <div className="form-label">Product</div>
                    <select ref={productRef} className="form-select" value={form.productid} onChange={e => setForm(f => ({ ...f, productid: e.target.value }))}>
                      {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <div className="form-label">Quantity</div>
                    <input className={`auth-input ${Number(form.quantity) <= 0 ? 'input-invalid' : ''}`} inputMode="numeric" step="1" type="number" min="1" placeholder="Quantity" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>

                  <div>
                    <div className="form-label">Cost Price</div>
                    <input className={`auth-input ${Number(form.costPrice) < 0 ? 'input-invalid' : ''}`} inputMode="decimal" step="0.01" type="number" min="0" placeholder="Cost Price" value={form.costPrice} onChange={e => setForm(f => ({ ...f, costPrice: e.target.value }))} />
                  </div>

                        <div className="col-span-all">
                          <div className="form-label">Date</div>
                          <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                        </div>
                </div>
              </div>
            </div>
                  <div className="modal-footer"><button className="ghost" onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={save} disabled={!actorUid || !(form.productid && (form.supplier||'').trim() && Number(form.quantity) > 0 && Number(form.costPrice) >= 0)}>Record</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
