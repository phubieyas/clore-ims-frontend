import React from "react";

export default function MiniBar({ data = [], height = 48, color = '#5B5CFF' }) {
  const max = Math.max(...data, 1);
  return (
    <div className="mini-bar" style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="mini-bar-item" style={{ height: `${(v / max) * 100}%`, background: color }} />
      ))}
    </div>
  );
}
