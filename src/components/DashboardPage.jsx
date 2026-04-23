import React from "react";
import MiniBar from "./MiniBar";
import { fmtRM } from "../utils";

export default function DashboardPage({ data, lowStockProducts = [] }) {
  const todaySales = 0;
  const totalStock = data.products.reduce((s, p) => s + (p.stock || 0), 0);
  const dailySales = [1200, 900, 2100, 1800, 3400, 2700, todaySales];

  return (
    <div>
      {lowStockProducts.length > 0 && (
        <div className="alert">⚠️ {lowStockProducts.length} product(s) need restocking</div>
      )}

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">Today's Sales</div><div className="stat-value">{fmtRM(todaySales)}</div></div>
        <div className="stat-card"><div className="stat-label">Total Inventory</div><div className="stat-value">{totalStock}</div></div>
        <div className="stat-card"><div className="stat-label">Products</div><div className="stat-value">{data.products.length}</div></div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-left">
          <div className="card fill-card"><h3>Sales Trend (Last 7 days)</h3><div className="card-body"><MiniBar data={dailySales} /></div></div>
        </div>
        <div className="dashboard-right">
          {/* Top Products moved to right column */}
          <div className="card"><h3>Top Products</h3>
            <div className="card-body">
              <ul>
                {data.products.slice(0,10).map(p => (
                  <li key={p.id} style={{ marginBottom: 8 }}>{p.image} <strong>{p.name}</strong> — {p.stock}</li>
                ))}
              </ul>
            </div>
          </div>
          {/* other right column widgets can follow here */}
        </div>
      </div>
    </div>
  );
}
