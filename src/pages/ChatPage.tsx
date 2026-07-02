import { useEffect } from "react";
import { ChatWindow } from "../components/chat/ChatWindow";
import { ConversationList } from "../components/chat/ConversationList";
import { useChatStore } from "../store/chatStore";

export function ChatPage() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const startGatewaySession = useChatStore((state) => state.startGatewaySession);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadMessages = useChatStore((state) => state.loadMessages);

  useEffect(() => {
    void startGatewaySession();
  }, [startGatewaySession]);

  useEffect(() => {
    let cancelled = false;

    async function refreshActiveConversation() {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        await loadConversations();
        if (activeConversationId) {
          await loadMessages(activeConversationId);
        }
      } catch {
        // Store-level logging owns refresh errors.
      }
    }

    const timer = window.setInterval(() => {
      void refreshActiveConversation();
    }, 3000);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshActiveConversation();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [activeConversationId, loadConversations, loadMessages]);

  return (
    <div className="flex h-screen min-w-0">
      <ConversationList />
      <ChatWindow />
    </div>
  );
}
