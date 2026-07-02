import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import type { Message, MessageStatus } from "../../types/message";
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
  read: <CheckCheck className="h-3 w-3" />,
  failed: <AlertCircle className="h-3 w-3 text-red-200" />
};

export function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const senderName = message.senderName ?? `User ${message.fromUserId}`;

  return (
    <div className={cn("flex gap-3", message.isMine ? "justify-end" : "justify-start")}>
      {!message.isMine ? <Avatar name={senderName} src={message.senderAvatar} size="sm" /> : null}
      <div className={cn("flex max-w-[84%] flex-col sm:max-w-[78%] md:max-w-[62%]", message.isMine ? "items-end" : "items-start")}>
        <div
          className={cn(
            "flex w-fit max-w-full flex-col gap-1.5 rounded-lg px-4 py-3 shadow-panel transition-[width,max-width] duration-200",
            message.isMine
              ? "bg-primary-gradient text-white"
              : "border border-nebula-border bg-white/[0.06] text-slate-100"
          )}
        >
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</div>
          <div
            className={cn(
              "flex w-fit max-w-full items-center gap-1.5 self-end whitespace-nowrap text-[11px]",
              message.isMine ? "text-white/85" : "text-nebula-muted"
            )}
          >
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
    </div>
  );
}
