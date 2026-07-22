// One rule for naming session types anywhere in the UI: the duration is appended from the
// structured durationMinutes field, so type NAMES never need to carry "30 min"/"60 min"
// themselves (name = what the product is; fields = its attributes).
export const sessionTypeLabel = (type) =>
  type
    ? `${type.name}${type.durationMinutes ? ` · ${type.durationMinutes} min` : ""}`
    : "";
