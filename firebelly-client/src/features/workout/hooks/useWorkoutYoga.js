import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../../Redux/actions";
import { DEFAULT_YOGA_POSE, normalizeYoga, yogaSectionHasData } from "../utils/yogaUtils";

const EMPTY_FAVORITES = [];

const openFromData = (yoga) => {
  const has = yogaSectionHasData(yoga);
  return {
    focus: has.focus,
    class: has.class,
    mindBody: has.mindBody,
    props: has.props,
    poses: has.poses,
  };
};

// Single-page Yoga log state (no plan/actual). Stored as a flat object on training.yoga.
export default function useWorkoutYoga({ training }) {
  const [yoga, setYoga] = useState(() => normalizeYoga(training?.yoga));
  const [sectionsOpen, setSectionsOpen] = useState(() => openFromData(normalizeYoga(training?.yoga)));

  const dispatch = useDispatch();
  // Account-bound favorite yoga styles (a user setting, so they follow the person across devices).
  const favoriteYogaStyles = useSelector((state) => state.user?.favoriteYogaStyles) || EMPTY_FAVORITES;
  const onToggleFavoriteStyle = useCallback(
    (style) => {
      if (!style) return;
      const current = Array.isArray(favoriteYogaStyles) ? favoriteYogaStyles : [];
      const next = current.includes(style) ? current.filter((s) => s !== style) : [...current, style];
      dispatch(updateUserSettings({ favoriteYogaStyles: next }));
    },
    [dispatch, favoriteYogaStyles]
  );

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    setYoga((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayValue = (field, value) => {
    setYoga((prev) => {
      const arr = prev[field] || [];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  };

  const toggleSection = (key) => setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const addPose = () => {
    setSectionsOpen((prev) => ({ ...prev, poses: true }));
    setYoga((prev) => ({ ...prev, poses: [...(prev.poses || []), { ...DEFAULT_YOGA_POSE }] }));
  };

  const removePose = (index) => {
    setYoga((prev) => ({ ...prev, poses: (prev.poses || []).filter((_, i) => i !== index) }));
  };

  const changePose = (index, key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setYoga((prev) => {
      const poses = [...(prev.poses || [])];
      poses[index] = { ...poses[index], [key]: value };
      return { ...prev, poses };
    });
  };

  const hydrateYoga = useCallback((raw) => {
    const normalized = normalizeYoga(raw);
    setYoga(normalized);
    setSectionsOpen(openFromData(normalized));
  }, []);

  return {
    yoga,
    hydrateYoga,
    editorProps: {
      yoga,
      sectionsOpen,
      favoriteYogaStyles,
      onToggleFavoriteStyle,
      handleChange,
      toggleArrayValue,
      toggleSection,
      addPose,
      removePose,
      changePose,
    },
  };
}
