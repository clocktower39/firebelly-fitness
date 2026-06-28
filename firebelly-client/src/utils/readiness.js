// Daily readiness check-in factors. 1-5 scales. For sleep/mood/energy higher is better; for
// soreness/jointPain higher is worse (the score inverts those). lowLabel/highLabel describe the
// 1 and 5 ends for the UI.
export const READINESS_FACTORS = [
  { key: "sleep", label: "Sleep", lowLabel: "Poor", highLabel: "Great", invert: false },
  { key: "mood", label: "Mood", lowLabel: "Low", highLabel: "Great", invert: false },
  { key: "energy", label: "Energy", lowLabel: "Drained", highLabel: "Energized", invert: false },
  { key: "soreness", label: "Soreness", lowLabel: "None", highLabel: "Very sore", invert: true },
  { key: "jointPain", label: "Joint pain", lowLabel: "None", highLabel: "Severe", invert: true },
];

// Composite readiness score 0-100 (higher = more ready), averaged over the factors that were
// filled in. Returns null if nothing's been rated.
export const computeReadinessScore = (entry) => {
  if (!entry) return null;
  const vals = READINESS_FACTORS.map((f) => {
    const v = Number(entry[f.key]);
    if (!Number.isFinite(v) || v < 1) return null;
    return f.invert ? 6 - v : v;
  }).filter((v) => v != null);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 20);
};

// A coarse band for color/labeling.
export const readinessBand = (score) => {
  if (score == null) return { label: "—", color: "default" };
  if (score >= 75) return { label: "Ready", color: "success" };
  if (score >= 50) return { label: "Moderate", color: "warning" };
  return { label: "Low", color: "error" };
};

// The local "day key" used to match today's entry (YYYY-MM-DD).
export const dayKey = (d = new Date()) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
};
