import { useEffect } from "react";
import { ChatWindow } from "../components/chat/ChatWindow";
import { ConversationList } from "../components/chat/ConversationList";
import { useChatStore } from "../store/chatStore";
import { clientLogger } from "../services/clientLogger";
import { cn } from "../utils/cn";

export function ChatPage() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const startGatewaySession = useChatStore((state) => state.startGatewaySession);
  const loadConversations = useChatStore((state) => state.loadConversations);
  const loadMessages = useChatStore((state) => state.loadMessages);
  const refreshReadState = useChatStore((state) => state.refreshReadState);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);

  useEffect(() => {
    void startGatewaySession().catch((error) => {
      clientLogger.warn("Gateway session start failed", error);
    });
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

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshActiveConversation();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [activeConversationId, loadConversations, loadMessages]);

  useEffect(() => {
    if (!activeConversationId) return;
    let cancelled = false;

    void refreshReadState(activeConversationId);
    const timer = window.setInterval(() => {
      if (cancelled || document.visibilityState === "hidden") return;
      void refreshReadState(activeConversationId);
    }, 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeConversationId, refreshReadState]);

  const hasActiveConversation = Boolean(activeConversationId);

  return (
    <div className="chat-viewport flex min-w-0 overflow-hidden">
      <ConversationList className={cn("md:flex", hasActiveConversation ? "hidden" : "flex")} />
      <ChatWindow
        className={cn("md:flex", hasActiveConversation ? "flex" : "hidden")}
        onBack={() => setActiveConversationId(null)}
      />
    </div>
  );
}
