import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { ArrowLeft, ArrowUp, LoaderCircle, ShieldCheck, UsersRound } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { EmptyChatState } from "./EmptyChatState";
import { ConnectionStatus } from "./ConnectionStatus";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { useChatStore } from "../../store/chatStore";
import { cn } from "../../utils/cn";
import { useI18n } from "../../i18n";

type ChatWindowProps = {
  className?: string;
  onBack?: () => void;
};

export function ChatWindow({ className, onBack }: ChatWindowProps) {
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const conversations = useChatStore((state) => state.conversations);
  const messagesByConversationId = useChatStore((state) => state.messagesByConversationId);
  const messageHistoryByConversationId = useChatStore((state) => state.messageHistoryByConversationId);
  const loadOlderMessages = useChatStore((state) => state.loadOlderMessages);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sendImageMessage = useChatStore((state) => state.sendImageMessage);
  const retryMessage = useChatStore((state) => state.retryMessage);
  const gatewayStatus = useChatStore((state) => state.gatewayStatus);
  const markConversationRead = useChatStore((state) => state.markConversationRead);
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestore = useRef<{
    conversationId: string;
    scrollHeight: number;
    scrollTop: number;
    targetRevision: number;
  } | null>(null);

  const conversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [activeConversationId, conversations]
  );
  const messages = conversation ? messagesByConversationId[conversation.id] ?? [] : [];
  const historyState = conversation ? messageHistoryByConversationId[conversation.id] : undefined;

  useEffect(() => {
    if (activeConversationId) {
      void markConversationRead(activeConversationId).catch(() => {
        // A later message or conversation refresh will retry the backend read marker.
      });
    }
  }, [activeConversationId, markConversationRead, messages.length]);

  useLayoutEffect(() => {
    const scrollArea = scrollRef.current;
    if (!scrollArea) return;
    const pending = pendingScrollRestore.current;
    if (
      pending &&
      pending.conversationId === activeConversationId &&
      (historyState?.olderPageRevision ?? 0) >= pending.targetRevision
    ) {
      scrollArea.scrollTop = pending.scrollTop + (scrollArea.scrollHeight - pending.scrollHeight);
      pendingScrollRestore.current = null;
      return;
    }
    if (pending?.conversationId === activeConversationId) return;
    pendingScrollRestore.current = null;
    scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: "smooth" });
  }, [activeConversationId, historyState?.olderPageRevision, messages.length]);

  async function handleLoadOlder() {
    const scrollArea = scrollRef.current;
    if (!conversation || !scrollArea || !historyState?.hasMore || historyState.loadingOlder) return;
    pendingScrollRestore.current = {
      conversationId: conversation.id,
      scrollHeight: scrollArea.scrollHeight,
      scrollTop: scrollArea.scrollTop,
      targetRevision: historyState.olderPageRevision + 1
    };
    try {
      await loadOlderMessages(conversation.id);
    } catch {
      pendingScrollRestore.current = null;
    }
  }

  if (!conversation) {
    return (
      <section className={cn("h-full min-h-0 flex-1 overflow-hidden bg-nebula-bg", className)}>
        <EmptyChatState />
      </section>
    );
  }

  return (
    <section className={cn("h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-nebula-bg", className)}>
      <header className="flex flex-col gap-3 border-b border-nebula-border bg-nebula-panel/[0.54] px-3 py-3 backdrop-blur-xl sm:px-5 sm:py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={onBack}
              aria-label={t("chat.backToConversations")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          {conversation.type === "group" ? (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white sm:h-11 sm:w-11">
              <UsersRound className="h-5 w-5" />
            </span>
          ) : (
            <Avatar name={conversation.title} online={conversation.online} size="lg" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-nebula-text">{conversation.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-nebula-muted">
              <Badge tone={conversation.type === "group" ? "violet" : conversation.online ? "emerald" : "slate"}>
                {conversation.type === "group" ? t("chat.groupChat") : conversation.online ? t("common.online") : t("common.offline")}
              </Badge>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-cyan-200" />
                {t("chat.ackEnabled")}
              </span>
            </div>
          </div>
        </div>
        <div className="hidden sm:block">
          <ConnectionStatus status={gatewayStatus} />
        </div>
        <div className="sm:hidden">
          <ConnectionStatus status={gatewayStatus} compact />
        </div>
      </header>

      <div ref={scrollRef} className="chat-scroll-area min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:space-y-5 sm:px-5 sm:py-6">
        {historyState?.hasMore ? (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={historyState.loadingOlder}
              icon={
                historyState.loadingOlder ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ArrowUp className="h-3.5 w-3.5" />
                )
              }
              onClick={() => void handleLoadOlder()}
            >
              {historyState.loadingOlder ? t("chat.loadingEarlier") : t("chat.loadEarlier")}
            </Button>
          </div>
        ) : null}
        <div className="mx-auto w-fit rounded-full border border-nebula-border bg-white/[0.04] px-3 py-1 text-xs text-nebula-muted">
          {t("common.today")}
        </div>
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            showSenderName={conversation.type === "group" && !message.isMine}
            onRetry={(messageId) => void retryMessage(conversation.id, messageId)}
          />
        ))}
      </div>

      <MessageInput
        disabled={gatewayStatus.state !== "connected"}
        onSend={(content) => sendMessage(conversation.id, content)}
        onSendImage={(file) => sendImageMessage(conversation.id, file)}
      />
    </section>
  );
}
