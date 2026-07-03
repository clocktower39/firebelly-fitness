import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../../Redux/actions";
import {
  DEFAULT_PILATES_EXERCISE,
  normalizePilates,
  pilatesSectionHasData,
} from "../utils/pilatesUtils";

const EMPTY_FAVORITES = [];

const openFromData = (pilates) => {
  const has = pilatesSectionHasData(pilates);
  return {
    focus: has.focus,
    class: has.class,
    mindBody: has.mindBody,
    equipment: has.equipment,
    exercises: has.exercises,
  };
};

// Single-page Pilates log state (no plan/actual). Stored as a flat object on training.pilates.
export default function useWorkoutPilates({ training }) {
  const [pilates, setPilates] = useState(() => normalizePilates(training?.pilates));
  const [sectionsOpen, setSectionsOpen] = useState(() =>
    openFromData(normalizePilates(training?.pilates))
  );

  const dispatch = useDispatch();
  // Account-bound favorite pilates styles (a user setting, so they follow the person across devices).
  const favoritePilatesStyles =
    useSelector((state) => state.user?.favoritePilatesStyles) || EMPTY_FAVORITES;
  const onToggleFavoriteStyle = useCallback(
    (style) => {
      if (!style) return;
      const current = Array.isArray(favoritePilatesStyles) ? favoritePilatesStyles : [];
      const next = current.includes(style) ? current.filter((s) => s !== style) : [...current, style];
      dispatch(updateUserSettings({ favoritePilatesStyles: next }));
    },
    [dispatch, favoritePilatesStyles]
  );

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setPilates((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayValue = (field, value) => {
    setPilates((prev) => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const toggleSection = (key) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const addExercise = () => {
    setSectionsOpen((prev) => ({ ...prev, exercises: true }));
    setPilates((prev) => ({
      ...prev,
      exercises: [...(prev.exercises || []), { ...DEFAULT_PILATES_EXERCISE }],
    }));
  };

  const removeExercise = (index) => {
    setPilates((prev) => ({
      ...prev,
      exercises: (prev.exercises || []).filter((_, i) => i !== index),
    }));
  };

  const changeExercise = (index, key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setPilates((prev) => {
      const exercises = [...(prev.exercises || [])];
      exercises[index] = { ...exercises[index], [key]: value };
      return { ...prev, exercises };
    });
  };

  const hydratePilates = useCallback((raw) => {
    const normalized = normalizePilates(raw);
    setPilates(normalized);
    setSectionsOpen(openFromData(normalized));
  }, []);

  return {
    pilates,
    hydratePilates,
    editorProps: {
      pilates,
      sectionsOpen,
      favoritePilatesStyles,
      onToggleFavoriteStyle,
      handleChange,
      toggleArrayValue,
      toggleSection,
      addExercise,
      removeExercise,
      changeExercise,
    },
  };
}
