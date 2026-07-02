// Config + helpers for the "Sports" workout type (a single-page log; no plan/actual split).

export const SPORTS_LIST = [
  // Team
  "Basketball",
  "Soccer",
  "Football",
  "Volleyball",
  "Baseball / Softball",
  "Hockey",
  "Lacrosse",
  "Rugby",
  "Cricket",
  "Ultimate",
  "Water Polo",
  // Racquet / paddle
  "Tennis",
  "Pickleball",
  "Padel",
  "Squash",
  "Racquetball",
  "Badminton",
  "Table Tennis",
  // Combat
  "Boxing",
  "Martial Arts",
  "Wrestling",
  "Jiu-Jitsu",
  "Fencing",
  // Other
  "Golf",
  "Bowling",
  "Climbing",
  "Skiing",
  "Snowboarding",
  "Surfing",
  "Skateboarding",
  "Gymnastics",
  "Dance",
  "Track & Field",
  "Other",
];

export const SPORTS_SESSION_TYPES = [
  "Game",
  "Match",
  "Tournament",
  "League",
  "Scrimmage",
  "Practice",
  "Drills",
  "Lesson",
  "Open play",
  "Casual",
];

const COMPETITIVE_SESSION_TYPES = ["Game", "Match", "Tournament", "League", "Scrimmage"];
export const isCompetitiveSession = (sessionType) => COMPETITIVE_SESSION_TYPES.includes(sessionType);

export const SPORTS_RESULT_OPTIONS = ["Win", "Loss", "Tie / Draw", "No result"];
export const SPORTS_ENVIRONMENT_OPTIONS = ["Indoor", "Outdoor"];
export const SPORTS_SURFACE_OPTIONS = [
  "Hard court",
  "Clay",
  "Grass",
  "Turf",
  "Indoor court",
  "Ice",
  "Sand",
  "Track",
  "Field",
  "Pool",
  "Gym floor",
  "Other",
];
export const SPORTS_WEATHER_OPTIONS = ["Sunny", "Cloudy", "Rain", "Windy", "Snow", "Indoor"];
export const SPORTS_HR_ZONE_OPTIONS = ["Z1 Recovery", "Z2 Easy", "Z3 Aerobic", "Z4 Threshold", "Z5 VO2"];

export const SPORTS_OPTIONAL_SECTIONS = [
  { key: "effort", label: "Effort & body" },
  { key: "environment", label: "Environment" },
  { key: "gear", label: "Gear" },
  { key: "stats", label: "Stats" },
];

export const DEFAULT_SPORTS_STAT = { label: "", value: "" };

export const DEFAULT_SPORTS_FIELDS = {
  sport: "Basketball",
  sessionType: "Practice",
  durationMinutes: "",
  rpe: "",
  // result & competition (competitive sessions)
  result: "",
  score: "",
  opponent: "",
  position: "",
  // effort & body
  avgHeartRate: "",
  hrZone: "",
  calories: "",
  distance: "",
  distanceUnit: "mi",
  // environment
  environment: "",
  surface: "",
  location: "",
  weather: "",
  temperature: "",
  temperatureUnit: "F",
  // gear
  gear: "",
  // focus + notes
  skills: "",
  notes: "",
  // flexible per-sport stats
  stats: [],
};

export const normalizeSports = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    ...DEFAULT_SPORTS_FIELDS,
    ...source,
    stats: Array.isArray(source.stats)
      ? source.stats.map((stat) => ({ ...DEFAULT_SPORTS_STAT, ...(stat || {}) }))
      : [],
  };
};

export const buildSportsTitle = (sports) => {
  if (!sports) return "";
  const minutes = Number(sports.durationMinutes);
  const durationPart = minutes > 0 ? `${minutes} min` : "";
  const sport = !sports.sport || sports.sport === "Other" ? "Sport" : sports.sport;
  return [durationPart, sport].filter(Boolean).join(" ");
};

const hasValue = (value) => value !== "" && value !== null && value !== undefined;

export const sportsSectionHasData = (sports) => ({
  effort: [sports.avgHeartRate, sports.hrZone, sports.calories, sports.distance].some(hasValue),
  environment: [sports.environment, sports.surface, sports.location, sports.weather, sports.temperature].some(
    hasValue
  ),
  gear: hasValue(sports.gear),
  stats: (sports.stats || []).length > 0,
});
