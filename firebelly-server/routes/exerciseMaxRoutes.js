const express = require("express");
const exerciseMaxController = require("../controllers/exerciseMaxController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const forUserValidate = {
  body: Joi.object({ clientId: objectId.allow(null, "").optional() }),
};

const setValidate = {
  body: Joi.object({
    clientId: objectId.allow(null, "").optional(),
    exerciseId: objectId.required(),
    // null/"" clears the stored max.
    value: Joi.number().min(0).max(2000).allow(null, "").required(),
    testedAt: Joi.date().allow(null, "").optional(),
    source: Joi.string().valid("tested", "estimated", "entered").optional(),
    note: Joi.string().allow("").max(300).optional(),
  }),
};

router.post("/exerciseMaxes/forUser", validate(forUserValidate, {}, {}), verifyAccessToken, exerciseMaxController.maxes_for_user);
router.post("/exerciseMaxes/set", validate(setValidate, {}, {}), verifyAccessToken, ensureWriteAccess, exerciseMaxController.set_max);
router.get("/exerciseMaxes", verifyAccessToken, exerciseMaxController.list_my_maxes);

module.exports = router;
