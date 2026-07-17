import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { updateUserSettings } from "../../../Redux/actions";
import { workoutApi } from "../../../api/workoutApi";
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

  // A brand-new Sports workout defaults its sport to the user's most-used favorite. We only apply
  // this to a new/untouched section (never overriding a saved sport or one the user just picked).
  const sportTouchedRef = useRef(false); // the user changed the sport this session
  const preferredSportRef = useRef(null); // fetched preferred default
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (training?.workoutType !== "Sports") return undefined; // only for sports workouts
    if (training?.sports?.sport) return undefined; // already has a saved sport — leave it
    if (sportTouchedRef.current || fetchedRef.current) return undefined;
    fetchedRef.current = true;
    let cancelled = false;
    const clientId = training?.user?._id || training?.user || null;
    workoutApi
      .getSportsDefault({ user: clientId })
      .then((res) => {
        if (cancelled) return;
        const s = res?.sport || null;
        preferredSportRef.current = s;
        // Apply only if the user hasn't picked a sport and this is still a new section.
        if (s && !sportTouchedRef.current && !training?.sports?.sport) {
          setSports((prev) => (prev.sport === s ? prev : { ...prev, sport: s }));
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [training?.workoutType, training?.sports?.sport, training?._id, training?.user]);

  const handleChange = (field) => (event) => {
    const value = event?.target ? event.target.value : event;
    if (field === "sport") sportTouchedRef.current = true; // user chose a sport — stop auto-defaulting
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
    // Re-hydrating a new/untouched sports section: keep the preferred default (don't reset to the
    // hardcoded fallback). An existing saved sport (raw.sport) or a user pick is always respected.
    if (!raw?.sport && !sportTouchedRef.current && preferredSportRef.current) {
      normalized.sport = preferredSportRef.current;
    }
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
