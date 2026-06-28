import { readinessApi } from "../../api/readinessApi";
import { EDIT_READINESS } from "../actionTypes";
import { dayKey } from "../../utils/readiness";

export function getMyReadiness() {
  return async (dispatch) => {
    const entries = await readinessApi.getMyReadiness();
    return dispatch({ type: EDIT_READINESS, entries: Array.isArray(entries) ? entries : [] });
  };
}

export function saveReadiness(payload) {
  return async (dispatch, getState) => {
    const body = { ...payload, date: payload.date || dayKey() };
    const saved = await readinessApi.saveReadiness(body);
    if (!saved || saved.error) return saved;
    const entries = getState().readiness.entries || [];
    const savedKey = String(saved.date).slice(0, 10);
    const next = [saved, ...entries.filter((e) => String(e.date).slice(0, 10) !== savedKey)].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
    dispatch({ type: EDIT_READINESS, entries: next });
    return saved;
  };
}
