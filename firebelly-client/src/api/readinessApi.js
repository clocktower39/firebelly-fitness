import { apiFetch } from "./client";

export const readinessApi = {
  getMyReadiness: () => apiFetch("/readiness"),
  saveReadiness: (payload) => apiFetch("/readiness", { method: "POST", body: payload }),
  getClientReadiness: (client) =>
    apiFetch("/readiness/client", { method: "POST", body: { client } }),
  getClientsReadiness: () => apiFetch("/readiness/clients"),
};
