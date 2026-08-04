import { apiFetch } from "./client";

// Uploaded notification tones (assignable per chat / person via the messageSounds setting).
export const soundApi = {
  list: () => apiFetch("/user/sounds"),

  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiFetch("/user/sounds", { method: "POST", body: fd });
  },

  remove: (fileId) => apiFetch(`/user/sounds/${fileId}/delete`, { method: "POST", body: {} }),
};
