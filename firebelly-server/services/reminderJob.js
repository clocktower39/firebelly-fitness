// Scheduled reminder sweeps (setInterval, like pastDueJob). Phase 1: pre-session reminders.
// Workout / overdue / measurement sweeps will be added here next.
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const timezone = require("dayjs/plugin/timezone");
const ScheduleEvent = require("../models/scheduleEvent");
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

const runReminderSweep = async () => {
  try {
    const sessions = await runSessionReminderSweep();
    if (sessions) console.log(`reminderJob: sent ${sessions} session reminder(s)`);
  } catch (err) {
    console.error("reminderJob sweep failed:", err.message);
  }
};

const startReminderJob = () => {
  setTimeout(runReminderSweep, 45 * 1000);
  setInterval(runReminderSweep, 5 * 60 * 1000);
};

module.exports = { startReminderJob, runReminderSweep, runSessionReminderSweep };
