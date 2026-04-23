import React, { useState } from "react";

export default function DocumentsPage({ data, update, isAdmin = false }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'Invoice', date: new Date().toISOString().slice(0,10), ref: '' });

  const open = () => { setForm({ name: '', type: 'Invoice', date: new Date().toISOString().slice(0,10), ref: '' }); setModal(true); };
  const save = () => {
    if (!isAdmin) { alert('Only Admin users can add documents.'); return; }
    if (!(form.name || '').trim()) { alert('Name is required'); return; }
    update(d => { d.documents.push({ id: `D${Date.now().toString().slice(-6)}`, ...form }); });
    setModal(false);
  };

  return (
    <div>
  <div className="row-space">
    <div><strong>Documents</strong></div>
  <div><button className="page-header-btn" onClick={isAdmin ? open : undefined} disabled={!isAdmin} title={!isAdmin ? 'Admin only' : ''}>＋ Add Document</button></div>
  </div>
      <div className="card"><table><thead><tr><th>Document</th><th>Type</th><th>Date</th><th>Ref</th></tr></thead><tbody>
        {data.documents.map(d => <tr key={d.id}><td style={{ fontWeight:600 }}>{d.name}</td><td>{d.type}</td><td>{d.date}</td><td style={{ fontFamily:'monospace', color:'#666' }}>{d.ref}</td></tr>)}
      </tbody></table></div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Add Document</strong></div>
            <div className="modal-body">
              <div className="modal-form">
                <input className="form-input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <select className="form-select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}><option>Invoice</option><option>Report</option></select>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                <input className="form-input" placeholder="Reference" value={form.ref} onChange={e => setForm(f => ({ ...f, ref: e.target.value }))} />
              </div>
            </div>
            <div className="modal-footer"><button className="ghost" onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={save} disabled={!isAdmin || !(form.name || '').trim()}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
