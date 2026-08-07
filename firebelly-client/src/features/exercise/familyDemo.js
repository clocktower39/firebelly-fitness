// Family demo inheritance: a variant without its own demo video borrows the video of another
// exercise in the same family ("Dumbbell Incline Chest Press" shows the "Chest Press" family
// demo until it gets its own). Presentation-only — nothing about the exercise's identity,
// history, or progression changes.
export const resolveDemoMedia = (exercise, exerciseList = []) => {
  const own = (exercise?.mediaUrl || "").trim();
  if (own) return { mediaUrl: own, from: null };
  let familyKey = (exercise?.familyKey || "").trim();
  if (!familyKey && exercise?._id) {
    // Workout entries carry a slim exercise object — look the full record up in the library.
    familyKey = (
      exerciseList.find((e) => String(e._id) === String(exercise._id))?.familyKey || ""
    ).trim();
  }
  if (!familyKey) return { mediaUrl: "", from: null };
  const donor = exerciseList.find(
    (e) =>
      (e.familyKey || "").trim() === familyKey &&
      (e.mediaUrl || "").trim() &&
      String(e._id) !== String(exercise?._id)
  );
  return donor
    ? { mediaUrl: donor.mediaUrl.trim(), from: donor.exerciseTitle }
    : { mediaUrl: "", from: null };
};
