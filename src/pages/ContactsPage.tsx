import { useNavigate } from "react-router-dom";
import type { User } from "../types/user";
import { ContactList } from "../components/contacts/ContactList";
import { PageContainer } from "../components/layout/PageContainer";
import { useChatStore } from "../store/chatStore";

export function ContactsPage() {
  const navigate = useNavigate();
  const openConversationForUser = useChatStore((state) => state.openConversationForUser);

  function handleMessage(user: User) {
    openConversationForUser(user);
    navigate("/app/chat");
  }

  return (
    <PageContainer title="Contacts" subtitle="Manage friend relations and jump into single chat sessions.">
      <ContactList onMessage={handleMessage} />
    </PageContainer>
  );
}
