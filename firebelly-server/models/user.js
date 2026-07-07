const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
require('dotenv').config();
const SALT_WORK_FACTOR = Number(process.env.SALT_WORK_FACTOR);

const UserSchema = new mongoose.Schema({
    email: { type: String, index: { unique: true, sparse: true } },
    username: { type: String, index: { unique: true, sparse: true } },
    usernameLower: { type: String, index: { unique: true, sparse: true } },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    isTrainer: { type: Boolean, default: false },
    password: { type: String, required: true },
    phoneNumber: { type: String },
    dateOfBirth: { type: Date },
    accountType: {
        type: String,
        enum: ["adult", "guardian", "teen", "child"],
        default: "adult",
    },
    ageBand: {
        type: String,
        enum: ["u13", "13_15", "16_17", "18_plus"],
        default: null,
    },
    coppaStatus: {
        type: String,
        enum: ["needs_consent", "consented", "denied"],
        default: null,
    },
    consentScope: {
        type: String,
        enum: ["collection_only", "collection_and_disclosure"],
        default: null,
    },
    saleShareOptIn: { type: Boolean, default: false },
    adPersonalizationAllowed: { type: Boolean, default: false },
    coppaConsent: {
        method: { type: String },
        scope: { type: String },
        consentedAt: { type: Date },
        guardianId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    height: { type: String },
    sex: { type: String, },
    gymBarcode: { type: String, },
    profilePicture: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "profilePictures.files"
    },
    themeMode: { type: String, required: true, default: 'light', },
    workoutWeightUnit: { type: String, enum: ['lbs', 'kg'], default: 'lbs' },
    defaultSessionLengthMinutes: { type: Number, default: 60, min: 5, max: 480 },
    favoriteSports: { type: [String], default: [] },
    favoriteYogaStyles: { type: [String], default: [] },
    favoritePilatesStyles: { type: [String], default: [] },
    workoutColors: { type: Object, default: () => ({}) },
    workoutTypeOrder: { type: [String], default: [] },
    dailyOverviewOrder: { type: [String], default: [] }, // ordered section keys for the daily overview page

    autoPaymentReminders: { type: Boolean, default: false },
    timezone: { type: String, default: "" }, // IANA tz, e.g. "America/New_York"; for local-time reminders
    notificationPrefs: {
      clientWorkoutCompleted: { type: Boolean, default: true }, // trainer: client finished a workout
      goalMet: { type: Boolean, default: true },
      workoutReminder: { type: Boolean, default: true },
      workoutReminderTime: { type: String, default: "08:00" }, // HH:MM in the user's local time (single mode)
      workoutReminderPerDay: { type: Boolean, default: false }, // use per-day times instead of the single time
      workoutReminderTimesByDay: { type: [String], default: [] }, // index 0=Sun..6=Sat; "" = fall back to single time
      workoutOverdue: { type: Boolean, default: true },
      workoutOverdueAfterMinutes: { type: Number, default: 180, min: 15, max: 1440 },
      sessionReminder: { type: Boolean, default: true },
      sessionReminderLeadMinutes: { type: Number, default: 120, min: 15, max: 1440 },
      measurementReminder: { type: Boolean, default: false },
      measurementCadence: {
        type: String,
        enum: ["WEEKLY", "MONTHLY", "QUARTERLY"],
        default: "MONTHLY",
      },
      readinessReminder: { type: Boolean, default: false }, // daily fatigue check-in reminder
      readinessReminderTime: { type: String, default: "08:00" },
    },
    lastMeasurementReminderAt: { type: Date, default: null }, // internal: measurement reminder dedup
    lastReadinessReminderAt: { type: Date, default: null }, // internal: readiness reminder dedup
    lastReadinessFlagAt: { type: Date, default: null }, // internal: low-readiness deload flag dedup
    customThemes: {
        type: [
            {
                id: { type: String, required: true },
                name: { type: String, required: true },
                colors: {
                    primary: { type: String, required: true },
                    secondary: { type: String, required: true },
                    backgroundDefault: { type: String, required: true },
                    backgroundPaper: { type: String, required: true },
                    textPrimary: { type: String, required: true },
                    textSecondary: { type: String, required: true },
                },
            },
        ],
        default: [],
    },
    weeklyFrequency: { type: Number, min: 1, max: 7 },
    preferredWorkoutDays: { type: [Number], default: [] },
    // --- Coaching-OS client Training Profile (structured intake for program generation) ---
    trainingExperience: { type: String, enum: ["", "beginner", "intermediate", "advanced"], default: "" },
    activityLevel: { type: String, enum: ["", "sedentary", "light", "moderate", "very_active"], default: "" },
    injuries: { type: [String], default: [] },
    mobilityRestrictions: { type: [String], default: [] },
    equipmentAccess: { type: [String], default: [] }, // vocab aligned to Exercise.equipment
    dislikedExercises: { type: [mongoose.Schema.Types.ObjectId], ref: "Exercise", default: [] },
    trainingProfile: {
      sleepHours: { type: Number, default: null },
      stressLevel: { type: String, enum: ["", "low", "moderate", "high"], default: "" },
      preferredStyle: { type: String, default: "" },
      aestheticFocus: { type: String, default: "" },
      notes: { type: String, default: "" },
      // Commitment / readiness (how ready + willing the client is to change).
      confidenceScore: { type: Number, min: 1, max: 10, default: null },
      willingnessToTrainDaysPerWeek: { type: Number, min: 0, max: 7, default: null },
      willingnessToChangeNutrition: { type: Number, min: 1, max: 10, default: null },
      willingnessToDoDislikedExercises: { type: Number, min: 1, max: 10, default: null },
      biggestObstacle: { type: String, default: "" },
      whatTheyAreNotWillingToChange: { type: String, default: "" },
    },
    verified: {
        isVerified: { type: Boolean, default: false },
        verificationToken: { type: String, default: null },
        verificationTokenExpires: { type: Date, default: null },
      },
    // Secret token for the read-only iCalendar (.ics) subscribe feed. Unguessable,
    // revocable, excluded from default queries.
    calendarFeedToken: { type: String, default: null, index: true, sparse: true, select: false },
    calendarFeedTokenCreatedAt: { type: Date, default: null },
}, { minimize: false })

UserSchema.pre('save', async function() {
    if (this.username) {
        this.usernameLower = this.username.toLowerCase();
    }

    if (!this.isModified('password')) return;

    const saltRounds = Number.isFinite(SALT_WORK_FACTOR) && SALT_WORK_FACTOR > 0 ? SALT_WORK_FACTOR : 10;
    this.password = await bcrypt.hash(this.password, saltRounds);
});

UserSchema.methods.comparePassword = function(candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', UserSchema);
module.exports = User;
