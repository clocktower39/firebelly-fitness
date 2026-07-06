const jwt = require("jsonwebtoken");
const { isAdmin } = require("../utils/admin");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const hasOverride = (overrides, key) =>
  Object.prototype.hasOwnProperty.call(overrides, key);

const buildTokenPayload = (user, overrides = {}) => {
  const payload = {
  _id: user._id,
  email: user.email || null,
  username: user.username || null,
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  phoneNumber: user.phoneNumber || null,
  dateOfBirth: user.dateOfBirth || null,
  height: user.height || null,
  sex: user.sex || null,
  gymBarcode: user.gymBarcode || null,
  profilePicture: user.profilePicture || null,
  themeMode: user.themeMode || "light",
  workoutWeightUnit: user.workoutWeightUnit === "kg" ? "kg" : "lbs",
  defaultSessionLengthMinutes: user.defaultSessionLengthMinutes || 60,
  favoriteSports: Array.isArray(user.favoriteSports) ? user.favoriteSports : [],
  favoriteYogaStyles: Array.isArray(user.favoriteYogaStyles) ? user.favoriteYogaStyles : [],
  favoritePilatesStyles: Array.isArray(user.favoritePilatesStyles) ? user.favoritePilatesStyles : [],
  workoutColors: user.workoutColors && typeof user.workoutColors === "object" ? user.workoutColors : {},
  workoutTypeOrder: Array.isArray(user.workoutTypeOrder) ? user.workoutTypeOrder : [],
  dailyOverviewOrder: Array.isArray(user.dailyOverviewOrder) ? user.dailyOverviewOrder : [],
  autoPaymentReminders: user.autoPaymentReminders === true,
  timezone: user.timezone || "",
  notificationPrefs: user.notificationPrefs || {},
  customThemes: user.customThemes || [],
  weeklyFrequency: user.weeklyFrequency || null,
  preferredWorkoutDays: user.preferredWorkoutDays || [],
  trainingExperience: user.trainingExperience || "",
  activityLevel: user.activityLevel || "",
  injuries: Array.isArray(user.injuries) ? user.injuries : [],
  mobilityRestrictions: Array.isArray(user.mobilityRestrictions) ? user.mobilityRestrictions : [],
  equipmentAccess: Array.isArray(user.equipmentAccess) ? user.equipmentAccess : [],
  dislikedExercises: Array.isArray(user.dislikedExercises) ? user.dislikedExercises : [],
  trainingProfile: user.trainingProfile || {},
  isTrainer: hasOverride(overrides, "isTrainer")
    ? Boolean(overrides.isTrainer)
    : Boolean(user.isTrainer),
  isAdmin: isAdmin(user),
  accountType: user.accountType || "adult",
  ageBand: user.ageBand || null,
  coppaStatus: user.coppaStatus || null,
  consentScope: user.consentScope || null,
  saleShareOptIn: Boolean(user.saleShareOptIn),
  adPersonalizationAllowed: Boolean(user.adPersonalizationAllowed),
  viewOnly: Boolean(overrides.viewOnly),
  guardianId: overrides.guardianId || null,
  trainerId: overrides.trainerId || null,
  actingUserId: overrides.actingUserId || null,
  actingUserRole: overrides.actingUserRole || null,
  delegationMode: overrides.delegationMode || null,
  canModifyViewedAccount: Boolean(overrides.canModifyViewedAccount),
  viewedUserId: overrides.viewedUserId || null,
  scope: overrides.scope || null,
  };
  // For a delegated "view-as" token, don't expose the viewed account's PII to the acting user,
  // and never carry admin powers into a delegated session.
  if (overrides.delegationMode) {
    payload.isAdmin = false;
    payload.email = null;
    payload.phoneNumber = null;
    payload.dateOfBirth = null;
    payload.height = null;
    payload.sex = null;
    payload.gymBarcode = null;
  }
  return payload;
};

const createAccessToken = (user, overrides = {}, options = {}) => {
  const payload = buildTokenPayload(user, overrides);
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: options.expiresIn || "60m",
  });
};

module.exports = {
  buildTokenPayload,
  createAccessToken,
};
