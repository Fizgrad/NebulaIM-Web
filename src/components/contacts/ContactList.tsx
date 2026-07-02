import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Inbox, Search, SendHorizontal, X } from "lucide-react";
import type { User } from "../../types/user";
import type { FriendRequestView } from "../../store/contactStore";
import { ContactCard } from "./ContactCard";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { useContactStore } from "../../store/contactStore";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { formatRelativeTime } from "../../utils/time";

type ContactListProps = {
  onMessage: (user: User) => void;
};

export function ContactList({ onMessage }: ContactListProps) {
  const {
    contacts,
    incomingRequests,
    outgoingRequests,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    deleteFriend,
    isLoading,
    isSendingRequest,
    error,
    notice,
    loadFriends,
    clearNotice
  } = useContactStore();
  const [query, setQuery] = useState("");
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 3000);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return contacts;
    return contacts.filter(
      (user) => user.nickname.toLowerCase().includes(keyword) || user.username.toLowerCase().includes(keyword)
    );
  }, [contacts, query]);

  async function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await sendFriendRequest(friendIdentifier.trim(), requestMessage);
      setFriendIdentifier("");
      setRequestMessage("");
    } catch {
      // Store owns the displayed error state.
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1fr_520px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search friends"
          icon={<Search className="h-4 w-4" />}
        />
        <form className="grid gap-2 md:grid-cols-[minmax(120px,160px)_1fr_auto]" onSubmit={handleAddFriend}>
          <Input
            value={friendIdentifier}
            onChange={(event) => setFriendIdentifier(event.target.value)}
            placeholder="username or user id"
            className="h-10"
          />
          <Input
            value={requestMessage}
            onChange={(event) => setRequestMessage(event.target.value)}
            placeholder="request message"
            className="h-10"
            maxLength={255}
          />
          <Button type="submit" variant="primary" disabled={isSendingRequest} className="min-w-[152px]">
            <SendHorizontal className="h-4 w-4" />
            {isSendingRequest ? "Sending..." : "Send Request"}
          </Button>
        </form>
      </div>

      {isSendingRequest ? (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100" aria-live="polite">
          Sending friend request...
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{notice}</div> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <RequestPanel
          title="Incoming Requests"
          icon={<Inbox className="h-4 w-4" />}
          empty="No pending incoming requests."
          requests={incomingRequests}
          isLoading={isLoading}
          onAccept={acceptFriendRequest}
          onReject={rejectFriendRequest}
        />
        <RequestPanel
          title="Outgoing Requests"
          icon={<Clock3 className="h-4 w-4" />}
          empty="No pending outgoing requests."
          requests={outgoingRequests}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((user) => (
          <ContactCard key={user.id} user={user} onMessage={onMessage} onDelete={deleteFriend} />
        ))}
      </div>
      {!isLoading && filtered.length === 0 ? (
        <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-6 text-sm text-nebula-muted">
          No friends loaded.
        </div>
      ) : null}
    </div>
  );
}

type RequestPanelProps = {
  title: string;
  icon: JSX.Element;
  empty: string;
  requests: FriendRequestView[];
  isLoading: boolean;
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
};

function RequestPanel({ title, icon, empty, requests, isLoading, onAccept, onReject }: RequestPanelProps) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-nebula-text">{title}</h3>
        </div>
        <Badge tone={requests.length > 0 ? "cyan" : "slate"}>{requests.length}</Badge>
      </div>
      <div className="space-y-3">
        {requests.map((request) => (
          <FriendRequestCard
            key={request.id}
            request={request}
            isLoading={isLoading}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))}
        {!isLoading && requests.length === 0 ? (
          <div className="rounded-lg border border-nebula-border bg-white/[0.04] px-3 py-4 text-sm text-nebula-muted">{empty}</div>
        ) : null}
      </div>
    </Card>
  );
}

type FriendRequestCardProps = {
  request: FriendRequestView;
  isLoading: boolean;
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
};

function FriendRequestCard({ request, isLoading, onAccept, onReject }: FriendRequestCardProps) {
  const canAct = request.direction === "incoming" && onAccept && onReject;
  return (
    <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-nebula-text">{request.peer.nickname}</p>
            <Badge tone={request.direction === "incoming" ? "amber" : "cyan"}>
              {request.direction === "incoming" ? "Incoming" : "Outgoing"}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-nebula-muted">@{request.peer.username}</p>
          <p className="mt-2 text-sm text-slate-300">{request.message || "No message"}</p>
          <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(request.createdAt)}</p>
        </div>
        {canAct ? (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={isLoading}
              onClick={() => void onAccept(request.id)}
              aria-label={`Accept ${request.peer.nickname}`}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="danger"
              size="icon"
              disabled={isLoading}
              onClick={() => void onReject(request.id)}
              aria-label={`Reject ${request.peer.nickname}`}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
