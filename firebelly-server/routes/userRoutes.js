const express = require('express');
const userController = require('../controllers/userController');
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require('express-validation');
const { uploadProfilePicture } = require("../mygridfs");

const router = express.Router();

const loginValidate = {
    body: Joi.object({
        email: Joi.string()
            .required().email(),
        password: Joi.string()
            .required(),
    }),
}

const childLoginValidate = {
    body: Joi.object({
        username: Joi.string().required(),
        pin: Joi.string().required(),
    }),
}

const signupValidate = {
    body: Joi.object({
        firstName: Joi.string()
            .required(),
        lastName: Joi.string()
            .required(),
        email: Joi.string()
            .email()
            .required(),
        password: Joi.string()
            .regex(/[a-zA-Z0-9]{3,30}/)
            .required(),
        dateOfBirth: Joi.date()
            .optional(),
    }),
}

const updateUserValidate = {
    body: Joi.object({
        firstName: Joi.string().allow(""),
        lastName: Joi.string().allow(""),
        phoneNumber: Joi.string().allow(""),
        dateOfBirth: Joi.date(),
        height: Joi.string().allow(""),
        sex: Joi.string().allow(""),
        gymBarcode: Joi.string().allow(""),
        themeMode: Joi.string().allow(""),
        workoutWeightUnit: Joi.string().allow(""),
        defaultSessionLengthMinutes: Joi.number().integer().min(5).max(480),
        favoriteSports: Joi.array().items(Joi.string().allow("")),
        favoriteYogaStyles: Joi.array().items(Joi.string().allow("")),
        autoPaymentReminders: Joi.boolean(),
        timezone: Joi.string().allow(""),
        notificationPrefs: Joi.object({
          clientWorkoutCompleted: Joi.boolean(),
          goalMet: Joi.boolean(),
          workoutReminder: Joi.boolean(),
          workoutReminderTime: Joi.string().allow(""),
          workoutReminderPerDay: Joi.boolean(),
          workoutReminderTimesByDay: Joi.array().items(Joi.string().allow("")),
          workoutOverdue: Joi.boolean(),
          workoutOverdueAfterMinutes: Joi.number().integer().min(15).max(1440),
          sessionReminder: Joi.boolean(),
          sessionReminderLeadMinutes: Joi.number().integer().min(15).max(1440),
          measurementReminder: Joi.boolean(),
          measurementCadence: Joi.string().valid("WEEKLY", "MONTHLY", "QUARTERLY"),
          readinessReminder: Joi.boolean(),
          readinessReminderTime: Joi.string().allow(""),
        }).unknown(false),
        customThemes: Joi.object().unknown(true),
        weeklyFrequency: Joi.number(),
        preferredWorkoutDays: Joi.array().items(Joi.number().integer().min(0).max(6)),
    }).min(1),
}

const changePasswordValidate = {
    body: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(8).required(),
    }),
}

router.get('/checkAuthToken', verifyAccessToken, userController.checkAuthLoginToken);
router.post('/login', validate(loginValidate, {}, {}), userController.login_user);
router.post('/login-child', validate(childLoginValidate, {}, {}), userController.login_child);
router.post('/signup', validate(signupValidate, {}, {}), userController.signup_user);
router.get('/verify-email', userController.verify_email);
router.post('/resend-verification-email', userController.resend_verification_email);
router.get('/trainers', verifyAccessToken, userController.get_trainers);
router.post('/updateUser', validate(updateUserValidate, {}, {}), verifyAccessToken, ensureWriteAccess, userController.update_user);
router.post('/getUser', verifyAccessToken, userController.get_userInfo);
router.get('/public/trainer/:id', userController.get_public_trainer_info);
router.post('/changePassword', validate(changePasswordValidate, {}, {}), verifyAccessToken, ensureWriteAccess, userController.change_password);
router.post('/user/upload/profilePicture', verifyAccessToken, ensureWriteAccess, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', verifyAccessToken, ensureWriteAccess, userController.delete_profile_picture);
router.post("/refresh-tokens", userController.refresh_tokens);
router.post("/logout", userController.logout_user);

module.exports = router;
