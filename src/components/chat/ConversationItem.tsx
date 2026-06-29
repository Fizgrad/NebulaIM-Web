import { MessageSquare, UsersRound } from "lucide-react";
import type { Conversation } from "../../types/conversation";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { formatShortTime } from "../../utils/time";
import { cn } from "../../utils/cn";

type ConversationItemProps = {
  conversation: Conversation;
  active: boolean;
  onClick: () => void;
};

export function ConversationItem({ conversation, active, onClick }: ConversationItemProps) {
  const isGroup = conversation.type === "group";

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition",
        active
          ? "border-cyan-300/30 bg-cyan-300/10"
          : "border-transparent bg-transparent hover:border-nebula-border hover:bg-white/[0.04]"
      )}
    >
      {isGroup ? (
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 text-white">
          <UsersRound className="h-4 w-4" />
        </span>
      ) : (
        <Avatar name={conversation.title} online={conversation.online} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-3">
          <span className="truncate text-sm font-medium text-nebula-text">{conversation.title}</span>
          <span className="shrink-0 text-xs text-nebula-muted">{formatShortTime(conversation.lastMessageAt)}</span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            {isGroup ? <MessageSquare className="h-3.5 w-3.5 shrink-0 text-cyan-200" /> : null}
            <span className="truncate text-xs text-nebula-muted">{conversation.lastMessage}</span>
          </span>
          {conversation.unreadCount > 0 ? <Badge tone="cyan">{conversation.unreadCount}</Badge> : null}
        </span>
      </span>
    </button>
  );
}
