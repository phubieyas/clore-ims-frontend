import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const q = query(collection(db, "logs"), orderBy("ts", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(arr);
      setLoading(false);
    }, (err) => {
      console.warn('logs onSnapshot error', err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!filter.trim()) return logs;
    const q = filter.toLowerCase();
    return logs.filter(l => (
      (l.actorUid || "").toLowerCase().includes(q) ||
      (l.action || "").toLowerCase().includes(q) ||
      (l.target || "").toLowerCase().includes(q) ||
      JSON.stringify(l.metadata || {}).toLowerCase().includes(q)
    ));
  }, [logs, filter]);

  return (
    <div>
      <div className="row-space">
        <div><strong>Audit Logs</strong></div>
        <div className="inline-row">
          <input placeholder="Search actor/action/target..." value={filter} onChange={e => setFilter(e.target.value)} />
        </div>
      </div>

      <div className="card">
        {loading ? <div>Loading...</div> : (
          <table>
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Metadata</th></tr></thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'monospace' }}>{l.ts?.toDate ? l.ts.toDate().toLocaleString() : (l.ts || '').toString()}</td>
                  <td style={{ fontFamily: 'monospace' }}>{l.actorUid}</td>
                  <td>{l.action}</td>
                  <td>{l.target}</td>
                  <td style={{ fontFamily: 'monospace', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{JSON.stringify(l.metadata || {})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
