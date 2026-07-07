import { apiFetch } from "./client";

export const trainingBlockApi = {
  listTrainingBlocks: () => apiFetch("/trainingBlocks"),

  listClientBlocks: (client) =>
    apiFetch("/clientTrainingBlocks", {
      method: "POST",
      body: { client },
    }),

  createTrainingBlock: (block) =>
    apiFetch("/trainingBlocks", {
      method: "POST",
      body: block,
    }),

  updateTrainingBlock: (block) =>
    apiFetch("/trainingBlocks/update", {
      method: "POST",
      body: block,
    }),
};
