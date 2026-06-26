// Scheduled reminder sweeps (setInterval, like pastDueJob). Phase 1: pre-session reminders.
// Workout / overdue / measurement sweeps will be added here next.
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const ScheduleEvent = require("../models/scheduleEvent");
const Training = require("../models/training");
const User = require("../models/user");
const { createNotification } = require("./notificationService");

dayjs.extend(utc);
dayjs.extend(timezone);

const DEFAULT_LEAD_MINUTES = 120;

const formatWhen = (date, tz) => {
  const d = tz ? dayjs(date).tz(tz) : dayjs(date);
  return d.format("ddd MMM D, h:mm A");
};

// Remind clients ahead of a booked session, honoring each client's lead-time setting. Deduped
// via sessionReminderSentAt so a session is only reminded once.
const runSessionReminderSweep = async () => {
  const now = new Date();
  const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const events = await ScheduleEvent.find({
    eventType: "APPOINTMENT",
    status: "BOOKED",
    clientId: { $ne: null },
    startDateTime: { $gte: now, $lte: horizon },
    $or: [{ sessionReminderSentAt: null }, { sessionReminderSentAt: { $exists: false } }],
  }).lean();
  if (!events.length) return 0;

  const clientIds = [...new Set(events.map((e) => String(e.clientId)))];
  const users = await User.find({ _id: { $in: clientIds } })
    .select("notificationPrefs timezone")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  let sent = 0;
  for (const ev of events) {
    const user = byId.get(String(ev.clientId)) || {};
    const prefs = user.notificationPrefs || {};
    if (prefs.sessionReminder === false) continue;
    const lead = Number(prefs.sessionReminderLeadMinutes) || DEFAULT_LEAD_MINUTES;
    const fireAt = new Date(new Date(ev.startDateTime).getTime() - lead * 60 * 1000);
    if (now < fireAt) continue; // not within the lead window yet
    await createNotification({
      userId: ev.clientId,
      type: "SESSION_REMINDER",
      title: "Upcoming session",
      body: `You have a session ${formatWhen(ev.startDateTime, user.timezone)}.`,
      link: "/sessions",
    });
    await ScheduleEvent.updateOne(
      { _id: ev._id },
      { $set: { sessionReminderSentAt: new Date() } }
    );
    sent += 1;
  }
  return sent;
};

// Day-of workout reminders + overdue nudges, evaluated in each user's local timezone.
// Per-workout dedup via reminderSentAt / overdueSentAt.
const runWorkoutReminderSweep = async () => {
  const now = new Date();
  const window = 36 * 60 * 60 * 1000; // ±36h covers all timezone offsets around "today"
  const workouts = await Training.find({
    isTemplate: { $ne: true },
    complete: { $ne: true },
    date: { $gte: new Date(now.getTime() - window), $lte: new Date(now.getTime() + window) },
    $or: [{ reminderSentAt: null }, { overdueSentAt: null }],
  })
    .select("user title date reminderSentAt overdueSentAt")
    .lean();
  if (!workouts.length) return { reminders: 0, overdue: 0 };

  const userIds = [...new Set(workouts.map((w) => String(w.user)))];
  const users = await User.find({ _id: { $in: userIds } })
    .select("notificationPrefs timezone")
    .lean();
  const byId = new Map(users.map((u) => [String(u._id), u]));

  let reminders = 0;
  let overdue = 0;
  for (const w of workouts) {
    const user = byId.get(String(w.user));
    if (!user) continue;
    const prefs = user.notificationPrefs || {};
    const tz = user.timezone || "UTC";
    const localNow = dayjs(now).tz(tz);
    // Workout date is stored at UTC midnight of its intended day; compare calendar days.
    if (dayjs.utc(w.date).format("YYYY-MM-DD") !== localNow.format("YYYY-MM-DD")) continue;
    const [rh, rm] = String(prefs.workoutReminderTime || "08:00")
      .split(":")
      .map((n) => Number(n) || 0);
    const reminderMin = rh * 60 + rm;
    const nowMin = localNow.hour() * 60 + localNow.minute();

    if (prefs.workoutReminder !== false && !w.reminderSentAt && nowMin >= reminderMin) {
      await createNotification({
        userId: w.user,
        type: "WORKOUT_REMINDER",
        title: "Workout today",
        body: `Don't forget: ${w.title || "your workout"}.`,
        link: "/calendar",
      });
      await Training.updateOne({ _id: w._id }, { $set: { reminderSentAt: new Date() } });
      reminders += 1;
    }

    const overdueAfter = Number(prefs.workoutOverdueAfterMinutes) || 180;
    if (prefs.workoutOverdue !== false && !w.overdueSentAt && nowMin >= reminderMin + overdueAfter) {
      await createNotification({
        userId: w.user,
        type: "WORKOUT_OVERDUE",
        title: "Workout still pending",
        body: `You haven't logged ${w.title || "your workout"} yet today.`,
        link: "/calendar",
      });
      await Training.updateOne({ _id: w._id }, { $set: { overdueSentAt: new Date() } });
      overdue += 1;
    }
  }
  return { reminders, overdue };
};

const runReminderSweep = async () => {
  try {
    const sessions = await runSessionReminderSweep();
    const workout = await runWorkoutReminderSweep();
    const parts = [];
    if (sessions) parts.push(`${sessions} session`);
    if (workout.reminders) parts.push(`${workout.reminders} workout`);
    if (workout.overdue) parts.push(`${workout.overdue} overdue`);
    if (parts.length) console.log(`reminderJob: sent ${parts.join(", ")} reminder(s)`);
  } catch (err) {
    console.error("reminderJob sweep failed:", err.message);
  }
};

const startReminderJob = () => {
  setTimeout(runReminderSweep, 45 * 1000);
  setInterval(runReminderSweep, 5 * 60 * 1000);
};

module.exports = {
  startReminderJob,
  runReminderSweep,
  runSessionReminderSweep,
  runWorkoutReminderSweep,
};
