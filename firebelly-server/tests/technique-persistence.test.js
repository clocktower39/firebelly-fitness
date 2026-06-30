const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const { sanitizeTrainingTechniques } = require("../services/techniqueValidation");
const Training = require("../models/training");

const oid = () => new mongoose.Types.ObjectId();

// ---------------------------------------------------------------------------
// sanitizeTrainingTechniques — the server's integrity guard on save
// ---------------------------------------------------------------------------

test("sanitize: normalizes valid techniques (params + scope from registry)", () => {
  const training = [
    [
      {
        exercise: "ex1",
        techniques: [{ key: "dropSet", appliesToSets: [2], params: { drops: 3, reduction: 15 } }],
      },
    ],
  ];
  const out = sanitizeTrainingTechniques(training);
  const t = out[0][0].techniques[0];
  assert.equal(t.key, "dropSet");
  assert.equal(t.scope, "set"); // pulled from the definition
  assert.deepEqual(t.appliesToSets, [2]);
  assert.deepEqual(t.params, { drops: 3, reduction: 15 });
});

test("sanitize: drops invalid techniques (unknown key, bad params)", () => {
  const training = [
    [
      {
        exercise: "ex1",
        techniques: [
          { key: "ghost" }, // unknown → dropped
          { key: "rir", params: { rir: 99 } }, // out of range → dropped
          { key: "rir", params: { rir: 1 } }, // valid → kept
        ],
      },
    ],
  ];
  const out = sanitizeTrainingTechniques(training);
  assert.equal(out[0][0].techniques.length, 1);
  assert.equal(out[0][0].techniques[0].key, "rir");
});

test("sanitize: applies param defaults", () => {
  const out = sanitizeTrainingTechniques([[{ exercise: "x", techniques: [{ key: "dropSet" }] }]]);
  assert.deepEqual(out[0][0].techniques[0].params, { drops: 2, reduction: 20 });
});

test("sanitize: leaves entries without techniques untouched", () => {
  const entry = { exercise: "x", goals: { sets: 3 } };
  const out = sanitizeTrainingTechniques([[entry]]);
  assert.deepEqual(out[0][0], entry);
});

test("sanitize: safe on empty / non-array input", () => {
  assert.deepEqual(sanitizeTrainingTechniques([]), []);
  assert.equal(sanitizeTrainingTechniques(undefined), undefined);
  assert.deepEqual(sanitizeTrainingTechniques([[]]), [[]]);
});

test("sanitize: does not mutate the input", () => {
  const training = [[{ exercise: "x", techniques: [{ key: "rir", params: { rir: 1 } }] }]];
  const snapshot = JSON.stringify(training);
  sanitizeTrainingTechniques(training);
  assert.equal(JSON.stringify(training), snapshot);
});

// ---------------------------------------------------------------------------
// Schema — techniques[] is declared on the exercise entry and preserved
// (Mongoose silently drops UNDECLARED fields on save, so this guards the field's existence)
// ---------------------------------------------------------------------------

test("schema: techniques[] is declared, cast, and defaulted on the exercise entry", () => {
  const doc = new Training({
    user: oid(),
    category: ["chest"],
    training: [
      [
        {
          exercise: oid(),
          exerciseType: "Reps",
          techniques: [{ key: "dropSet", appliesToSets: [2], params: { drops: 3, reduction: 15 } }],
        },
      ],
    ],
  });
  const t = doc.training[0][0].techniques[0];
  assert.equal(t.key, "dropSet");
  assert.equal(t.scope, "exercise"); // schema default (sanitize sets the registry scope on save)
  assert.deepEqual(t.appliesToSets.toObject ? t.appliesToSets.toObject() : t.appliesToSets, [2]);
  assert.equal(t.params.drops, 3); // Mixed params preserved
  assert.ok(t._id); // subdoc gets an _id (stable handle for edits/analytics)
});

test("schema: entry without techniques defaults to []", () => {
  const doc = new Training({
    user: oid(),
    category: ["x"],
    training: [[{ exercise: oid(), exerciseType: "Reps" }]],
  });
  const techniques = doc.training[0][0].techniques;
  assert.equal(Array.isArray(techniques.toObject ? techniques.toObject() : techniques), true);
  assert.equal(techniques.length, 0);
});
