import React, { useState } from "react";
import { signIn, signOut } from "../auth";

export default function AuthPanel({ user, onSignedOut }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const doSignIn = async () => {
    setLoading(true); setError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e.message || String(e));
    } finally { setLoading(false); }
  };

  const doSignOut = async () => {
    await signOut();
    onSignedOut?.();
  };

  if (user) {
    return (
      <div className="auth-panel signed-in">
        <div className="signed-in-label">Signed in: <strong>{user.email || user.uid}</strong></div>
        <button className="btn" onClick={doSignOut}>Sign out</button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <input className="auth-input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
      <input className="auth-input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button className="btn" onClick={doSignIn} disabled={loading}>{loading ? 'Signing...' : 'Sign in'}</button>
      {error && <div className="auth-error">{error}</div>}
    </div>
  );
}
