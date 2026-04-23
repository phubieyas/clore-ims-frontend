import React, { useState, useRef, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { addLog } from "../logs";
import { enqueuePendingWrite } from "../pendingWrites";

export default function ProductsPage({ data, update, isAdmin }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: "", sku: "", category: "Hair Care", costprice: 0, sellprice: 0, minstock: 0, stock: 0, image: "🔖" });
  const [editId, setEditId] = useState(null);

  const openAdd = () => {
  setForm({ name: "", sku: "", category: "Hair Care", costprice: 0, sellprice: 0, minstock: 0, stock: 0, image: "🔖" });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (p) => {
    setForm({ name: p.name || '', sku: p.sku || '', category: p.category ?? 'Hair Care', costprice: p.costprice ?? p.costPrice ?? 0, sellprice: p.sellprice ?? p.sellingPrice ?? 0, minstock: p.minstock ?? p.minStock ?? 0, stock: p.stock ?? 0, image: p.image || '🔖' });
    setEditId(p.id);
    setModal(true);
  };

  const nameRef = useRef(null);
  useEffect(() => {
    if (modal) {
      // slight delay ensures the input is in the DOM
      setTimeout(() => {
        nameRef.current?.focus();
        if (editId) nameRef.current?.select();
      }, 0);
    }
  }, [modal, editId]);

  const save = () => {
    if (!isAdmin) { alert('Only Admin users can save products.'); return; }
    // final trim/normalise
    const payload = { ...form, name: (form.name || '').trim(), costprice: Math.round(Number(form.costprice || 0) * 100) / 100, sellprice: Math.round(Number(form.sellprice || 0) * 100) / 100, minstock: Number(form.minstock || 0), stock: Number(form.stock || 0) };
    if (editId) {
      update(d => {
        const i = d.products.findIndex(x => x.id === editId);
        if (i >= 0) d.products[i] = { ...d.products[i], ...payload };
      });
      payload.id = editId;
    } else {
      const newId = `P${Date.now().toString().slice(-6)}`;
      update(d => { d.products.push({ id: newId, ...payload }); });
      payload.id = newId;
    }
    // Persist product to Firestore products collection when signed-in
    try {
      const auth = getAuth();
      const uid = auth?.currentUser?.uid || null;
        if (uid && payload?.id) {
        // write product document by id
        setDoc(doc(db, 'products', payload.id), payload).then(() => {
          try { addLog(uid, editId ? 'edit_product' : 'add_product', `products/${payload.id}`, { name: payload.name }); } catch (e) {}
        }).catch(e => {
          console.warn('product write failed', e);
          try { alert('Failed to save product: ' + (e?.message || String(e))); } catch (er) {}
        });
      } else {
        // not signed-in; can't persist
        try { alert('You must be signed in as Admin to save products.'); } catch (er) {}
      }
    } catch (e) { console.warn('product firestore write skipped', e); }
    setModal(false);
    setEditId(null);
  };

  const skuPattern = /^[A-Z0-9-_]{2,20}$/i;
  const currencyPattern = /^\d+(?:\.\d{1,2})?$/;
  const skuValid = (form.sku || '').length === 0 ? false : skuPattern.test(form.sku);
  const costValid = String(form.costprice || '').length === 0 ? true : currencyPattern.test(String(form.costprice));
  const sellValid = String(form.sellprice || '').length === 0 ? true : currencyPattern.test(String(form.sellprice));
  const minValid = String(form.minstock || '').length === 0 ? true : /^\d+$/.test(String(form.minstock));
  const stockValid = String(form.stock || '').length === 0 ? true : /^\d+$/.test(String(form.stock));
  const imageValid = (() => {
    const v = (form.image || '').trim();
    if (!v) return true; // optional
    if (v.startsWith('http://') || v.startsWith('https://')) {
      try { new URL(v); return true; } catch (e) { return false; }
    }
    return true; // allow emoji or short text
  })();
  const isValid = (form.name || '').trim() !== '' && Number(form.costprice) >= 0 && Number(form.sellprice) >= 0 && Number(form.minstock) >= 0 && skuValid && costValid && sellValid && minValid && stockValid && imageValid;

  return (
    <div>
      <div className="row-space">
        <div><strong>Products</strong></div>
        <div><button className="page-header-btn" onClick={openAdd} disabled={!isAdmin} title={!isAdmin ? 'Admin only' : ''}>＋ Add</button></div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Stock</th></tr></thead>
          <tbody>
            {data.products.map(p => (
              <tr key={p.id} style={{ cursor: isAdmin ? 'pointer' : 'default' }} onClick={isAdmin ? () => openEdit(p) : undefined}><td>{p.image} {p.name}</td><td>{p.sku}</td><td>{p.category}</td><td>{p.stock}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>{editId ? 'Edit Product' : 'Add Product'}</strong></div>
            <div className="modal-body">
              <div className="modal-form">
                <div className="form-group full">
                  <div className="form-label">Name</div>
                  <input ref={nameRef} className={`auth-input ${!(form.name||'').trim() ? 'input-invalid' : ''}`} placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  {!(form.name||'').trim() && <div className="auth-error">Name is required</div>}
                </div>

                <div className="two-col-grid">
                  <div>
                    <div className="form-label">SKU</div>
                    <div className="tooltip">
                      <input className={`auth-input ${form.sku && !skuValid ? 'input-invalid' : ''}`} placeholder="SKU" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
                      <div className="tooltip-text">SKU should be 2–20 characters: letters, numbers, - or _</div>
                    </div>
                    {form.sku && !skuValid && <div className="auth-error">Invalid SKU (use letters, numbers, - or _)</div>}
                  </div>

                  <div>
                    <div className="form-label">Category</div>
                    <select className="auth-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      <option>Hair Care</option>
                      <option>Supplements</option>
                      <option>Skin Care</option>
                    </select>
                  </div>

                  <div>
                    <div className="form-label">Cost Price</div>
                    <input inputMode="decimal" step="0.01" className={`auth-input ${form.costprice !== '' && !costValid ? 'input-invalid' : ''}`} placeholder="Cost Price" type="number" min="0" value={form.costprice} onChange={e => setForm(f => ({ ...f, costprice: e.target.value }))} />
                    {!costValid && <div className="auth-error">Use 0 or positive number, max 2 decimals</div>}
                  </div>

                  <div>
                    <div className="form-label">Selling Price</div>
                    <input inputMode="decimal" step="0.01" className={`auth-input ${form.sellprice !== '' && !sellValid ? 'input-invalid' : ''}`} placeholder="Selling Price" type="number" min="0" value={form.sellprice} onChange={e => setForm(f => ({ ...f, sellprice: e.target.value }))} />
                    {!sellValid && <div className="auth-error">Use 0 or positive number, max 2 decimals</div>}
                  </div>

                  <div>
                    <div className="form-label">Min Stock</div>
                    <input inputMode="numeric" step="1" className={`auth-input ${form.minstock !== '' && !minValid ? 'input-invalid' : ''}`} placeholder="Min Stock" type="number" min="0" value={form.minstock} onChange={e => setForm(f => ({ ...f, minstock: e.target.value }))} />
                    {!minValid && <div className="auth-error">Whole number required (0 or greater)</div>}
                  </div>

                  <div>
                    <div className="form-label">Stock</div>
                    <input inputMode="numeric" step="1" className={`auth-input ${String(form.stock || '') !== '' && !stockValid ? 'input-invalid' : ''}`} placeholder="Stock on hand" type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                    {!stockValid && <div className="auth-error">Whole number required (0 or greater)</div>}
                  </div>

                  <div className="col-span-all">
                    <div className="form-label">Image</div>
                    <input className={`auth-input ${form.image && !imageValid ? 'input-invalid' : ''}`} placeholder="Image URL or emoji" value={form.image} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} />
                    {!imageValid && <div className="auth-error">Invalid image URL</div>}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer"><button className="ghost" onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={save} disabled={!isAdmin || !isValid}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
