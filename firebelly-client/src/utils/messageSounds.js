import { serverURL } from "../api/client";

// Bundled tones (generated WAVs in public/sounds/). A sound ref is one of:
//   "builtin:<id>"  — a bundled tone
//   "file:<id>"     — an uploaded sound streamed from the server
//   "none"          — explicitly silent (overrides an account default)
export const BUILTIN_SOUNDS = [
  { id: "chime", label: "Chime" },
  { id: "ding", label: "Ding" },
  { id: "bell", label: "Bell" },
  { id: "pop", label: "Pop" },
];

export const soundUrlFor = (ref) => {
  if (!ref || ref === "none") return null;
  if (ref.startsWith("builtin:")) return `/sounds/${ref.slice("builtin:".length)}.wav`;
  if (ref.startsWith("file:")) return `${serverURL}/user/sounds/${ref.slice("file:".length)}`;
  return null;
};

// Most-specific assignment wins: the person, then the chat, then the account default.
export const resolveMessageSound = (sounds, { senderId, conversationId }) => {
  if (!sounds || typeof sounds !== "object") return null;
  const ref =
    (senderId && sounds[`user:${senderId}`]) ||
    (conversationId && sounds[`conv:${conversationId}`]) ||
    sounds.default ||
    null;
  return ref === "none" ? null : ref;
};

const audioCache = new Map();

export const playMessageSound = (ref) => {
  const url = soundUrlFor(ref);
  if (!url) return;
  try {
    let audio = audioCache.get(url);
    if (!audio) {
      audio = new window.Audio(url);
      audioCache.set(url, audio);
    }
    audio.currentTime = 0;
    // Autoplay can be blocked before the user's first interaction — fail silently.
    audio.play().catch(() => {});
  } catch (e) {
    /* never let a sound break message handling */
  }
};
