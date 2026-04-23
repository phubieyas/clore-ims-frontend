import React, { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, setDoc, doc, onSnapshot, deleteDoc } from "firebase/firestore";
import { addLog } from "../logs";
import { currentUser } from "../auth";

export default function UsersPage({ data, update, isAdmin }) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ uid: '', name: '', role: 'Staff', email: '' });
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // realtime listener for users collection
    const col = collection(db, 'users');
    const unsub = onSnapshot(col, (snap) => {
      const arr = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      setRemoteUsers(arr);
      setLoading(false);
    }, (err) => {
      console.warn('users onSnapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const open = () => { setForm({ uid: '', name: '', role: 'Staff', email: '' }); setModal(true); };

  const saveRemote = async () => {
    if (!isAdmin) { alert('Only Admin users can update users.'); return; }
    if (!form.uid) { alert('Please provide the user UID (from Firebase Auth)'); return; }
    try {
      await setDoc(doc(db, 'users', form.uid), { role: form.role, name: form.name, email: form.email });
      try { const uid = currentUser()?.uid || null; addLog(uid, 'update_user', `users/${form.uid}`, { role: form.role, email: form.email }); } catch (e) {}
      setModal(false);
    } catch (e) {
      console.error('saveRemote failed', e);
      alert('Save failed: ' + e.message);
    }
  };

  const deleteRemote = async (uid) => {
    if (!isAdmin) { alert('Only Admin users can remove user documents.'); return; }
    if (!confirm('Remove this user document from Firestore? This does not delete the Auth user.')) return;
    try { await deleteDoc(doc(db, 'users', uid)); } catch (e) { console.error(e); alert('Delete failed'); }
  };

  const deleteAndLog = async (uid) => {
    if (!isAdmin) { alert('Only Admin users can remove user documents.'); return; }
    if (!confirm('Remove this user document from Firestore? This does not delete the Auth user.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      try { const actor = currentUser()?.uid || null; addLog(actor, 'delete_user', `users/${uid}`, {}); } catch (e) {}
    } catch (e) { console.error(e); alert('Delete failed'); }
  };

  if (!isAdmin) {
    // non-admins see local users only
    return (
      <div>
        <div className="row-space">
          <div><strong>Users</strong></div>
        </div>
        <div className="modal-form">
          {data.users.map(u => (
            <div key={u.id} className="card card-padded">
              <div className="inline-row">
                <div className="avatar-sm">{u.name?.charAt(0)}</div>
                <div>
                  <div style={{ fontWeight:700 }}>{u.name}</div>
                  <div style={{ color:'#666', fontSize:12 }}>{u.email}</div>
                </div>
              </div>
              <div className="mt-8"><span className="badge">{u.role}</span></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row-space">
        <div>
          <strong>Users (Admin)</strong>
          <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{loading ? 'Loading users...' : `Remote users: ${remoteUsers.length}`}</div>
        </div>
  <div><button className="page-header-btn" onClick={isAdmin ? open : undefined} disabled={!isAdmin} title={!isAdmin ? 'Admin only' : ''}>＋ Add / Edit User</button></div>
      </div>

      <div className="card mb-12">
        <table>
          <thead><tr><th>UID</th><th>Email</th><th>Name</th><th>Role</th><th></th></tr></thead>
          <tbody>
            {remoteUsers.map(u => (
              <tr key={u.uid}><td style={{ fontFamily: 'monospace' }}>{u.uid}</td><td>{u.email}</td><td>{u.name}</td><td>{u.role}</td><td><button className="ghost" onClick={() => deleteAndLog(u.uid)}>Remove</button></td></tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><strong>Add / Edit User (Admin)</strong></div>
            <div className="modal-body">
              <div className="modal-form">
                <div className="form-group full">
                  <div className="form-label">Auth UID</div>
                  <input className="auth-input" autoFocus placeholder="Auth UID" value={form.uid} onChange={e => setForm(f => ({ ...f, uid: e.target.value }))} />
                  <div className="input-hint">The Firebase Auth UID (e.g. from the Auth user list).</div>
                </div>

                <div className="two-col-grid">
                  <div className="form-group">
                    <div className="form-label">Email</div>
                    <input className="auth-input" placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <div className="form-label">Name</div>
                    <input className="auth-input" placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </div>

                  <div className="form-group col-span-all">
                    <div className="form-label">Role</div>
                    <select className="auth-input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                      <option>Admin</option>
                      <option>Staff</option>
                      <option>Account</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer"><button className="ghost" onClick={() => setModal(false)}>Cancel</button><button className="primary" onClick={saveRemote} disabled={!isAdmin}>Save</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
