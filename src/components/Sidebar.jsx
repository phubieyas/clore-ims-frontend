import React from "react";

const NAV = [
  { section: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: "📊" }] },
  { section: "Operations", items: [
    { id: "products", label: "Products", icon: "📦" },
    { id: "purchases", label: "Purchasing", icon: "🧾" },
    { id: "stockin", label: "Stock In", icon: "⬆️" },
    { id: "stockout", label: "Stock Out", icon: "⬇️" },
    { id: "tiktok", label: "TikTok Shop", icon: "🎵" },
  ] },
  { section: "Reports", items: [
    { id: "inventory", label: "Inventory", icon: "📚" },
    { id: "logs", label: "Logs", icon: "📝" },
  ] },
  { section: "System", items: [
    { id: "documents", label: "Documents", icon: "📁" },
    { id: "users", label: "User Access", icon: "👥" },
  ] },
];

export default function Sidebar({ page, setPage, lowStockCount = 0 }) {
  return (
    <aside className="sidebar">
      <div className="logo">CLore IMS</div>
      {NAV.map(s => (
        <div key={s.section} className="nav-section">
          <div className="nav-label">{s.section}</div>
          {s.items.map(i => (
            <div key={i.id} className={`nav-item ${page === i.id ? 'active' : ''}`} onClick={() => setPage(i.id)}>
              <span className="icon">{i.icon}</span>
              <span>{i.label}</span>
              {i.id === 'dashboard' && lowStockCount > 0 && <span className="badge">{lowStockCount}</span>}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}
