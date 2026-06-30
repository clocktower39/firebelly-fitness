const test = require("node:test");
const assert = require("node:assert/strict");

const {
  PARAM_TYPES,
  CATEGORIES,
  TECHNIQUES,
  SCOPES,
  getTechnique,
  getTechniquesByCategory,
} = require("../services/techniqueRegistry");
const {
  validateParamValue,
  validateTechniqueParams,
  renderTechniqueDisplay,
  validateAttachment,
} = require("../services/techniqueValidation");

const PARAM_TYPE_VALUES = Object.values(PARAM_TYPES);
const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// ---------------------------------------------------------------------------
// Registry integrity — guards every definition so adding techniques stays safe
// ---------------------------------------------------------------------------

test("registry: keys are unique", () => {
  const keys = TECHNIQUES.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length, "duplicate technique key");
});

test("registry: every definition is well-formed", () => {
  for (const t of TECHNIQUES) {
    assert.ok(t.key && typeof t.key === "string", `${t.key}: key`);
    assert.ok(t.name && typeof t.name === "string", `${t.key}: name`);
    assert.ok(CATEGORY_KEYS.includes(t.category), `${t.key}: category "${t.category}" must exist`);
    assert.ok(SCOPES.includes(t.scope), `${t.key}: scope "${t.scope}" must be valid`);
    assert.ok(typeof t.description === "string" && t.description.length > 0, `${t.key}: description`);
    assert.ok(Array.isArray(t.params), `${t.key}: params array`);
    assert.ok(typeof t.displayFormat === "string" && t.displayFormat.length > 0, `${t.key}: displayFormat`);
    assert.ok(Number.isInteger(t.version), `${t.key}: version`);
  }
});

test("registry: every param is well-formed and defaults are valid", () => {
  for (const t of TECHNIQUES) {
    for (const p of t.params) {
      assert.ok(p.name && typeof p.name === "string", `${t.key}.${p.name}: name`);
      assert.ok(p.label && typeof p.label === "string", `${t.key}.${p.name}: label`);
      assert.ok(PARAM_TYPE_VALUES.includes(p.type), `${t.key}.${p.name}: type "${p.type}"`);
      if (p.type === PARAM_TYPES.ENUM) {
        assert.ok(Array.isArray(p.options) && p.options.length > 0, `${t.key}.${p.name}: enum options`);
        for (const o of p.options) {
          assert.ok("value" in o && "label" in o, `${t.key}.${p.name}: option {value,label}`);
        }
      }
      // A provided default must itself satisfy the param's own rules.
      if (p.default !== undefined) {
        const res = validateParamValue(p, p.default);
        assert.ok(res.ok, `${t.key}.${p.name}: default ${JSON.stringify(p.default)} invalid: ${res.error}`);
      }
    }
  }
});

test("registry: displayFormat tokens reference real params", () => {
  for (const t of TECHNIQUES) {
    const tokens = [...t.displayFormat.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const paramNames = new Set(t.params.map((p) => p.name));
    for (const tok of tokens) {
      assert.ok(paramNames.has(tok), `${t.key}: displayFormat token {${tok}} has no param`);
    }
  }
});

test("registry: helpers resolve", () => {
  assert.equal(getTechnique("dropSet").name, "Drop Set");
  assert.equal(getTechnique("nope"), null);
  assert.ok(getTechniquesByCategory("set").every((t) => t.category === "set"));
});

// ---------------------------------------------------------------------------
// validateTechniqueParams
// ---------------------------------------------------------------------------

test("params: applies defaults for omitted non-optional fields", () => {
  const r = validateTechniqueParams("dropSet", {});
  assert.ok(r.valid);
  assert.equal(r.value.drops, 2);
  assert.equal(r.value.reduction, 20);
  assert.equal("minWeight" in r.value, false, "optional absent param omitted");
});

test("params: enforces min/max", () => {
  assert.equal(validateTechniqueParams("dropSet", { drops: 99 }).valid, false);
  assert.equal(validateTechniqueParams("rir", { rir: 1 }).valid, true);
  assert.equal(validateTechniqueParams("rir", { rir: 9 }).valid, false);
});

test("params: drops unknown keys (no junk stored)", () => {
  const r = validateTechniqueParams("rir", { rir: 2, hackerField: "x" });
  assert.ok(r.valid);
  assert.deepEqual(r.value, { rir: 2 });
});

test("params: unknown technique fails", () => {
  assert.equal(validateTechniqueParams("ghost", {}).valid, false);
});

test("params: enum / tempo / bool / duration validation", () => {
  assert.equal(validateTechniqueParams("executionStyle", { style: "isometric" }).valid, true);
  assert.equal(validateTechniqueParams("executionStyle", { style: "moonwalk" }).valid, false);
  assert.equal(validateTechniqueParams("tempo", { tempo: "3-1-X-0" }).valid, true);
  assert.equal(validateTechniqueParams("tempo", { tempo: "3/1/1" }).valid, false);
  assert.equal(validateTechniqueParams("amrap", { failureAllowed: "yes" }).valid, false);
  assert.equal(validateTechniqueParams("restPeriod", { seconds: -5 }).valid, false);
  assert.equal(validateTechniqueParams("restPeriod", { seconds: 120 }).valid, true);
});

test("params: required-without-default errors when missing", () => {
  // toFailure has no params → always valid/empty
  const r = validateTechniqueParams("toFailure", {});
  assert.ok(r.valid);
  assert.deepEqual(r.value, {});
});

// ---------------------------------------------------------------------------
// renderTechniqueDisplay
// ---------------------------------------------------------------------------

test("display: substitutes params and fills defaults", () => {
  assert.equal(renderTechniqueDisplay("dropSet", { drops: 3, reduction: 15 }), "Drop set ×3 (−15%)");
  assert.equal(renderTechniqueDisplay("dropSet", {}), "Drop set ×2 (−20%)");
  assert.equal(renderTechniqueDisplay("rir", { rir: 1 }), "RIR 1");
  assert.equal(renderTechniqueDisplay("toFailure", {}), "To failure");
});

test("display: enum renders its label", () => {
  assert.equal(renderTechniqueDisplay("executionStyle", { style: "deadStop" }), "Dead-stop reps");
});

test("display: unknown technique renders empty", () => {
  assert.equal(renderTechniqueDisplay("ghost", {}), "");
});

// ---------------------------------------------------------------------------
// validateAttachment (what the server runs per technique on save)
// ---------------------------------------------------------------------------

test("attachment: valid attachment normalizes", () => {
  const r = validateAttachment({ key: "dropSet", appliesToSets: [2], params: { drops: 3, reduction: 25 } });
  assert.ok(r.valid, r.errors.join("; "));
  assert.deepEqual(r.value, {
    key: "dropSet",
    scope: "set",
    appliesToSets: [2],
    params: { drops: 3, reduction: 25 },
    notes: "",
  });
});

test("attachment: scope defaults from the definition", () => {
  assert.equal(validateAttachment({ key: "tempo", params: { tempo: "3-1-1-0" } }).value.scope, "exercise");
});

test("attachment: unknown key + bad appliesToSets fail", () => {
  assert.equal(validateAttachment({ key: "ghost" }).valid, false);
  assert.equal(validateAttachment({ key: "rir", appliesToSets: ["x"] }).valid, false);
  assert.equal(validateAttachment({ key: "rir", appliesToSets: [-1] }).valid, false);
});

test("attachment: notes truncate to 500 chars", () => {
  const r = validateAttachment({ key: "rir", params: { rir: 1 }, notes: "z".repeat(900) });
  assert.equal(r.value.notes.length, 500);
});
