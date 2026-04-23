export const fmt = (n) => new Intl.NumberFormat("en-MY").format(n || 0);
export const fmtRM = (n) => `RM ${fmt(n)}`;
export const genId = (prefix) => `${prefix}${String(Date.now()).slice(-4)}`;