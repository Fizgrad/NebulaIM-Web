import { useEffect } from "react";
import { MessageSquareMore, UserRound } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { useChatStore } from "../../store/chatStore";
import { useContactStore } from "../../store/contactStore";

export function EmptyChatState() {
  const contacts = useContactStore((state) => state.contacts);
  const isLoading = useContactStore((state) => state.isLoading);
  const error = useContactStore((state) => state.error);
  const loadFriends = useContactStore((state) => state.loadFriends);
  const openConversationForUser = useChatStore((state) => state.openConversationForUser);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  return (
    <div className="grid h-full place-items-center overflow-y-auto p-8">
      <div className="w-full max-w-2xl">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <MessageSquareMore className="h-7 w-7" />
        </div>
        <div className="mt-5 text-center">
          <h2 className="text-lg font-semibold text-nebula-text">Start a conversation</h2>
          <p className="mt-2 text-sm text-nebula-muted">Select one of your friends to open a direct chat.</p>
        </div>

        <div className="mt-6 space-y-3">
          {contacts.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => openConversationForUser(user)}
              className="flex w-full items-center gap-4 rounded-lg border border-nebula-border bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.08]"
            >
              <Avatar name={user.nickname} color={user.avatarColor} online={user.status === "online"} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-nebula-text">{user.nickname}</span>
                <span className="mt-1 block truncate text-xs text-nebula-muted">@{user.username}</span>
              </span>
              <Badge tone={user.status === "online" ? "emerald" : "slate"}>{user.status}</Badge>
            </button>
          ))}
        </div>

        {!isLoading && contacts.length === 0 ? (
          <div className="mt-6 rounded-lg border border-nebula-border bg-white/[0.04] p-5 text-center">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-nebula-border bg-white/[0.04] text-nebula-muted">
              <UserRound className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-medium text-nebula-text">No friends yet</p>
            <p className="mt-1 text-sm text-nebula-muted">Add a friend from Contacts before starting a direct chat.</p>
          </div>
        ) : null}

        {error ? <p className="mt-4 rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</p> : null}
        {isLoading ? (
          <div className="mt-6 text-center text-sm text-nebula-muted">Loading friends...</div>
        ) : null}
      </div>
    </div>
  );
}
