import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

// Client access to the Exercise Technique registry (served by GET /techniques). The registry is small,
// static catalog data, so we fetch it once and cache at module scope. Used by the display chips (M2)
// and the technique builder drawer (M3).

const EMPTY = { categories: [], techniques: [], byKey: {} };

let cache = null;
let inflight = null;

const buildRegistry = (data) => {
  const techniques = Array.isArray(data?.techniques) ? data.techniques : [];
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    techniques,
    byKey: Object.fromEntries(techniques.map((t) => [t.key, t])),
  };
};

export const loadTechniqueRegistry = () => {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = apiFetch("/techniques")
      .then((data) => {
        cache = data && !data.error ? buildRegistry(data) : EMPTY;
        inflight = null;
        return cache;
      })
      .catch(() => {
        inflight = null;
        return EMPTY;
      });
  }
  return inflight;
};

export const useTechniqueRegistry = () => {
  const [registry, setRegistry] = useState(cache || EMPTY);
  useEffect(() => {
    let active = true;
    loadTechniqueRegistry().then((r) => {
      if (active) setRegistry(r);
    });
    return () => {
      active = false;
    };
  }, []);
  return registry;
};

const isMissing = (v) => v === undefined || v === null || v === "";

// Render a technique attachment's chip text from its definition's display template + params
// (defaults filled in; enum tokens render their label). Mirrors the server's renderer.
export const renderTechniqueDisplay = (registry, key, params = {}) => {
  const def = registry?.byKey?.[key];
  if (!def) return "";
  const input = params && typeof params === "object" ? params : {};
  return def.displayFormat
    .replace(/\{(\w+)\}/g, (_, name) => {
      const param = (def.params || []).find((p) => p.name === name);
      let v = input[name];
      if (isMissing(v) && param && param.default !== undefined) v = param.default;
      if (isMissing(v)) return "";
      if (param && param.type === "enum") {
        const opt = (param.options || []).find((o) => o.value === v);
        return opt ? opt.label : String(v);
      }
      return String(v);
    })
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Short "applies to" qualifier for a chip, given the exercise's total set count.
// "" = whole exercise; otherwise "last set" / "set 2" / "sets 1, 3".
export const appliesToLabel = (appliesToSets, totalSets) => {
  if (!Array.isArray(appliesToSets) || appliesToSets.length === 0) return "";
  const sorted = [...appliesToSets].sort((a, b) => a - b);
  if (totalSets && sorted.length === 1 && sorted[0] === totalSets - 1) return "last set";
  const human = sorted.map((i) => i + 1);
  return `${human.length > 1 ? "sets" : "set"} ${human.join(", ")}`;
};
