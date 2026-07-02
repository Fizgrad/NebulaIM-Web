import { useEffect, useMemo, useRef } from "react";
import { ShieldCheck, UsersRound } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { EmptyChatState } from "./EmptyChatState";
import { ConnectionStatus } from "./ConnectionStatus";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { useChatStore } from "../../store/chatStore";

export function ChatWindow() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const messagesByConversationId = useChatStore((state) => state.messagesByConversationId);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const retryMessage = useChatStore((state) => state.retryMessage);
  const gatewayStatus = useChatStore((state) => state.gatewayStatus);
  const markConversationRead = useChatStore((state) => state.markConversationRead);
  const scrollRef = useRef<HTMLDivElement>(null);

  const conversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );
  const messages = conversation ? messagesByConversationId[conversation.id] ?? [] : [];

  useEffect(() => {
    if (activeConversationId) markConversationRead(activeConversationId);
  }, [activeConversationId, markConversationRead, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, activeConversationId]);

  if (!conversation) {
    return (
      <section className="h-screen flex-1 bg-nebula-bg">
        <EmptyChatState />
      </section>
    );
  }

  return (
    <section className="flex h-screen min-w-0 flex-1 flex-col bg-nebula-bg">
      <header className="flex flex-col gap-3 border-b border-nebula-border bg-nebula-panel/[0.54] px-5 py-4 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {conversation.type === "group" ? (
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white">
              <UsersRound className="h-5 w-5" />
            </span>
          ) : (
            <Avatar name={conversation.title} online={conversation.online} size="lg" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-nebula-text">{conversation.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-nebula-muted">
              <Badge tone={conversation.type === "group" ? "violet" : conversation.online ? "emerald" : "slate"}>
                {conversation.type === "group" ? "Group Chat" : conversation.online ? "Online" : "Offline"}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
                ACK enabled
              </span>
            </div>
          </div>
        </div>
        <ConnectionStatus status={gatewayStatus} />
      </header>

      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-5 py-6">
        <div className="mx-auto w-fit rounded-full border border-nebula-border bg-white/[0.04] px-3 py-1 text-xs text-nebula-muted">
          Today
        </div>
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} onRetry={(messageId) => void retryMessage(conversation.id, messageId)} />
        ))}
      </div>

      <MessageInput
        disabled={gatewayStatus.state !== "connected"}
        onSend={(content) => sendMessage(conversation.id, content)}
      />
    </section>
  );
}
