import React, { useState, useRef, useEffect } from "react";
import { fmt } from "../utils";
import { db } from "../firebase";
import { collection, doc, runTransaction, Timestamp } from "firebase/firestore";
import { addLog } from "../logs";
import { currentUser } from "../auth";

export default function StockOutPage({ data, update, isAdmin = false }) {
  const [modal, setModal] = useState(false);
  const reasons = ["TikTok Sales", "Manual Sales", "Damaged", "Samples"];
  const [form, setForm] = useState({ productid: data.products[0]?.id || "", quantity: 1, date: new Date().toISOString().slice(0,10), ref: reasons[0] });

  const open = () => { setForm({ productid: data.products[0]?.id || "", quantity: 1, date: new Date().toISOString().slice(0,10), ref: reasons[0] }); setModal(true); };
  const productRef = useRef(null);
  useEffect(() => { if (modal) setTimeout(() => productRef.current?.focus(), 0); }, [modal]);
  const save = () => {
    if (!isAdmin) { alert('Only Admin users can record stock movements.'); return; }

  // prepare payload (use Firestore Timestamp for transdate and canonical field names)
  const payload = { productid: form.productid, quantity: Number(form.quantity), transdate: Timestamp.fromDate(new Date(form.date)), reason: form.ref, transtype: 'out' };

    // optimistic product stock update only; stock movement records are canonical in Firestore
    update(d => {
      d.products = d.products.map(p => p.id === form.productid ? { ...p, stock: Math.max(0, (p.stock || 0) - Number(form.quantity)) } : p);
    });

    // Persist to Firestore using a transaction: create stocks doc and decrement product stock atomically
    const actorUid = currentUser()?.uid || null;
    if (!actorUid) {
      try { alert('You must be signed in as Admin to persist stock movements.'); } catch (e) {}
      setModal(false);
      return;
    }

    try {
      runTransaction(db, async (tx) => {
  const prodRef = doc(db, 'products', form.productid);
        const prodSnap = await tx.get(prodRef);
        let currentStock = 0;
        if (prodSnap.exists()) {
          const pd = prodSnap.data();
          currentStock = Number(pd?.stock || 0);
        }
  const newStock = Math.max(0, currentStock - Number(form.quantity));

        // update product stock (use set with merge if doc missing)
        if (prodSnap.exists()) tx.update(prodRef, { stock: newStock });
        else tx.set(prodRef, { stock: newStock });

    // create new stocks doc with auto-id
  const stockRef = doc(collection(db, 'stocks'));
  tx.set(stockRef, payload);

        return stockRef.id;
      }).then((newStockDocId) => {
        try { addLog(actorUid, 'stock_out', `stocks/${newStockDocId}`, { productid: form.productid, quantity: Number(form.quantity) }); } catch (e) {}
      }).catch(e => {
        console.warn('stock out transaction failed', e);
      });
    } catch (e) {
      console.warn('stock out write skipped', e);
    }

    setModal(false);
  };

  const outs = data.stockMovements.filter(m => m.type === 'out');
  return (
    <div>
  <div className="row-space">
    <div><strong>Stock Out</strong></div>
  <div><button className="page-header-btn" onClick={isAdmin ? open : undefined} onKeyPress={e => { if (!isAdmin) e.preventDefault(); }} disabled={!isAdmin} title={!isAdmin ? 'Admin only' : ''}>＋ Stock Out</button></div>
  </div>
      <div className="card"><table><thead><tr><th>Product</th><th>Qty</th><th>Date</th><th>Reason</th></tr></thead><tbody>
        {[...outs].reverse().map(m => {
          const p = data.products.find(pp => pp.id === m.productid);
          return <tr key={m.id}><td>{p?.image} {p?.name}</td><td style={{ fontFamily: 'monospace' }}>{fmt(m.quantity)}</td><td style={{ color: '#666' }}>{m.date}</td><td>{m.ref}</td></tr>;
        })}
      </tbody></table></div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Record Stock Out</strong></div>
            <div className="modal-body">
              <div className="modal-form">
                <div className="form-group full">
                  <div className="form-label">Product</div>
                  <select ref={productRef} className="form-select" value={form.productid} onChange={e => setForm(f => ({ ...f, productid: e.target.value }))}>{data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                </div>

                <div className="two-col-grid">
                  <div>
                    <div className="form-label">Quantity</div>
                    <input className={`auth-input ${Number(form.quantity) <= 0 ? 'input-invalid' : ''}`} inputMode="numeric" step="1" type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                  </div>

                  <div>
                    <div className="form-label">Date</div>
                    <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                  </div>

                  <div className="col-span-all">
                    <div className="form-label">Reason</div>
                    <select className="form-select" value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))}>{reasons.map(r => <option key={r} value={r}>{r}</option>)}</select>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer"><button className="ghost" onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={save} disabled={!isAdmin || !(form.productid && Number(form.quantity) > 0)}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
