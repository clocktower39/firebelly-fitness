// Shared option lists for the Training Profile intake — reused by the account page and the
// Training Block wizard so the same questions/vocabulary appear in both places.

export const EXPERIENCE = [
  { value: "beginner", label: "Beginner (< 1 yr / new to lifting)" },
  { value: "intermediate", label: "Intermediate (1–3 yrs)" },
  { value: "advanced", label: "Advanced (3+ yrs)" },
];

export const ACTIVITY = [
  { value: "sedentary", label: "Sedentary (desk job, little activity)" },
  { value: "light", label: "Lightly active" },
  { value: "moderate", label: "Moderately active" },
  { value: "very_active", label: "Very active (on feet / labor / athlete)" },
];

export const STRESS = [
  { value: "low", label: "Low" },
  { value: "moderate", label: "Moderate" },
  { value: "high", label: "High" },
];

// Suggestions only — the field is free-solo, aligned to the Exercise equipment vocabulary.
export const EQUIPMENT_OPTIONS = [
  "Full gym", "Barbell", "Dumbbells", "Kettlebell", "Machine", "Cable", "Bands",
  "Bodyweight", "Pull-up bar", "Bench", "Squat rack", "Cardio machine",
];
