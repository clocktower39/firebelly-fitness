import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../../Redux/actions";
import {
  DEFAULT_SPORTS_STAT,
  normalizeSports,
  sportsSectionHasData,
} from "../utils/sportsUtils";

const EMPTY_FAVORITES = [];

const openFromData = (sports) => {
  const has = sportsSectionHasData(sports);
  return { effort: has.effort, environment: has.environment, gear: has.gear, stats: has.stats };
};

// Single-page Sports log state (no plan/actual). Stored as a flat object on training.sports.
export default function useWorkoutSports({ training }) {
  const [sports, setSports] = useState(() => normalizeSports(training?.sports));
  const [sectionsOpen, setSectionsOpen] = useState(() => openFromData(normalizeSports(training?.sports)));

  const dispatch = useDispatch();
  // Account-bound favorite sports (a user setting, so they follow the person across devices).
  const favoriteSports = useSelector((state) => state.user?.favoriteSports) || EMPTY_FAVORITES;
  const onToggleFavoriteSport = useCallback(
    (sport) => {
      if (!sport) return;
      const current = Array.isArray(favoriteSports) ? favoriteSports : [];
      const next = current.includes(sport)
        ? current.filter((s) => s !== sport)
        : [...current, sport];
      dispatch(updateUserSettings({ favoriteSports: next }));
    },
    [dispatch, favoriteSports]
  );

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setSports((prev) => ({ ...prev, [field]: value }));
  };

  const toggleSection = (key) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const addStat = () => {
    setSectionsOpen((prev) => ({ ...prev, stats: true }));
    setSports((prev) => ({ ...prev, stats: [...(prev.stats || []), { ...DEFAULT_SPORTS_STAT }] }));
  };

  const removeStat = (index) => {
    setSports((prev) => ({ ...prev, stats: (prev.stats || []).filter((_, i) => i !== index) }));
  };

  const changeStat = (index, key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setSports((prev) => {
      const stats = [...(prev.stats || [])];
      stats[index] = { ...stats[index], [key]: value };
      return { ...prev, stats };
    });
  };

  const hydrateSports = useCallback((raw) => {
    const normalized = normalizeSports(raw);
    setSports(normalized);
    setSectionsOpen(openFromData(normalized));
  }, []);

  return {
    sports,
    hydrateSports,
    editorProps: {
      sports,
      sectionsOpen,
      favoriteSports,
      onToggleFavoriteSport,
      handleChange,
      toggleSection,
      addStat,
      removeStat,
      changeStat,
    },
  };
}
