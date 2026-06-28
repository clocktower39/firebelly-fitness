import { jwtDecode as jwt } from "jwt-decode";
import { accountApi } from "../../api/accountApi";
import { authApi } from "../../api/authApi";
import {
  getAccessToken,
  hasDelegatedReturnAccessToken,
  setAccessToken,
  setDelegatedReturnAccessToken,
} from "../../api/client";
import { loginUser, loginJWT } from "../authActions";
import {
  ERROR,
  GET_CLIENTS,
  GET_TRAINERS,
  LOGIN_USER,
  UPDATE_MY_TRAINERS,
} from "../actionTypes";

export function signupUser(user) {
  return async (dispatch) => {
    const data = await authApi.signup(user);
    if (data.error) {
      dispatch({
        type: ERROR,
        error: data.error,
      });
      return data;
    }

    return dispatch(loginUser({ email: user.email, password: user.password }));
  };
}

// True when the current session is "view as" someone else (guardian→child or trainer→client).
// In those sessions the in-memory token is the viewed account's, so profile edits must not swap it.
const inDelegatedSession = () =>
  typeof localStorage !== "undefined" &&
  (localStorage.getItem("JWT_VIEW_ONLY") === "true" ||
    Boolean(localStorage.getItem("JWT_DELEGATED_SESSION")));

export function enterClientAccount(clientId) {
  return async (dispatch) => {
    try {
      const data = await authApi.getClientAccessToken(clientId);

      if (!data.accessToken) {
        const error = data.error || "Unable to enter client view.";
        dispatch({
          type: ERROR,
          error,
        });
        return { error };
      }

      const currentAccess = getAccessToken();

      if (currentAccess && !hasDelegatedReturnAccessToken("trainer")) {
        setDelegatedReturnAccessToken("trainer", currentAccess);
      }

      localStorage.setItem("JWT_DELEGATED_SESSION", "trainer_client");
      localStorage.removeItem("JWT_VIEW_ONLY");
      await dispatch(loginJWT(data.accessToken));
      return data;
    } catch (err) {
      const error = "Unable to enter client view.";
      dispatch({
        type: ERROR,
        error,
      });
      return { error };
    }
  };
}

export function changePassword(currentPassword, newPassword) {
  return async (dispatch, getState) => {
    const data = await authApi.changePassword({ currentPassword, newPassword });
    if (data.error) return data;

    const accessToken = data.accessToken;
    const decodedAccessToken = jwt(accessToken);

    setAccessToken(accessToken);
    return dispatch({
      type: LOGIN_USER,
      agent: decodedAccessToken,
    });
  };
}

export function editUser(user) {
  return async (dispatch) => {
    const data = await authApi.updateUser({ ...user });

    if (!data || data.error || data.status === "error") {
      return dispatch({
        type: ERROR,
        error: (data && data.error) || "User not updated",
      });
    }
    // In a view-as (delegated) session the in-memory token belongs to the viewed account, and the
    // server omits a fresh token. Never swap the auth token here — it would drop the delegation
    // context, and on a failed/expired request would clear the session (signing you out).
    if (inDelegatedSession() || !data.accessToken) {
      return data;
    }
    setAccessToken(data.accessToken);
    return dispatch({
      type: LOGIN_USER,
      user: jwt(data.accessToken),
    });
  };
}

// Fetches daily training information

export function updateUserSettings(payload) {
  return async (dispatch) => {
    const data = await authApi.updateUser(payload);
    if (!data || data.error || data.status === "error") {
      return dispatch({
        type: ERROR,
        error: (data && data.error) || "Settings not updated",
      });
    }
    // See editUser: don't swap the auth token in a view-as session or when none is returned.
    if (inDelegatedSession() || !data.accessToken) {
      return data;
    }
    setAccessToken(data.accessToken);
    return dispatch({
      type: LOGIN_USER,
      user: jwt(data.accessToken),
    });
  };
}

export function updateThemeMode(mode) {
  return updateUserSettings({ themeMode: mode });
}

export function requestMyTrainers() {
  return async (dispatch, getState) => {
    let myTrainers = await accountApi.getMyTrainers();

    return dispatch({
      type: UPDATE_MY_TRAINERS,
      myTrainers,
    });
  };
}

export function requestClients() {
  return async (dispatch, getState) => {
    let clients = await accountApi.getMyClients();

    if (!Array.isArray(clients)) {
      dispatch({
        type: ERROR,
        error: clients?.error || "Unable to load clients.",
      });
      clients = [];
    }

    return dispatch({
      type: GET_CLIENTS,
      clients,
    });
  };
}

export function changeRelationshipStatus(client, accepted) {
  return async (dispatch, getState) => {
    accountApi.changeRelationshipStatus({ client, accepted }).then(() => dispatch(requestClients()));
  };
}

export function updateRelationshipProfile({ client, engagementStatus, serviceTags }) {
  return async (dispatch) => {
    const data = await accountApi.updateRelationshipProfile({
      client,
      engagementStatus,
      serviceTags,
    });

    if (data?.error || data?.message) {
      const error = data?.error || data?.message || "Unable to update client settings.";
      dispatch({
        type: ERROR,
        error,
      });
      return { error };
    }

    await dispatch(requestClients());
    return data;
  };
}

export function getTrainers() {
  return async (dispatch, getState) => {
    let trainers = await accountApi.getTrainers();

    return dispatch({
      type: GET_TRAINERS,
      trainers,
    });
  };
}

export function requestTrainer(trainer) {
  return async (dispatch, getState) => {
    let data = await accountApi.requestTrainer(trainer);
    if (data.status === "success") {
      dispatch(requestMyTrainers());
    }
  };
}

export function removeRelationship(trainer, client) {
  return async (dispatch, getState) => {
    const data = await accountApi.removeRelationship({ trainer, client });
    if (!data?.error) {
      dispatch(requestMyTrainers());
      dispatch(requestClients());
    }
  };
}

export function updateMetricsApproval(trainer, metricsApprovalRequired) {
  return async (dispatch) => {
    const data = await accountApi.updateMetricsApproval({ trainer, metricsApprovalRequired });
    if (data.error) {
      return dispatch({
        type: ERROR,
        error: data.error,
      });
    }

    return dispatch(requestMyTrainers());
  };
}
