const { CATEGORIES, TECHNIQUES } = require("../services/techniqueRegistry");

// Serve the Exercise Technique registry (categories + definitions) to the client. Pure static data;
// the client uses it to render display chips and to auto-generate the technique config form. When a
// DB-backed custom-technique registry is added later, this endpoint merges code + DB definitions and
// the client is unchanged.
const get_techniques = (req, res) => {
  res.send({ categories: CATEGORIES, techniques: TECHNIQUES });
};

module.exports = { get_techniques };
