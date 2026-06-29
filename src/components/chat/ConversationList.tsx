import { FormEvent, useMemo, useState } from "react";
import { MessageSquarePlus, Search } from "lucide-react";
import { ConversationItem } from "./ConversationItem";
import { Input } from "../common/Input";
import { Button } from "../common/Button";
import { useChatStore } from "../../store/chatStore";
import { useSettingsStore } from "../../store/settingsStore";

export function ConversationList() {
  const conversations = useChatStore((state) => state.conversations);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const setActiveConversationId = useChatStore((state) => state.setActiveConversationId);
  const openDirectConversation = useChatStore((state) => state.openDirectConversation);
  const connectionMode = useSettingsStore((state) => state.connectionMode);
  const [query, setQuery] = useState("");
  const [directUserId, setDirectUserId] = useState("");
  const [directError, setDirectError] = useState("");
  const [openingDirect, setOpeningDirect] = useState(false);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return conversations;
    return conversations.filter((conversation) => conversation.title.toLowerCase().includes(keyword));
  }, [conversations, query]);

  async function handleOpenDirect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const userId = directUserId.trim();
    if (!/^\d+$/.test(userId)) {
      setDirectError("Use numeric user_id.");
      return;
    }
    setOpeningDirect(true);
    setDirectError("");
    try {
      await openDirectConversation(userId);
      setDirectUserId("");
    } catch (error) {
      setDirectError(error instanceof Error ? error.message : "Failed to open chat.");
    } finally {
      setOpeningDirect(false);
    }
  }

  return (
    <section className="flex h-screen w-full flex-col border-r border-nebula-border bg-nebula-panel/62 backdrop-blur-xl md:w-[360px]">
      <div className="border-b border-nebula-border p-4">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-nebula-text">Messages</h2>
          <p className="mt-1 text-xs text-nebula-muted">
            {connectionMode === "real" ? "Real Bridge + ACK timeline" : "Mock WebSocket + ACK timeline"}
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search conversations"
          icon={<Search className="h-4 w-4" />}
        />
        {connectionMode === "real" ? (
          <form className="mt-3 space-y-2" onSubmit={handleOpenDirect}>
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  value={directUserId}
                  onChange={(event) => setDirectUserId(event.target.value)}
                  placeholder="User ID"
                  inputMode="numeric"
                  className="h-10"
                />
              </div>
              <Button type="submit" variant="secondary" disabled={openingDirect} className="h-10 shrink-0 px-3">
                <MessageSquarePlus className="h-4 w-4" />
                Open
              </Button>
            </div>
            {directError ? <p className="text-xs text-red-300">{directError}</p> : null}
          </form>
        ) : null}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
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
