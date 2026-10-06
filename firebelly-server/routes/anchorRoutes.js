const express = require("express");
const anchorController = require("../controllers/anchorController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const forExerciseValidate = {
  body: Joi.object({
    clientId: objectId.required(),
    programId: objectId.required(),
    exerciseId: objectId.required(),
  }),
};

const setValidate = {
  body: Joi.object({
    clientId: objectId.required(),
    programId: objectId.required(),
    exerciseId: objectId.required(),
    // null/"" = not established yet; the first completed earning-day session sets it
    working: Joi.number().min(0).allow(null, "").optional(),
    unit: Joi.string().valid("weight", "reps", "seconds").optional(),
    rule: Joi.string().valid("feedback", "weekly", "earned", "hold").optional(),
    step: Joi.number().min(0).allow(null, "").optional(),
    ceiling: Joi.number().min(0).allow(null, "").optional(),
    earnsOnDay: Joi.number().integer().min(1).max(7).allow(null, "").optional(),
    slots: Joi.array()
      .items(Joi.object({
        day: Joi.number().integer().min(1).max(7).required(),
        percentOfAnchor: Joi.number().min(0).max(500).allow(null, "").required(),
        applyTo: Joi.string().valid("top", "all").optional(),
      }))
      .optional(),
  }),
};

router.post("/anchors/forExercise", validate(forExerciseValidate, {}, {}), verifyAccessToken, anchorController.anchor_for_exercise);
router.post("/anchors/set", validate(setValidate, {}, {}), verifyAccessToken, ensureWriteAccess, anchorController.set_anchor);
router.post("/anchors/clear", validate(forExerciseValidate, {}, {}), verifyAccessToken, ensureWriteAccess, anchorController.clear_anchor);

module.exports = router;
