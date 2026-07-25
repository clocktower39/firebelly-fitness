export const ENGAGEMENT_STATUS_OPTIONS = [
  { value: "active", label: "Active", color: "success" },
  { value: "paused", label: "Paused", color: "warning" },
  { value: "inactive", label: "Inactive", color: "default" },
];

export const SERVICE_TAG_OPTIONS = [
  { value: "in_person", label: "In-Person" },
  { value: "online", label: "Online" },
  { value: "programming", label: "Programming" },
];

const engagementStatusLabelMap = Object.fromEntries(
  ENGAGEMENT_STATUS_OPTIONS.map((option) => [option.value, option.label])
);

const engagementStatusColorMap = Object.fromEntries(
  ENGAGEMENT_STATUS_OPTIONS.map((option) => [option.value, option.color])
);

const serviceTagLabelMap = Object.fromEntries(
  SERVICE_TAG_OPTIONS.map((option) => [option.value, option.label])
);

export const getRelationshipEngagementStatus = (relationship) =>
  relationship?.engagementStatus || "active";

export const getRelationshipServiceTags = (relationship) =>
  Array.isArray(relationship?.serviceTags) ? relationship.serviceTags : [];

export const getEngagementStatusLabel = (value) =>
  engagementStatusLabelMap[value] || engagementStatusLabelMap.active;

export const getEngagementStatusColor = (value) =>
  engagementStatusColorMap[value] || engagementStatusColorMap.active;

export const getServiceTagLabel = (value) => serviceTagLabelMap[value] || value;

export const isRelationshipActivelyCoached = (relationship) =>
  Boolean(relationship?.accepted) && getRelationshipEngagementStatus(relationship) === "active";

// Canonical ordering for every client list/picker: last name A→Z (then first name).
// Accepts client user objects ({firstName, lastName}).
export const compareClientsByLastName = (a, b) =>
  String(a?.lastName || "").localeCompare(String(b?.lastName || "")) ||
  String(a?.firstName || "").localeCompare(String(b?.firstName || ""));

// Same ordering for relationship objects (the shape in redux state.clients).
export const compareRelationshipsByClientLastName = (a, b) =>
  compareClientsByLastName(a?.client, b?.client);

// Canonical display for client lists/pickers: "Last, First".
export const formatClientLastFirst = (client) => {
  const last = String(client?.lastName || "").trim();
  const first = String(client?.firstName || "").trim();
  return last && first ? `${last}, ${first}` : last || first || "Unnamed client";
};
