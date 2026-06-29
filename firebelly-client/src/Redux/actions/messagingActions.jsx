import { conversationApi } from "../../api/conversationApi";
import {
  UPDATE_CONVERSATIONS,
  UPSERT_CONVERSATION,
  SET_MESSAGES,
  ADD_MESSAGE,
  REMOVE_MESSAGE,
  MARK_CONVO_READ,
  ERROR,
} from "../actionTypes";

export function getConversations() {
  return async (dispatch) => {
    const data = await conversationApi.getConversations();
    if (!data || data.error) {
      return dispatch({ type: ERROR, error: data?.error || "Failed to load conversations" });
    }
    return dispatch({ type: UPDATE_CONVERSATIONS, conversations: data });
  };
}

export function openDirectConversation(userId) {
  return async (dispatch) => {
    const convo = await conversationApi.getOrCreateDirect(userId);
    if (!convo || convo.error) {
      dispatch({ type: ERROR, error: convo?.error || "Failed to open conversation" });
      return null;
    }
    dispatch({ type: UPSERT_CONVERSATION, conversation: convo });
    return convo;
  };
}

export function loadMessages(conversationId, opts = {}) {
  return async (dispatch) => {
    const data = await conversationApi.getMessages(conversationId, opts);
    if (!data || data.error) {
      return dispatch({ type: ERROR, error: data?.error || "Failed to load messages" });
    }
    return dispatch({
      type: SET_MESSAGES,
      conversationId,
      messages: data,
      prepend: Boolean(opts.before),
    });
  };
}

export function sendMessageTo(conversationId, body, attachments = []) {
  return async (dispatch) => {
    const message = await conversationApi.sendMessage(conversationId, body, attachments);
    if (!message || message.error) {
      dispatch({ type: ERROR, error: message?.error || "Failed to send message" });
      return null;
    }
    dispatch({ type: ADD_MESSAGE, conversationId, message, incrementUnread: false });
    return message;
  };
}

export function markConversationRead(conversationId) {
  return async (dispatch) => {
    dispatch({ type: MARK_CONVO_READ, conversationId }); // optimistic clear
    await conversationApi.markRead(conversationId);
  };
}

export function removeMessage(messageId, conversationId) {
  return async (dispatch) => {
    const data = await conversationApi.deleteMessage(messageId);
    if (!data || data.error) {
      return dispatch({ type: ERROR, error: data?.error || "Failed to delete message" });
    }
    return dispatch({ type: REMOVE_MESSAGE, conversationId, messageId });
  };
}

// Socket: a new message arrived (server emits only to the OTHER participants, so it's never mine).
export function receiveSocketMessage({ conversationId, message }) {
  return async (dispatch, getState) => {
    const known = (getState().conversations || []).some(
      (c) => String(c._id) === String(conversationId)
    );
    if (!known) return dispatch(getConversations()); // new conversation — refetch the list
    return dispatch({ type: ADD_MESSAGE, conversationId, message, incrementUnread: true });
  };
}

export function receiveSocketDeletedMessage({ conversationId, messageId }) {
  return async (dispatch) => dispatch({ type: REMOVE_MESSAGE, conversationId, messageId });
}
