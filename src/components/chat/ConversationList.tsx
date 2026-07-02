import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { Input } from "../common/Input";
import { useChatStore } from "../../store/chatStore";
import { cn } from "../../utils/cn";

type ConversationListProps = {
  className?: string;
};

export function ConversationList({ className }: ConversationListProps) {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(keyword));
  }, [conversations, query]);

  return (
    <section
      className={cn(
        "h-full min-h-0 w-full flex-col border-r border-nebula-border bg-nebula-panel/[0.62] backdrop-blur-xl md:w-[360px]",
        className
      )}
    >
      <div className="border-b border-nebula-border p-3 sm:p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-nebula-text">Messages</h2>
          <p className="mt-1 text-xs text-nebula-muted">Friend chats delivered through MessageService</p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          icon={<Search className="h-4 w-4" />}
        />
      </div>
      <div className="chat-scroll-area min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5 sm:p-3">
        {filtered.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            active={conversation.id === activeConversationId}
            onClick={() => setActiveConversationId(conversation.id)}
          />
        ))}
      </div>
    </section>
  );
}
