import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Clock3, Inbox, Search, SendHorizontal, UserPlus, X } from "lucide-react";
import type { User } from "../../types/user";
import type { FriendRequestView } from "../../store/contactStore";
import { ContactCard } from "./ContactCard";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { useContactStore } from "../../store/contactStore";
import { Card } from "../common/Card";
import { Badge } from "../common/Badge";
import { formatRelativeTime } from "../../utils/time";
import { useI18n } from "../../i18n";

type ContactListProps = {
  onMessage: (user: User) => void;
};

export function ContactList({ onMessage }: ContactListProps) {
  const { t, language } = useI18n();
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
    refreshPresence,
    clearNotice
  } = useContactStore();
  const [query, setQuery] = useState("");
  const [friendIdentifier, setFriendIdentifier] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshPresence();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [refreshPresence]);

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
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <section className="space-y-3">
          <Input
            label={t("contacts.searchFriends")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("contacts.searchPlaceholder")}
            icon={<Search className="h-4 w-4" />}
          />
          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((user) => (
              <ContactCard key={user.id} user={user} onMessage={onMessage} onDelete={deleteFriend} />
            ))}
          </div>
          {!isLoading && filtered.length === 0 ? (
            <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-6 text-sm text-nebula-muted">
              {t("contacts.empty")}
            </div>
          ) : null}
        </section>

        <aside className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <UserPlus className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-nebula-text">{t("contacts.addFriend")}</h3>
            </div>
            <form className="space-y-3" onSubmit={handleAddFriend}>
              <Input
                label={t("contacts.identifier")}
                value={friendIdentifier}
                onChange={(event) => setFriendIdentifier(event.target.value)}
                placeholder={t("contacts.identifierPlaceholder")}
                maxLength={64}
              />
              <Input
                label={t("contacts.requestMessage")}
                value={requestMessage}
                onChange={(event) => setRequestMessage(event.target.value)}
                placeholder={t("contacts.requestPlaceholder")}
                maxLength={255}
              />
              <Button type="submit" variant="primary" disabled={isSendingRequest} className="h-11 w-full">
                <SendHorizontal className="h-4 w-4" />
                {isSendingRequest ? t("contacts.sending") : t("contacts.sendRequest")}
              </Button>
            </form>
          </Card>

          <RequestPanel
            title={t("contacts.incomingRequests")}
            icon={<Inbox className="h-4 w-4" />}
            empty={t("contacts.noIncoming")}
            requests={incomingRequests}
            isLoading={isLoading}
            language={language}
            onAccept={acceptFriendRequest}
            onReject={rejectFriendRequest}
          />
          <RequestPanel
            title={t("contacts.outgoingRequests")}
            icon={<Clock3 className="h-4 w-4" />}
            empty={t("contacts.noOutgoing")}
            requests={outgoingRequests}
            isLoading={isLoading}
            language={language}
          />
        </aside>
      </div>

      {isSendingRequest ? (
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-sm text-cyan-100" aria-live="polite">
          {t("contacts.sendingRequest")}
        </div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">{notice}</div> : null}

    </div>
  );
}

type RequestPanelProps = {
  title: string;
  icon: JSX.Element;
  empty: string;
  requests: FriendRequestView[];
  isLoading: boolean;
  language: string;
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
};

function RequestPanel({ title, icon, empty, requests, isLoading, language, onAccept, onReject }: RequestPanelProps) {
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
            language={language}
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
  language: string;
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
};

function FriendRequestCard({ request, isLoading, language, onAccept, onReject }: FriendRequestCardProps) {
  const { t } = useI18n();
  const canAct = request.direction === "incoming" && onAccept && onReject;
  return (
    <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-nebula-text">{request.peer.nickname}</p>
            <Badge tone={request.direction === "incoming" ? "amber" : "cyan"}>
              {request.direction === "incoming" ? t("contacts.incoming") : t("contacts.outgoing")}
            </Badge>
          </div>
          <p className="mt-1 truncate text-xs text-nebula-muted">@{request.peer.username}</p>
          <p className="mt-2 text-sm text-slate-300">{request.message || t("common.noMessage")}</p>
          <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(request.createdAt, language)}</p>
        </div>
        {canAct ? (
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              disabled={isLoading}
              onClick={() => void onAccept(request.id)}
              aria-label={t("contacts.accept", { name: request.peer.nickname })}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="danger"
              size="icon"
              disabled={isLoading}
              onClick={() => void onReject(request.id)}
              aria-label={t("contacts.reject", { name: request.peer.nickname })}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
