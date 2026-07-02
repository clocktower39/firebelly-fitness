const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const commentSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

// One Exercise Technique attachment (Exercise Technique System). `key` references
// services/techniqueRegistry.js; `params` is free-form here but is validated against that registry on
// save (Mongoose does not validate Mixed). See docs/exercise-technique-system-plan.md.
const techniqueSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    scope: { type: String, enum: ["exercise", "set"], default: "exercise" },
    appliesToSets: { type: [Number], default: [] },
    params: { type: mongoose.Schema.Types.Mixed, default: {} },
    result: { type: mongoose.Schema.Types.Mixed, default: null }, // client-logged technique result
    notes: { type: String, default: "" },
  },
  { _id: true }
);

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String },
    date: { type: Date },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    workoutType: { type: String, default: "Strength" },
    cardio: { type: Object, default: () => ({}) },
    sports: { type: Object, default: () => ({}) },
    category: { type: Array, required: true },
    training: {
      type: [
        [
          {
            exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
            exerciseType: { type: String },
            goals: {
              sets: { type: Number },
              minReps: { type: Array },
              maxReps: { type: Array },
              exactReps: { type: Array },
              weight: { type: Array },
              percent: { type: Array },
              seconds: { type: Array },
              oneRepMax: { type: Number },
            },
            achieved: {
              sets: { type: Number },
              reps: { type: Array },
              weight: { type: Array },
              percent: { type: Array },
              seconds: { type: Array },
            },
            feedback: {
              difficulty: { type: Number, min: 0, max: 2, default: 1 },
              comments: { type: [commentSchema], default: [], }
            },
            techniques: { type: [techniqueSchema], default: [] },
          },
        ],
      ],
      default: [
        [
          {
            exercise: "",
            exerciseType: "Reps",
            goals: {
              sets: 1,
              minReps: [0],
              maxReps: [0],
              exactReps: [0],
              weight: [0],
              percent: [0],
              seconds: [0],
            },
            achieved: {
              sets: 0,
              reps: [0],
              weight: [0],
              percent: [0],
              seconds: [0],
            },
          },
        ],
      ],
      required: true,
    },
    workoutFeedback: {
      difficulty: { type: Number, min: 0, max: 2, default: 1 },
      comments: { type: [commentSchema], default: [], }
    },
    queuePosition: {
      type: Number,
      default: 0,
    },
    programId: { type: mongoose.Schema.Types.ObjectId, ref: "Program", default: null },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    groupAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupProgramAssignment",
      default: null,
    },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
    isTemplate: { type: Boolean, default: false },
    complete: { type: Boolean, default: false },
    reminderSentAt: { type: Date, default: null }, // dedup: workout-day reminder
    overdueSentAt: { type: Date, default: null }, // dedup: overdue nudge
  },
  { minimize: false }
);

// Analytics: technique usage aggregation (multikey index on the nested attachment key).
trainingSchema.index({ "training.techniques.key": 1 });

trainingSchema.plugin(mongoosePaginate);

const Training = mongoose.model("Training", trainingSchema);
module.exports = Training;
