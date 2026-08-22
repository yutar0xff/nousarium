export const NEW_CONVERSATION = "nousarium:new-conversation";

let pendingNewConversation = false;

export function requestNewConversation() {
  pendingNewConversation = true;
  window.dispatchEvent(new Event(NEW_CONVERSATION));
}

export function consumeNewConversationRequest() {
  if (!pendingNewConversation) return false;
  pendingNewConversation = false;
  return true;
}

export function isNewConversationShortcut(event: {
  code: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}) {
  return (
    event.code === "KeyO" &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey
  );
}
