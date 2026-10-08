import { apiFetch } from "./client";

export const exerciseMaxApi = {
  // Every lift the person has loaded, with the stored max and what their history suggests.
  forUser: (clientId) =>
    apiFetch("/exerciseMaxes/forUser", {
      method: "POST",
      body: clientId ? { clientId } : {},
    }),

  // value null/"" clears the max.
  setMax: ({ clientId, exerciseId, value, testedAt, source, note }) =>
    apiFetch("/exerciseMaxes/set", {
      method: "POST",
      body: { ...(clientId ? { clientId } : {}), exerciseId, value, testedAt, source, note },
    }),

  listMine: () => apiFetch("/exerciseMaxes"),
};
