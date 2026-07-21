// Small CSV helpers shared by the income report and Session History exports.
// A column is { label, get: (row) => value }.

export const csvCell = (v) => {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const buildCsv = (columns, rows) => {
  const header = columns.map((c) => c.label).join(",");
  const body = rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(",")).join("\n");
  return `${header}\n${body}`;
};

export const downloadCsv = (filename, text) => {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
