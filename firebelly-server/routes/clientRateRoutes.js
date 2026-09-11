const express = require("express");
const clientRateController = require("../controllers/clientRateController");
const reconciliationController = require("../controllers/reconciliationController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();
const objectId = Joi.string().hex().length(24);

const ratesForClientValidate = {
  body: Joi.object({ clientId: objectId.allow(null, "").optional() }),
};

const setRateValidate = {
  body: Joi.object({
    clientId: objectId.required(),
    sessionTypeId: objectId.required(),
    // null/"" clears the override and returns the client to list price.
    price: Joi.number().min(0).allow(null, "").required(),
    note: Joi.string().allow("").max(200).optional(),
  }),
};

router.post("/clientRates/forClient", validate(ratesForClientValidate, {}, {}), verifyAccessToken, clientRateController.rates_for_client);
router.post("/clientRates/set", validate(setRateValidate, {}, {}), verifyAccessToken, ensureWriteAccess, clientRateController.set_client_rate);
router.get("/clientRates", verifyAccessToken, clientRateController.list_client_rates);

const sessionLedgerValidate = {
  body: Joi.object({
    clientId: objectId.required(),
    from: Joi.date().allow(null, "").optional(),
    to: Joi.date().allow(null, "").optional(),
  }),
};

// Billing reconciliation — does each client's credit balance match billed-minus-taken?
router.get("/billing/reconciliation", verifyAccessToken, reconciliationController.reconciliation_report);
router.post("/billing/sessionLedger", validate(sessionLedgerValidate, {}, {}), verifyAccessToken, reconciliationController.client_session_ledger);

module.exports = router;
