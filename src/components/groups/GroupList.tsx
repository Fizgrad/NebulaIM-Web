import { FormEvent, useMemo, useState } from "react";
import { LogIn, Plus, Search, UsersRound } from "lucide-react";
import type { Group } from "../../types/group";
import { GroupCard } from "./GroupCard";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Card } from "../common/Card";
import { useGroupStore } from "../../store/groupStore";

type GroupListProps = {
  onMessage: (group: Group) => void;
  onMembers: (group: Group) => void;
};

export function GroupList({ onMessage, onMembers }: GroupListProps) {
  const { groups, createGroup, joinGroup, leaveGroup, isLoading, error } = useGroupStore();
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinId, setJoinId] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter(
      (group) =>
        group.name.toLowerCase().includes(keyword) ||
        group.id.includes(keyword) ||
        group.ownerId.includes(keyword)
    );
  }, [groups, query]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupName.trim()) return;
    try {
      await createGroup(groupName.trim());
      setGroupName("");
    } catch {
      // Store owns the displayed error state.
    }
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinId.trim()) return;
    try {
      await joinGroup(joinId.trim());
      setJoinId("");
    } catch {
      // Store owns the displayed error state.
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <section className="space-y-3">
          <Input
            label="Search Joined Groups"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="group name or id"
            icon={<Search className="h-4 w-4" />}
          />

          <div className="grid gap-3 xl:grid-cols-2">
            {filtered.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onMessage={onMessage}
                onMembers={onMembers}
                onJoin={joinGroup}
                onLeave={leaveGroup}
              />
            ))}
          </div>
          {!isLoading && filtered.length === 0 ? (
            <div className="rounded-lg border border-nebula-border bg-white/[0.04] p-6 text-sm text-nebula-muted">
              No joined groups match this search. Create a group or join one by ID from the actions panel.
            </div>
          ) : null}
        </section>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                <Plus className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-nebula-text">Create Group</h3>
            </div>
            <form className="space-y-3" onSubmit={handleCreate}>
              <Input
                label="Group Name"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="new group name"
              />
              <Button type="submit" variant="primary" disabled={isLoading} className="h-11 w-full">
                <UsersRound className="h-4 w-4" />
                Create Group
              </Button>
            </form>
          </Card>

          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg border border-violet-300/20 bg-violet-300/10 text-violet-100">
                <LogIn className="h-4 w-4" />
              </span>
              <h3 className="text-sm font-semibold text-nebula-text">Join Group</h3>
            </div>
            <form className="space-y-3" onSubmit={handleJoin}>
              <Input
                label="Group ID"
                value={joinId}
                onChange={(event) => setJoinId(event.target.value)}
                placeholder="numeric group id"
                inputMode="numeric"
              />
              <Button type="submit" variant="outline" disabled={isLoading} className="h-11 w-full">
                <LogIn className="h-4 w-4" />
                Join Group
              </Button>
            </form>
          </Card>
        </div>
      </div>

      {error ? <div className="rounded-lg border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">{error}</div> : null}
    </div>
  );
}
