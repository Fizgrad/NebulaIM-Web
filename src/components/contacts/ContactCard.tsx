import { MessageSquare, Trash2 } from "lucide-react";
import type { User } from "../../types/user";
import { Avatar } from "../common/Avatar";
import { Badge } from "../common/Badge";
import { Button } from "../common/Button";
import { Card } from "../common/Card";

type ContactCardProps = {
  user: User;
  onMessage: (user: User) => void;
  onDelete: (userId: string) => void;
};

export function ContactCard({ user, onMessage, onDelete }: ContactCardProps) {
  const online = user.status === "online";

  return (
    <Card className="p-4">
      <div className="flex items-center gap-4">
        <Avatar name={user.nickname} color={user.avatarColor} size="lg" online={online} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-nebula-text">{user.nickname}</h3>
            <Badge tone={online ? "emerald" : user.status === "away" ? "amber" : "slate"}>{user.status}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-nebula-muted">@{user.username}</p>
          <p className="mt-2 truncate text-xs text-slate-400">{user.gateway}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" size="icon" onClick={() => onMessage(user)} aria-label={`Message ${user.nickname}`}>
            <MessageSquare className="h-4 w-4" />
          </Button>
          <Button variant="danger" size="icon" onClick={() => onDelete(user.id)} aria-label={`Delete ${user.nickname}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
