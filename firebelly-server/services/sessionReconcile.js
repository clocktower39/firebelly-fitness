const dayjs = require("dayjs");
const dayjsUtc = require("dayjs/plugin/utc");
const dayjsTimezone = require("dayjs/plugin/timezone");
dayjs.extend(dayjsUtc);
dayjs.extend(dayjsTimezone);
const ScheduleEvent = require("../models/scheduleEvent");
const Invoice = require("../models/invoice");
const User = require("../models/user");

// ---------------------------------------------------------------------------------------
// Session reconcile: classify a list of "this session happened on <date>" rows against the
// calendar and the invoices, producing a per-row plan (create appt / complete booked / use
// existing / ambiguous / skip) that preview shows and commit re-validates. All calendar
// dates are the TRAINER'S day (a 12pm-Phoenix session is stored 19:00Z; an 8pm one is
// 03:00Z the next UTC day — bucketing in the trainer tz keeps both on the right date).
// ---------------------------------------------------------------------------------------

const dayInTz = (dt, tz) => {
  try {
    return new Date(dt).toLocaleDateString("en-CA", { timeZone: tz });
  } catch (e) {
    return dayjs(dt).format("YYYY-MM-DD");
  }
};

const timeInTz = (dt, tz) => {
  try {
    return new Date(dt)
      .toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
      .slice(0, 5);
  } catch (e) {
    return dayjs(dt).format("HH:mm");
  }
};

// "YYYY-MM-DD" + "HH:mm" in the trainer's tz -> Date instant.
const instantInTz = (dateStr, timeStr, tz) => {
  try {
    return dayjs.tz(`${dateStr} ${timeStr}`, tz).toDate();
  } catch (e) {
    return dayjs(`${dateStr}T${timeStr}`).toDate();
  }
};

const trainerTz = async (trainerId) => {
  const trainer = await User.findById(trainerId).select("timezone").lean();
  return trainer?.timezone || "UTC";
};

// The client's most-common appointment start time ("HH:mm" in the trainer tz) — the proven
// default for backfilled sessions (Brett @9am, Cy @2:30pm, Mike @8pm were all inferred this
// way). Falls back to 12:00 with sample=0 when there's no history.
const inferUsualTime = async ({ trainerId, clientId, tz }) => {
  const events = await ScheduleEvent.find({ trainerId, clientId, eventType: "APPOINTMENT" })
    .select("startDateTime")
    .sort({ startDateTime: -1 })
    .limit(200)
    .lean();
  const counts = {};
  for (const e of events) {
    const t = timeInTz(e.startDateTime, tz);
    counts[t] = (counts[t] || 0) + 1;
  }
  let best = "12:00";
  let n = 0;
  for (const [t, c] of Object.entries(counts)) {
    if (c > n) {
      best = t;
      n = c;
    }
  }
  return { time: best, sample: events.length };
};

const CALENDAR_ACTIONS = ["CREATE", "COMPLETE", "USE_EXISTING", "NONE", "AMBIGUOUS"];
const INCOME_ACTIONS = [
  "LOG",
  "SKIP_ALREADY_LOGGED",
  "SKIP_ALREADY_INVOICED",
  "SKIP_CREDIT_CHARGED",
];

