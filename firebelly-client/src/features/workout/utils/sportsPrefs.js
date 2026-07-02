// Per-device favorite sports (localStorage), mirroring the technique favorites pattern.
const KEY = "sportsFavorites";

const read = () => {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

const write = (list) => {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
};

export const getFavoriteSports = () => read();

export const isFavoriteSport = (sport) => read().includes(sport);

export const toggleFavoriteSport = (sport) => {
  const list = read();
  const next = list.includes(sport) ? list.filter((s) => s !== sport) : [...list, sport];
  write(next);
  return next;
};
