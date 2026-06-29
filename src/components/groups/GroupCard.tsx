import { LogIn, LogOut, MessageSquare, UsersRound } from "lucide-react";
import type { Group } from "../../types/group";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";
import { formatRelativeTime } from "../../utils/time";

type GroupCardProps = {
  group: Group;
  onMessage: (group: Group) => void;
  onMembers: (group: Group) => void;
  onJoin: (groupId: string) => void;
  onLeave: (groupId: string) => void;
};

export function GroupCard({ group, onMessage, onMembers, onJoin, onLeave }: GroupCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 text-white">
          <UsersRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-nebula-text">{group.name}</h3>
            <Badge tone="violet">{group.memberCount} members</Badge>
          </div>
          <p className="mt-1 text-xs text-nebula-muted">Created {formatRelativeTime(group.createdAt)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" onClick={() => onMessage(group)}>
              <MessageSquare className="h-4 w-4" />
              Chat
            </Button>
            <Button variant="secondary" size="sm" onClick={() => onMembers(group)}>
              <UsersRound className="h-4 w-4" />
              Members
            </Button>
            <Button variant="outline" size="sm" onClick={() => onJoin(group.id)}>
              <LogIn className="h-4 w-4" />
              Join
            </Button>
            <Button variant="danger" size="sm" onClick={() => onLeave(group.id)}>
              <LogOut className="h-4 w-4" />
              Leave
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
