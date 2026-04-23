import React, { useState } from "react";
import { fmtRM } from "../utils";
import { db } from "../firebase";
import { collection, doc, runTransaction, Timestamp } from "firebase/firestore";
import { addLog } from "../logs";
import { currentUser } from "../auth";

export default function TikTokPage({ data, update, isAdmin = false }) {
  const [syncing, setSyncing] = useState(false);

  const simulateSync = () => {
    if (!isAdmin) { alert('Only Admin users can trigger a TikTok sync.'); return; }
    setSyncing(true);
    setTimeout(() => {
      update(d => {
        const prods = d.products;
        const rp = prods[Math.floor(Math.random() * prods.length)];
        if (!rp) return;
  const qty = Math.floor(Math.random() * 5) + 1;
        const oid = `TT${Date.now().toString().slice(-6)}`;
  d.orders.push({ id: oid, platform: 'TikTok', productid: rp.id, quantity: qty, price: rp.sellprice ?? rp.sellingPrice ?? 0, date: new Date().toISOString().slice(0,10), customer: 'Auto' });
  d.products = d.products.map(p => p.id === rp.id ? { ...p, stock: Math.max(0, (p.stock || 0) - qty) } : p);
        // Persist stock-out to Firestore
        const actorUid = currentUser()?.uid || null;
        if (actorUid) {
          try {
            runTransaction(db, async (tx) => {
              const prodRef = doc(db, 'products', rp.id);
              const prodSnap = await tx.get(prodRef);
              let currentStock = 0;
              if (prodSnap.exists()) {
                const pd = prodSnap.data();
                currentStock = Number(pd?.stock || 0);
              }
              const newStock = Math.max(0, currentStock - qty);
              if (prodSnap.exists()) tx.update(prodRef, { stock: newStock });
              else tx.set(prodRef, { stock: newStock });
              const stockRef = doc(collection(db, 'stocks'));
              tx.set(stockRef, { productid: rp.id, quantity: qty, reference: oid, transdate: Timestamp.fromDate(new Date()), transtype: 'out' });
              return stockRef.id;
            }).then((sid) => { try { addLog(actorUid, 'stock_out', `stocks/${sid}`, { productid: rp.id, quantity: qty }); } catch (e) {} }).catch(e => console.warn('tiktok stock out failed', e));
          } catch (e) { console.warn('tiktok stock out skipped', e); }
        }
      });
      setSyncing(false);
    }, 1200);
  };

  const tiktokOrders = data.orders.filter(o => o.platform === 'TikTok');
  const total = tiktokOrders.reduce((s,o) => s + ((o.quantity||o.qty||0)*(o.price||0)),0);

  return (
    <div>
      <div className="row-space">
        <div><strong>TikTok Shop</strong></div>
      <div><button className="page-header-btn" onClick={isAdmin ? simulateSync : undefined} disabled={!isAdmin || syncing} title={!isAdmin ? 'Admin only' : ''}>{syncing ? 'Syncing...' : 'Sync Now'}</button></div>
      </div>
      <div className="stats-grid mb-12">
        <div className="stat-card"><div className="stat-label">TikTok Orders</div><div className="stat-value">{tiktokOrders.length}</div></div>
        <div className="stat-card"><div className="stat-label">TikTok Revenue</div><div className="stat-value">{fmtRM(total)}</div></div>
      </div>
      <div className="card"><table><thead><tr><th>Order</th><th>Product</th><th>Qty</th><th>Amount</th><th>Date</th></tr></thead><tbody>
        {[...tiktokOrders].reverse().map(o => {
          const p = data.products.find(pp => pp.id === (o.productid || o.productId));
          const q = o.quantity ?? o.qty ?? 0;
          return <tr key={o.id}><td style={{ fontFamily:'monospace' }}>{o.id}</td><td>{p?.name}</td><td>{q}</td><td style={{ fontFamily:'monospace' }}>{fmtRM(q*o.price)}</td><td style={{ color:'#666' }}>{o.date}</td></tr>;
        })}
      </tbody></table></div>
    </div>
  );
}