// Classify rows: [{date, time?, price?, method?, paymentDate?}] + options
// {defaultPrice?, defaultTime?} -> {tz, usualTime, today, rows: [classified]}.
// Read-only — used by preview directly and re-run by commit to validate against fresh state.
const classifyRows = async ({ trainerId, clientId, rows = [], options = {}, now = new Date() }) => {
  const tz = await trainerTz(trainerId);
  const usual = await inferUsualTime({ trainerId, clientId, tz });
  const defaultTime = options.defaultTime || usual.time;
  const defaultPrice = Number.isFinite(Number(options.defaultPrice)) ? Number(options.defaultPrice) : null;
  const today = dayInTz(now, tz);

  const normalized = rows.map((r) => ({
    ...r,
    date: dayjs(r.date).format("YYYY-MM-DD"),
    paymentDate: r.paymentDate ? dayjs(r.paymentDate).format("YYYY-MM-DD") : null,
  }));
  const dates = [...new Set(normalized.map((r) => r.date))].sort();
  if (!dates.length) return { tz, usualTime: usual.time, usualSample: usual.sample, today, rows: [] };

  // Appointments spanning the requested dates (±1 day pad so tz bucketing never misses).
  const spanStart = dayjs(dates[0]).subtract(1, "day").toDate();
  const spanEnd = dayjs(dates[dates.length - 1]).add(2, "day").toDate();
  const appts = await ScheduleEvent.find({
    trainerId,
    clientId,
    eventType: "APPOINTMENT",
    startDateTime: { $gte: spanStart, $lt: spanEnd },
  })
    .select("startDateTime status billingStatus priceAmount sessionTypeId workoutId")
    .lean();
  const apptsByDate = {};
  for (const a of appts) {
    const k = dayInTz(a.startDateTime, tz);
    (apptsByDate[k] = apptsByDate[k] || []).push(a);
  }

  // Income side (a): dates already logged by a prior backfill run (any batch).
  const backfills = await Invoice.find(
    { trainerId, clientId, source: "BACKFILL", status: { $ne: "VOID" } },
    { "lineItems.sessionDate": 1 }
  ).lean();
  const loggedDates = new Set();
  for (const inv of backfills) {
    for (const li of inv.lineItems || []) {
      if (li.sessionDate) loggedDates.add(dayjs(li.sessionDate).format("YYYY-MM-DD"));
    }
  }

  // Income side (b): appointments already claimed by ANY non-void invoice (STANDARD or
  // BACKFILL) via the hard scheduleEventId link — a session with a real invoice must never
  // be double-counted by an import.
  const apptIds = appts.map((a) => a._id);
  const invoiceByEvent = new Map();
  if (apptIds.length) {
    const linked = await Invoice.find(
      { trainerId, "lineItems.scheduleEventId": { $in: apptIds }, status: { $ne: "VOID" } },
      { "lineItems.scheduleEventId": 1, invoiceNumber: 1, source: 1 }
    ).lean();
    for (const inv of linked) {
      for (const li of inv.lineItems || []) {
        if (li.scheduleEventId) {
          invoiceByEvent.set(String(li.scheduleEventId), {
            invoiceId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            source: inv.source,
          });
        }
      }
    }
  }

  const seenDates = new Set();
  const out = normalized.map((r) => {
    const warnings = [];
    if (seenDates.has(r.date)) warnings.push("DUPLICATE_ROW");
    seenDates.add(r.date);

    const rowPrice = Number.isFinite(Number(r.price)) ? Number(r.price) : null;
    const price = rowPrice != null ? rowPrice : defaultPrice != null ? defaultPrice : 0;
    const time = r.time || defaultTime;
    const dayAppts = apptsByDate[r.date] || [];
    const active = dayAppts.filter((a) => a.status !== "CANCELLED");

    let calendarAction;
    let eventId = null;
    let candidates;
    if (r.date > today) {
      // Prepaid future sessions (Tyler's model): log the income, never fabricate a
      // completed future appointment — the trainer books those live.
      calendarAction = "NONE";
      warnings.push("FUTURE_DATE");
    } else if (active.length === 0) {
      calendarAction = "CREATE";
      if (dayAppts.length) warnings.push("CANCELLED_APPT_ON_DATE");
    } else if (active.length === 1) {
      const a = active[0];
      eventId = a._id;
      if (a.status === "COMPLETED") calendarAction = "USE_EXISTING";
      else if (a.status === "BOOKED" || a.status === "REQUESTED") calendarAction = "COMPLETE";
      else {
        calendarAction = "AMBIGUOUS";
        warnings.push("UNEXPECTED_STATUS");
        candidates = [a];
      }
      if (a.priceAmount != null && price > 0 && Number(a.priceAmount) !== price) {
        warnings.push("PRICE_MISMATCH");
      }
    } else {
      // The Amy/Cy case: a stray BOOKED next to the real COMPLETED — never guess.
      calendarAction = "AMBIGUOUS";
      warnings.push("MULTIPLE_APPTS");
      candidates = active;
    }

    let incomeAction = "LOG";
    let existingInvoice = null;
    const matched = eventId ? active.find((a) => String(a._id) === String(eventId)) : null;
    if (loggedDates.has(r.date)) {
      incomeAction = "SKIP_ALREADY_LOGGED";
    } else if (eventId && invoiceByEvent.has(String(eventId))) {
      incomeAction = "SKIP_ALREADY_INVOICED";
      existingInvoice = invoiceByEvent.get(String(eventId));
    } else if (matched && matched.billingStatus === "CHARGED") {
      // Paid with prepaid session credits — logging income too would double-count.
      // Preview defaults to skip; the trainer can deliberately override to LOG.
      incomeAction = "SKIP_CREDIT_CHARGED";
      warnings.push("CREDIT_CHARGED");
    }

    return {
      date: r.date,
      time,
      price,
      method: String(r.method || "").trim(),
      paymentDate: r.paymentDate,
      calendarAction,
      eventId,
      candidates: candidates
        ? candidates.map((a) => ({
            eventId: a._id,
            startDateTime: a.startDateTime,
            time: timeInTz(a.startDateTime, tz),
            status: a.status,
            billingStatus: a.billingStatus,
            priceAmount: a.priceAmount,
          }))
        : undefined,
      incomeAction,
      existingInvoice,
      warnings,
    };
  });

  return { tz, usualTime: usual.time, usualSample: usual.sample, today, rows: out };
};

// For the Log Sessions dialog's pre-check: which of these dates are already settled —
// either logged by a prior backfill OR their appointment carries any non-void invoice.
const alreadySettledDates = async ({ trainerId, clientId, dates = [] }) => {
  const rows = dates.map((d) => ({ date: d }));
  const { rows: classified } = await classifyRows({ trainerId, clientId, rows });
  const logged = [];
  const invoiced = [];
  for (const r of classified) {
    if (r.incomeAction === "SKIP_ALREADY_LOGGED") logged.push(r.date);
    else if (r.incomeAction === "SKIP_ALREADY_INVOICED") invoiced.push(r.date);
  }
  return { logged, invoiced };
};

module.exports = {
  classifyRows,
  inferUsualTime,
  alreadySettledDates,
  dayInTz,
  timeInTz,
  instantInTz,
  trainerTz,
  CALENDAR_ACTIONS,
  INCOME_ACTIONS,
};
