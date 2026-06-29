import type { User } from "../../types/user";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";

type GroupMemberListProps = {
  members: User[];
};

export function GroupMemberList({ members }: GroupMemberListProps) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div key={member.id} className="flex items-center gap-3 rounded-lg border border-nebula-border bg-white/[0.04] p-3">
          <Avatar name={member.nickname} color={member.avatarColor} online={member.status === "online"} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-nebula-text">{member.nickname}</p>
            <p className="truncate text-xs text-nebula-muted">@{member.username}</p>
          </div>
          <Badge tone={member.status === "online" ? "emerald" : member.status === "away" ? "amber" : "slate"}>
            {member.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}
