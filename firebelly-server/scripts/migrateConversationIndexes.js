// One-off migration: replace the old sparse-unique conversation indexes with PARTIAL-unique ones.
// A sparse unique index still indexes explicit nulls, so every groupId:null direct conversation
// (and directKey:null group) collided after the first. Run once per environment after deploying
// messaging Phase 1:   node scripts/migrateConversationIndexes.js
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.DBURL);
  const coll = mongoose.connection.db.collection("conversations");
  for (const name of ["groupId_1", "directKey_1"]) {
    try {
      await coll.dropIndex(name);
      console.log("dropped", name);
    } catch (e) {
      console.log("skip", name, "-", e.codeName || e.message);
    }
  }
  await coll.createIndex(
    { directKey: 1 },
    { unique: true, partialFilterExpression: { directKey: { $type: "string" } } }
  );
  await coll.createIndex(
    { groupId: 1 },
    { unique: true, partialFilterExpression: { groupId: { $type: "objectId" } } }
  );
  console.log("created partial-unique indexes for directKey + groupId");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
