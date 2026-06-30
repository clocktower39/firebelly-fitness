// Validation + display rendering for Exercise Technique attachments, driven entirely by the
// declarative param schemas in techniqueRegistry.js. The client mirrors this logic for live form
// validation; the server is the authority and re-validates on every save (M1).

const { PARAM_TYPES, SCOPES, getTechnique } = require("./techniqueRegistry");

const TEMPO_RE = /^(\d{1,2}|[Xx])-(\d{1,2}|[Xx])-(\d{1,2}|[Xx])-(\d{1,2}|[Xx])$/;
const MAX_NOTES = 500;

const isMissing = (v) => v === undefined || v === null || v === "";

// Validate a single value against one param definition. Returns { ok, error, value }.
const validateParamValue = (param, raw) => {
  switch (param.type) {
    case PARAM_TYPES.INT: {
      const n = Number(raw);
      if (!Number.isInteger(n)) return { ok: false, error: `${param.name} must be a whole number` };
      if (param.min != null && n < param.min) return { ok: false, error: `${param.name} ≥ ${param.min}` };
      if (param.max != null && n > param.max) return { ok: false, error: `${param.name} ≤ ${param.max}` };
      return { ok: true, value: n };
    }
    case PARAM_TYPES.NUMBER: {
      const n = Number(raw);
      if (!Number.isFinite(n)) return { ok: false, error: `${param.name} must be a number` };
      if (param.min != null && n < param.min) return { ok: false, error: `${param.name} ≥ ${param.min}` };
      if (param.max != null && n > param.max) return { ok: false, error: `${param.name} ≤ ${param.max}` };
      return { ok: true, value: n };
    }
    case PARAM_TYPES.DURATION: {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) return { ok: false, error: `${param.name} must be seconds ≥ 0` };
      if (param.min != null && n < param.min) return { ok: false, error: `${param.name} ≥ ${param.min}s` };
      if (param.max != null && n > param.max) return { ok: false, error: `${param.name} ≤ ${param.max}s` };
      return { ok: true, value: n };
    }
    case PARAM_TYPES.BOOL:
      if (typeof raw !== "boolean") return { ok: false, error: `${param.name} must be true/false` };
      return { ok: true, value: raw };
    case PARAM_TYPES.ENUM: {
      const allowed = (param.options || []).map((o) => o.value);
      if (!allowed.includes(raw)) return { ok: false, error: `${param.name} must be one of ${allowed.join(", ")}` };
      return { ok: true, value: raw };
    }
    case PARAM_TYPES.TEMPO:
      if (typeof raw !== "string" || !TEMPO_RE.test(raw))
        return { ok: false, error: `${param.name} must look like 3-1-X-0` };
      return { ok: true, value: raw };
    case PARAM_TYPES.TEXT: {
      const s = String(raw);
      if (param.maxLength != null && s.length > param.maxLength)
        return { ok: false, error: `${param.name} ≤ ${param.maxLength} chars` };
      return { ok: true, value: s };
    }
    default:
      return { ok: false, error: `unknown param type ${param.type}` };
  }
};

// Validate a params object against a technique's schema. Applies defaults, drops unknown keys,
// returns { valid, errors[], value } where value is the clean, normalized params object to store.
const validateTechniqueParams = (key, params = {}) => {
  const def = getTechnique(key);
  if (!def) return { valid: false, errors: [`Unknown technique "${key}"`], value: {} };

  const errors = [];
  const value = {};
  const input = params && typeof params === "object" ? params : {};

  for (const param of def.params) {
    const provided = input[param.name];
    if (isMissing(provided)) {
      if (param.optional) continue; // omit absent optional params
      if (param.default !== undefined) {
        value[param.name] = param.default;
        continue;
      }
      errors.push(`${param.name} is required`);
      continue;
    }
    const res = validateParamValue(param, provided);
    if (!res.ok) errors.push(res.error);
    else value[param.name] = res.value;
  }
  // Unknown keys are intentionally dropped (kept out of `value`) so storage never accumulates junk.

  return { valid: errors.length === 0, errors, value };
};

// Render a technique's display chip text from its template + params (defaults filled in).
// Enum tokens render their option label; absent optional tokens render empty (and tidy up).
const renderTechniqueDisplay = (key, params = {}) => {
  const def = getTechnique(key);
  if (!def) return "";
  const input = params && typeof params === "object" ? params : {};

  const out = def.displayFormat.replace(/\{(\w+)\}/g, (_, name) => {
    const param = def.params.find((p) => p.name === name);
    let v = input[name];
    if (isMissing(v) && param && param.default !== undefined) v = param.default;
    if (isMissing(v)) return "";
    if (param && param.type === PARAM_TYPES.ENUM) {
      const opt = (param.options || []).find((o) => o.value === v);
      return opt ? opt.label : String(v);
    }
    return String(v);
  });
  // Collapse whitespace left by empty optional tokens.
  return out.replace(/\s{2,}/g, " ").trim();
};

// Validate a full attachment { key, scope?, appliesToSets?, params?, notes? }. This is what the
// server runs over each entry's techniques[] before persisting (M1). Returns { valid, errors, value }.
const validateAttachment = (attachment = {}) => {
  const errors = [];
  const def = getTechnique(attachment.key);
  if (!def) {
    return { valid: false, errors: [`Unknown technique "${attachment.key}"`], value: null };
  }

  const scope = attachment.scope || def.scope;
  if (!SCOPES.includes(scope)) errors.push(`Invalid scope "${scope}"`);

  let appliesToSets = [];
  if (attachment.appliesToSets !== undefined) {
    if (!Array.isArray(attachment.appliesToSets)) {
      errors.push("appliesToSets must be an array");
    } else {
      appliesToSets = attachment.appliesToSets;
      if (!appliesToSets.every((i) => Number.isInteger(i) && i >= 0))
        errors.push("appliesToSets must be non-negative set indices");
    }
  }

  const paramResult = validateTechniqueParams(attachment.key, attachment.params);
  errors.push(...paramResult.errors);

  const notes = typeof attachment.notes === "string" ? attachment.notes.slice(0, MAX_NOTES) : "";

  return {
    valid: errors.length === 0,
    errors,
    value: { key: def.key, scope, appliesToSets, params: paramResult.value, notes },
  };
};

module.exports = {
  validateParamValue,
  validateTechniqueParams,
  renderTechniqueDisplay,
  validateAttachment,
};
