import { AlertCircle, Check, CheckCheck, Clock } from "lucide-react";
import type { Message, MessageStatus } from "../../types/message";
import { Avatar } from "../common/Avatar";
import { Button } from "../common/Button";
import { formatShortTime } from "../../utils/time";
import { cn } from "../../utils/cn";
import { useI18n, type TranslationKey } from "../../i18n";

type MessageBubbleProps = {
  message: Message;
  showSenderName?: boolean;
  onRetry?: (messageId: string) => void;
};

const statusIcon: Record<MessageStatus, JSX.Element> = {
  sending: <Clock className="h-3 w-3" />,
  sent: <Check className="h-3 w-3" />,
  delivered: <CheckCheck className="h-3 w-3" />,
  read: <CheckCheck className="h-3 w-3" />,
  failed: <AlertCircle className="h-3 w-3 text-red-200" />
};

export function MessageBubble({ message, showSenderName = false, onRetry }: MessageBubbleProps) {
  const { t, locale } = useI18n();
  const senderName = message.senderName ?? `User ${message.fromUserId}`;
  const isImage = message.contentType === "image";

  return (
    <div className={cn("flex gap-3", message.isMine ? "justify-end" : "justify-start")}>
      {!message.isMine ? <Avatar name={senderName} src={message.senderAvatar} size="sm" /> : null}
      <div className={cn("flex max-w-[84%] flex-col sm:max-w-[78%] md:max-w-[62%]", message.isMine ? "items-end" : "items-start")}>
        {showSenderName ? (
          <div className="mb-1 max-w-full truncate px-1 text-xs font-medium text-nebula-muted">{senderName}</div>
        ) : null}
        <div
          className={cn(
            "flex w-fit max-w-full flex-col gap-1.5 rounded-lg shadow-panel transition-[width,max-width] duration-200",
            isImage ? "p-1.5" : "px-4 py-3",
            message.isMine
              ? "bg-primary-gradient text-white"
              : "border border-nebula-border bg-white/[0.06] text-slate-100"
          )}
        >
          {isImage ? (
            <a href={message.content} target="_blank" rel="noreferrer" className="block max-w-full">
              <img
                src={message.content}
                alt={t("chat.imageMessage")}
                loading="lazy"
                className="max-h-72 max-w-full rounded-md object-contain sm:max-h-96"
              />
            </a>
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</div>
          )}
          <div
            className={cn(
              "flex w-fit max-w-full items-center gap-1.5 self-end whitespace-nowrap px-1 text-[11px]",
              message.isMine ? "text-white/85" : "text-nebula-muted"
            )}
          >
            <span>{formatShortTime(message.createdAt, locale)}</span>
            {message.isMine ? (
              <>
                {statusIcon[message.status]}
                <span>{t(`chat.status.${message.status}` as TranslationKey)}</span>
                {message.status === "failed" && onRetry ? (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={() => onRetry(message.id)}>
                    {t("common.retry")}
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
