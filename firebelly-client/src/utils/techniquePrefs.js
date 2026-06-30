// Per-device coach preferences for the technique drawer: favorites + recently-used. Kept in
// localStorage (instant, zero server infra). A future server-backed "personal coach library" (M5+)
// can subsume favorites for cross-device sync without changing the drawer's call sites.

const FAV_KEY = "fb_technique_favorites";
const RECENT_KEY = "fb_technique_recents";
const MAX_RECENTS = 8;

const read = (key) => {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};
const write = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
};

export const getFavorites = () => read(FAV_KEY);
export const isFavorite = (techniqueKey) => getFavorites().includes(techniqueKey);
export const toggleFavorite = (techniqueKey) => {
  const favs = getFavorites();
  const next = favs.includes(techniqueKey)
    ? favs.filter((k) => k !== techniqueKey)
    : [...favs, techniqueKey];
  write(FAV_KEY, next);
  return next;
};

export const getRecents = () => read(RECENT_KEY);
export const pushRecent = (techniqueKey) => {
  const next = [techniqueKey, ...getRecents().filter((k) => k !== techniqueKey)].slice(0, MAX_RECENTS);
  write(RECENT_KEY, next);
  return next;
};
