// Suggest alternative exercises that train the same muscles. Ranked by shared primary movers
// (weighted heavily), then shared secondary muscles and matching compound/isolation. Requires
// at least one shared primary muscle. Optional differentEquipmentOnly drops any candidate that
// shares equipment with the target (the "I don't have that gear" swap).
export const findSubstitutes = (
  target,
  list = [],
  { limit = 8, differentEquipmentOnly = false } = {}
) => {
  if (!target) return [];
  const tPrimary = new Set(target.muscleGroups?.primary || []);
  const tSecondary = new Set(target.muscleGroups?.secondary || []);
  const tEquip = new Set(target.equipment || []);
  if (!tPrimary.size) return [];

  return list
    .filter((e) => e && e._id !== target._id)
    .map((e) => {
      const ePrimary = e.muscleGroups?.primary || [];
      const eSecondary = e.muscleGroups?.secondary || [];
      const sharedPrimary = ePrimary.filter((m) => tPrimary.has(m)).length;
      if (!sharedPrimary) return null; // a substitute must hit the same primary mover
      if (differentEquipmentOnly && tEquip.size) {
        if ((e.equipment || []).some((q) => tEquip.has(q))) return null;
      }
      const sharedSecondary =
        eSecondary.filter((m) => tPrimary.has(m) || tSecondary.has(m)).length +
        ePrimary.filter((m) => tSecondary.has(m)).length;
      const sameComplexity =
        target.movementComplexity && e.movementComplexity === target.movementComplexity ? 1 : 0;
      const score = sharedPrimary * 3 + sharedSecondary + sameComplexity;
      return { exercise: e, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.exercise);
};
