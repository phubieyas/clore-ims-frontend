import React, { useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react";
// data.js removed; use Firestore as canonical source for products
import Sidebar from "./components/Sidebar";
const DashboardPage = lazy(() => import("./components/DashboardPage"));
const ProductsPage = lazy(() => import("./components/ProductsPage"));
const PurchasesPage = lazy(() => import("./components/PurchasesPage"));
const StockInPage = lazy(() => import("./components/StockInPage"));
const StockOutPage = lazy(() => import("./components/StockOutPage"));
const TikTokPage = lazy(() => import("./components/TikTokPage"));
const DocumentsPage = lazy(() => import("./components/DocumentsPage"));
const UsersPage = lazy(() => import("./components/UsersPage"));
const LogsPage = lazy(() => import("./components/LogsPage"));
import { genId } from "./utils";
import { onAuthChange, checkAdmin } from "./auth";
import { db } from "./firebase";
import { collection, onSnapshot, doc as firestoreDoc } from "firebase/firestore";
import AuthPanel from "./components/Auth";
import { pendingCount } from "./pendingWrites";

export default function App() {
  const [page, setPage] = useState("dashboard");
  const DEFAULT_DATA = { products: [], purchases: [], stockMovements: [], orders: [], documents: [], users: [] };
  const [data, setData] = useState(DEFAULT_DATA);
  // no local persistence; all data is canonical in Firestore
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ ok: null, ts: null });
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(null);
  const [pendingWritesCount, setPendingWritesCount] = useState(0);
  const [accessDeniedTimeoutPassed, setAccessDeniedTimeoutPassed] = useState(false);

  useEffect(() => {
    // poll pending writes count so topbar can show queued write count
    const update = () => setPendingWritesCount(typeof pendingCount === 'function' ? pendingCount() : 0);
    update();
    const t = setInterval(update, 2000);
    return () => clearInterval(t);
  }, []);

  // debug fetch removed

  // access denied spinner: show waiting spinner up to 5s or until products are loaded
  useEffect(() => {
    // reset when user or admin status changes
    let t = null;
    setAccessDeniedTimeoutPassed(false);
    if (user && !isAdmin) {
      t = setTimeout(() => setAccessDeniedTimeoutPassed(true), 5000);
    } else {
      // if no user or already admin, allow immediate visibility
      setAccessDeniedTimeoutPassed(true);
    }
    return () => t && clearTimeout(t);
  }, [user, isAdmin]);

  // if products finish loading earlier, show the access-denied message immediately
  useEffect(() => {
    if (!productsLoading) setAccessDeniedTimeoutPassed(true);
  }, [productsLoading]);

  useEffect(() => {
    const h = (e) => {
      const count = e?.detail && typeof e.detail.count === 'number' ? e.detail.count : (typeof pendingCount === 'function' ? pendingCount() : 0);
      setPendingWritesCount(count);
    };
    window.addEventListener('clore:pendingChange', h);
    return () => window.removeEventListener('clore:pendingChange', h);
  }, []);

  useEffect(() => {
    const unsub = onAuthChange(async (u) => {
      setUser(u);
      if (u) {
        const ok = await checkAdmin(u.uid);
        setIsAdmin(ok);
      } else {
        setIsAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to user's doc so changes to their role (created in Console) update isAdmin immediately
  useEffect(() => {
    if (!user) return;
    let unsub = null;
    try {
      const ref = firestoreDoc(db, 'users', user.uid);
      unsub = onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          setIsAdmin(false);
          return;
        }
        const d = snap.data();
        setIsAdmin(d?.role === 'Admin');
      }, (err) => {
        console.warn('user doc onSnapshot error', err);
      });
    } catch (e) {
      console.warn('user doc subscription failed', e);
    }
    return () => unsub && unsub();
  }, [user]);

  // Subscribe to Firestore `products` collection and use it as the canonical product list
  // Subscribe only after auth is ready (user is non-null). Subscribing before auth can
  // cause permission-denied errors when rules require sign-in.
  useEffect(() => {
    let unsub = null;
    // If not signed in, clear products and mark as not-loading.
    if (!user) {
      setProductsLoading(false);
      setProductsError(null);
      setData(prev => ({ ...prev, products: [] }));
      return () => {};
    }

    setProductsLoading(true);
    setProductsError(null);
    try {
      const col = collection(db, 'products');
      unsub = onSnapshot(col, (snap) => {
        const products = snap.docs.map(d => {
          const raw = d.data() || {};
          // Use firestore field names as-is (lowercase preferred) — follow DB schema
          const lower = Object.entries(raw).reduce((acc, [k, v]) => { acc[k.toLowerCase()] = v; return acc; }, {});
          const product = {
            id: d.id,
            name: lower.name ?? raw.name ?? '',
            sku: lower.sku ?? raw.sku ?? '',
            category: lower.category ?? raw.category ?? 'Misc',
            costprice: lower.costprice ?? raw.costPrice ?? raw.costprice ?? 0,
            sellprice: lower.sellprice ?? raw.sellingPrice ?? raw.sellprice ?? 0,
            stock: lower.stock ?? raw.stock ?? 0,
            minstock: lower.minstock ?? raw.minStock ?? raw.minstock ?? 0,
            image: lower.image ?? raw.image ?? '🔖',
          };
          // include any extra original fields
          for (const [k, v] of Object.entries(raw)) {
            if (!(k in product) && !(k.toLowerCase() in product)) product[k] = v;
          }
          return product;
        });
        // merge into app data while preserving other fields
        setData(prev => ({ ...prev, products }));
        setProductsLoading(false);
        setProductsError(null);
      }, (err) => {
        console.warn('products subscription error', err);
        setProductsLoading(false);
        setProductsError(err?.message || String(err));
      });
    } catch (e) {
      console.warn('products subscription failed', e);
      setProductsLoading(false);
      setProductsError(e?.message || String(e));
    }
    return () => unsub && unsub();
  }, [user]);

  // Subscribe to Firestore `stocks` collection and use it as the canonical stock movements list
  useEffect(() => {
    // Only subscribe to stocks once the user is signed in to avoid permission-denied
    // errors from rules that require authentication.
    if (!user) {
      // clear any existing stock movements for signed-out users
      setData(prev => ({ ...prev, stockMovements: [] }));
      return () => {};
    }

    let unsub = null;
    try {
      const col = collection(db, 'stocks');
      unsub = onSnapshot(col, (snap) => {
        const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // normalize to local shape: type, productid, quantity, date, ref
        function fmtDateRaw(v) {
          if (!v && v !== 0) return '';
          // string (ISO) or simple date string
          if (typeof v === 'string') return v;
          // Date object
          if (v instanceof Date) return v.toISOString().slice(0,10);
          // Firestore Timestamp has toDate() or seconds/nanoseconds
          if (typeof v?.toDate === 'function') {
            try { return v.toDate().toISOString().slice(0,10); } catch (e) { /* fallthrough */ }
          }
          if (typeof v?.seconds === 'number') {
            try { return new Date(v.seconds * 1000).toISOString().slice(0,10); } catch (e) { /* fallthrough */ }
          }
          try { return String(v); } catch (e) { return '' }
        }

        const normalized = arr.map(s => ({
            id: s.id,
            type: (s.transtype || s.type || 'in'),
            productid: s.productid || s.productId || s.product || '',
            quantity: Number(s.quantity || s.qty || 0),
            date: fmtDateRaw(s.transdate || s.date || s.purcdate || ''),
            ref: s.reference || s.reason || s.invoice || ''
          }));
        setData(prev => ({ ...prev, stockMovements: normalized }));
      }, (err) => {
        console.warn('stocks subscription error', err);
      });
    } catch (e) {
      console.warn('stocks subscription failed', e);
    }
    return () => unsub && unsub();
  }, [user]);

  // no automatic saving of the full app state; individual components persist directly to Firestore

  const update = useCallback((fn) => setData((prev) => {
    if (!isAdmin) {
      alert('Only signed-in Admin users can modify data.');
      return prev;
    }
    const next = JSON.parse(JSON.stringify(prev));
    fn(next);
    return next;
  }), [isAdmin]);

  const lowStockProducts = useMemo(() => data.products.filter(p => p.stock <= (p.minstock || 0)), [data.products]);

  const pageProps = { data, update, lowStockProducts, isAdmin };

  const pageMap = {
    dashboard: <DashboardPage {...pageProps} />,
    products: <ProductsPage {...pageProps} />,
    purchases: <PurchasesPage {...pageProps} />,
    stockin: <StockInPage {...pageProps} />,
    stockout: <StockOutPage {...pageProps} />,
    tiktok: <TikTokPage {...pageProps} />,
    documents: <DocumentsPage {...pageProps} />,
    users: <UsersPage {...pageProps} />,
    logs: <LogsPage {...pageProps} />,
  };

  // decide main content based on auth/admin state
  let mainContent = null;
  if (!user) {
    mainContent = (
      <div style={{ padding: 24 }}>
        <h3>Access denied</h3>
        <p>Kindly login to continue.</p>
      </div>
    );
  } else if (user && !isAdmin) {
    // Signed-in but not Admin: allow read-only view after the brief spinner
    mainContent = (
      <div>
          {!accessDeniedTimeoutPassed ? (
          <div className="center-spinner-area">
            <div>
              <div className="center-spinner" aria-hidden={true}></div>
              <div className="center-spinner-label">Loading...</div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 12, marginBottom: 12 }}>
            <div className="read-only-banner">
              <div><strong>Read-only access</strong> — your account does not have Admin privileges. You can view data but cannot make changes.</div>
              <small>If you need write access, ask your administrator to grant you the Admin role.</small>
            </div>
          </div>
        )}
        {pageMap[page]}
      </div>
    );
  } else {
    mainContent = pageMap[page];
  }

  // If not signed-in show sign in panel. If signed-in but not admin, show access denied.
  return (
    <div className="app-root">
      <header className="topbar">
        <div className="topbar-left">
          <div className="top-logo">CLore IMS</div>
        </div>
        <div className="topbar-right">
          <div className="save-wrap" aria-hidden={true}>
            {/* Show only the colored dot icon for save status. Use title for accessibility. */}
            {saveStatus.ok === true && <span className="dot ok" title="Saved" />}
            {saveStatus.ok === false && <span className="dot fail" title="Save failed" />}
            {/* When saveStatus.ok is null, show nothing (no text). */}
          </div>
          {productsLoading && <div className="fetch-status loading">Loading products…</div>}
          {productsError && (
            <div className="fetch-error tooltip" aria-label="products-error" title={productsError}>
              <span className="fetch-error-icon" role="img" aria-hidden={true}>⚠️</span>
              <span className="tooltip-text">{productsError}</span>
            </div>
          )}
          {/* debug fetch removed */}
          {pendingWritesCount > 0 && (
            <div className="pending-indicator badge-amber" title={`${pendingWritesCount} pending writes`}>
              {pendingWritesCount} pending
            </div>
          )}
          <div className="auth-wrap">
            <AuthPanel user={user} onSignedOut={() => { setUser(null); setIsAdmin(false); }} />
          </div>
        </div>
      </header>
      {/* Sidebar stays visible always; main shows spinner / access denied or pages */}
      <Sidebar page={page} setPage={setPage} lowStockCount={lowStockProducts.length} />
      <main className="app-main">
        <Suspense fallback={<div style={{ padding: 24 }}>Loading page…</div>}>
          {mainContent}
        </Suspense>
      </main>
    </div>
  );
}
