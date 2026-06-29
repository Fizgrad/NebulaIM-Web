import { FormEvent, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { Group } from "../../types/group";
import { GroupCard } from "./GroupCard";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { useGroupStore } from "../../store/groupStore";

type GroupListProps = {
  onMessage: (group: Group) => void;
  onMembers: (group: Group) => void;
};

export function GroupList({ onMessage, onMembers }: GroupListProps) {
  const { groups, createGroup, joinGroup, leaveGroup, isLoading } = useGroupStore();
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [joinId, setJoinId] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(keyword));
  }, [groups, query]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!groupName.trim()) return;
    await createGroup(groupName.trim());
    setGroupName("");
  }

  async function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!joinId.trim()) return;
    await joinGroup(joinId.trim());
    setJoinId("");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 xl:grid-cols-[1fr_360px_320px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search groups"
          icon={<Search className="h-4 w-4" />}
        />
        <form className="flex gap-2" onSubmit={handleCreate}>
          <Input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="New group name" className="h-10" />
          <Button type="submit" variant="primary" disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </form>
        <form className="flex gap-2" onSubmit={handleJoin}>
          <Input value={joinId} onChange={(event) => setJoinId(event.target.value)} placeholder="Group id" className="h-10" />
          <Button type="submit" variant="outline" disabled={isLoading}>
            Join
          </Button>
        </form>
      </div>

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
    </div>
  );
}
