const express = require("express");
const productController = require("../controllers/productController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();

const objectId = Joi.string().hex().length(24);
const itemType = Joi.string().valid("SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM");
const currency = Joi.string().valid("USD", "EUR", "JPY");
const deliverableType = Joi.string().valid("NONE", "FILE", "LINK", "MESSAGE");

const productFields = {
  itemType: itemType.optional(),
  name: Joi.string().trim().min(1).max(160).optional(),
  description: Joi.string().trim().allow("").max(2000).optional(),
  price: Joi.number().min(0).optional(),
  currency: currency.optional(),
  taxable: Joi.boolean().optional(),
  active: Joi.boolean().optional(),
  sessionTypeId: objectId.allow(null).optional(),
  creditsPerUnit: Joi.number().min(0).optional(),
  deliverableType: deliverableType.optional(),
  deliverableValue: Joi.string().trim().allow("").max(2000).optional(),
};

const createProductValidate = {
  body: Joi.object({
    ...productFields,
    name: productFields.name.required(),
    sessionTypeId: Joi.when("itemType", {
      is: "SESSION",
      then: objectId.required(),
      otherwise: objectId.allow(null).optional(),
    }),
  }),
};

const updateProductValidate = {
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object(productFields).min(1),
};

const productIdValidate = {
  params: Joi.object({
    id: objectId.required(),
  }),
};

router.get("/products", verifyAccessToken, productController.list_products);
router.post(
  "/products",
  validate(createProductValidate, {}, {}),
  verifyAccessToken,
  ensureWriteAccess,
  productController.create_product
);
router.put(
  "/products/:id",
  validate(updateProductValidate, {}, {}),
  verifyAccessToken,
  ensureWriteAccess,
  productController.update_product
);
router.delete(
  "/products/:id",
  validate(productIdValidate, {}, {}),
  verifyAccessToken,
  ensureWriteAccess,
  productController.delete_product
);

module.exports = router;
