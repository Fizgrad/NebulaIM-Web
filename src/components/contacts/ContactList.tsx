import { FormEvent, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import type { User } from "../../types/user";
import { ContactCard } from "./ContactCard";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { useContactStore } from "../../store/contactStore";

type ContactListProps = {
  onMessage: (user: User) => void;
};

export function ContactList({ onMessage }: ContactListProps) {
  const { contacts, addFriend, deleteFriend, isLoading } = useContactStore();
  const [query, setQuery] = useState("");
  const [newFriend, setNewFriend] = useState("");

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return contacts;
    return contacts.filter(
      (user) => user.nickname.toLowerCase().includes(keyword) || user.username.toLowerCase().includes(keyword)
    );
  }, [contacts, query]);

  async function handleAddFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newFriend.trim()) return;
    await addFriend(newFriend.trim());
    setNewFriend("");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-[1fr_420px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search friends"
          icon={<Search className="h-4 w-4" />}
        />
        <form className="flex gap-2" onSubmit={handleAddFriend}>
          <Input
            value={newFriend}
            onChange={(event) => setNewFriend(event.target.value)}
            placeholder="username or user id"
            className="h-10"
          />
          <Button type="submit" variant="primary" disabled={isLoading}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </form>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {filtered.map((user) => (
          <ContactCard key={user.id} user={user} onMessage={onMessage} onDelete={deleteFriend} />
        ))}
      </div>
    </div>
  );
}
