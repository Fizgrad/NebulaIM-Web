import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import type { Message, MessageStatus } from "../../types/message";
import { mockUsers } from "../../mocks/users";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { formatShortTime } from "../../utils/time";
import { cn } from "../../utils/cn";

type MessageBubbleProps = {
  message: Message;
  onRetry?: (messageId: string) => void;
};

const statusIcon: Record<MessageStatus, JSX.Element> = {
  sending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3 text-cyan-100" />,
  failed: <AlertCircle className="h-3 w-3 text-red-200" />
};

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const sender = mockUsers.find((user) => user.id === message.fromUserId);

  return (
    <div className={cn("flex gap-3", message.isMine ? "justify-end" : "justify-start")}>
      {!message.isMine ? <Avatar name={sender?.nickname ?? "User"} color={sender?.avatarColor} size="sm" /> : null}
      <div className={cn("max-w-[78%] md:max-w-[62%]", message.isMine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "rounded-lg px-4 py-3 text-sm leading-relaxed shadow-panel",
            message.isMine
              ? "bg-primary-gradient text-white"
              : "border border-nebula-border bg-white/[0.06] text-slate-100"
          )}
        >
          {message.content}
        </div>
        <div className={cn("mt-1 flex items-center gap-1.5 text-[11px]", message.isMine ? "justify-end text-cyan-100/80" : "text-nebula-muted")}>
          <span>{formatShortTime(message.createdAt)}</span>
          {message.isMine ? (
            <>
              {statusIcon[message.status]}
              <span>{message.status}</span>
              {message.status === "failed" && onRetry ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onRetry(message.id)}>
                  Retry
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
