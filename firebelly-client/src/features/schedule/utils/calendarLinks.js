/**
 * Cross-calendar "add to calendar" links for a schedule event.
 *
 * Produces links/files that work with every mainstream calendar:
 * - Google Calendar  -> render?action=TEMPLATE deep link
 * - Outlook / Office  -> deeplink/compose
 * - Apple Calendar / anything else -> downloadable .ics (iCalendar)
 *
 * Pure functions; no network, no deps. An event is:
 *   { title, start, end, details?, location? }  (start/end: Date | ISO string)
 */

// 20260618T143000Z (UTC, basic format) — what Google + ICS want.
function toICSStamp(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function enc(value) {
  return encodeURIComponent(value ?? "");
}

export function googleCalendarUrl({ title, start, end, details = "", location = "" }) {
  const dates = `${toICSStamp(start)}/${toICSStamp(end)}`;
  return (
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    `&text=${enc(title)}&dates=${dates}&details=${enc(details)}&location=${enc(location)}`
  );
}

export function outlookCalendarUrl({ title, start, end, details = "", location = "" }) {
  return (
    "https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent" +
    `&subject=${enc(title)}&startdt=${enc(new Date(start).toISOString())}` +
    `&enddt=${enc(new Date(end).toISOString())}&body=${enc(details)}&location=${enc(location)}`
  );
}

// Escape per RFC 5545 text rules.
function icsEscape(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildICS({ title, start, end, details = "", location = "", uid }) {
  const stamp = toICSStamp(new Date());
  const id = uid || `${stamp}-${Math.abs(hashString(title + start))}@firebellyfitness.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Firebelly Fitness//Scheduler//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${id}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toICSStamp(start)}`,
    `DTEND:${toICSStamp(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    details ? `DESCRIPTION:${icsEscape(details)}` : null,
    location ? `LOCATION:${icsEscape(location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function icsDataUri(event) {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildICS(event))}`;
}

// Trigger a client-side .ics download (Apple Calendar / fallback).
export function downloadICS(event, filename = "firebelly-session.ics") {
  const blob = new Blob([buildICS(event)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function hashString(value) {
  let hash = 0;
  const text = String(value ?? "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
