import dayjs from "dayjs";

// Parse text pasted from a spreadsheet (Excel / Google Sheets copy = TSV; CSV and
// multi-space columns also accepted) into session-import rows. Pure functions so the
// paste flow is unit-testable without the page.

const pad = (v) => String(v).padStart(2, "0");
// Round-trip validation (dayjs "strict" needs the customParseFormat plugin, which we don't
// load): an impossible date like Feb 30 either fails to parse or rolls over to a different
// day — both fail the format-back comparison.
const iso = (y, mo, d) => {
  const mm = Number(mo);
  const dd = Number(d);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const s = `${Number(y)}-${pad(mm)}-${pad(dd)}`;
  const parsed = dayjs(s);
  return parsed.isValid() && parsed.format("YYYY-MM-DD") === s ? s : null;
};

// "1/9/2026", "01-09-26", "2026-01-09", or "1/9" (year supplied by fallbackYear) → "YYYY-MM-DD".
export const parseDateCell = (cell, fallbackYear) => {
  const s = String(cell || "").trim();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return iso(m[1], m[2], m[3]);
  if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/))) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return iso(y, m[1], m[2]);
  }
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})$/)) && fallbackYear) return iso(fallbackYear, m[1], m[2]);
  return null;
};

// "$60", "60", "1,200.50" → Number; anything else → null.
export const parseMoneyCell = (cell) => {
  const s = String(cell || "").replace(/[$,\s]/g, "");
  if (!s || !/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
};

const METHOD_WORDS = [
  "cash",
  "zelle",
  "venmo",
  "cashapp",
  "cash app",
  "check",
  "card",
  "credit",
  "debit",
  "paypal",
  "ach",
  "apple pay",
  "stripe",
];
export const looksLikeMethod = (cell) => {
  const s = String(cell || "").toLowerCase().trim();
  return !!s && METHOD_WORDS.some((w) => s.includes(w));
};

// Pasted text → cell matrix. Tabs win (spreadsheet copy), then commas, then runs of 2+ spaces.
export const toMatrix = (text) => {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.replace(/\u00A0/g, " ")) // non-breaking spaces from spreadsheet copies
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const hasTabs = lines.some((l) => l.includes("\t"));
  const hasCommas = !hasTabs && lines.some((l) => l.includes(","));
  return lines.map((l) => {
    const cells = hasTabs ? l.split("\t") : hasCommas ? l.split(",") : l.split(/\s{2,}/);
    return cells.map((c) => c.trim());
  });
};

export const COLUMN_ROLES = ["date", "price", "method", "paymentDate", "ignore"];

// Guess each column's role by majority vote over its cells. First date-ish column is the
// session date; a second one is the payment date. Header rows vote for nothing and are
// naturally skipped later (their cells parse as no role).
export const detectRoles = (matrix, fallbackYear) => {
  if (!matrix.length) return [];
  const cols = Math.max(...matrix.map((r) => r.length));
  const roles = [];
  let dateTaken = false;
  let paymentDateTaken = false;
  let priceTaken = false;
  let methodTaken = false;
  for (let c = 0; c < cols; c += 1) {
    const cells = matrix.map((r) => r[c]).filter((x) => x != null && String(x).trim());
    const n = cells.length || 1;
    const dateVotes = cells.filter((x) => parseDateCell(x, fallbackYear)).length;
    const moneyVotes = cells.filter((x) => parseMoneyCell(x) != null).length;
    const methodVotes = cells.filter(looksLikeMethod).length;
    let role = "ignore";
    if (dateVotes / n >= 0.6) {
      if (!dateTaken) {
        role = "date";
        dateTaken = true;
      } else if (!paymentDateTaken) {
        role = "paymentDate";
        paymentDateTaken = true;
      }
    } else if (moneyVotes / n >= 0.6 && !priceTaken) {
      role = "price";
      priceTaken = true;
    } else if (methodVotes / n >= 0.5 && !methodTaken) {
      role = "method";
      methodTaken = true;
    }
    roles.push(role);
  }
  return roles;
};

// Matrix + role assignment → clean rows for the reconcile API. Rows with no parseable
// session date (headers, stray notes) are reported in `skipped`; duplicate dates keep the
// first occurrence and are counted in `deduped`.
export const buildRows = (matrix, roles, fallbackYear) => {
  const parsed = [];
  const skipped = [];
  for (const r of matrix) {
    const row = {};
    roles.forEach((role, i) => {
      const cell = r[i];
      if (role === "date") row.date = parseDateCell(cell, fallbackYear);
      else if (role === "paymentDate") {
        const d = parseDateCell(cell, fallbackYear);
        if (d) row.paymentDate = d;
      } else if (role === "price") {
        const v = parseMoneyCell(cell);
        if (v != null) row.price = v;
      } else if (role === "method" && cell) {
        row.method = String(cell).trim();
      }
    });
    if (row.date) parsed.push(row);
    else if (r.some((c) => String(c || "").trim())) skipped.push(r.join(" · "));
  }
  const seen = new Set();
  const rows = [];
  for (const row of parsed) {
    if (!seen.has(row.date)) {
      seen.add(row.date);
      rows.push(row);
    }
  }
  rows.sort((a, b) => (a.date < b.date ? -1 : 1));
  return { rows, skipped, deduped: parsed.length - rows.length };
};
