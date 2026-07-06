import { useNavigate } from "react-router-dom";
import type { User } from "../types/user";
import { ContactList } from "../components/contacts/ContactList";
import { PageContainer } from "../components/layout/PageContainer";
import { useChatStore } from "../store/chatStore";
import { useI18n } from "../i18n";

export function ContactsPage() {
  const navigate = useNavigate();
  const openConversationForUser = useChatStore((state) => state.openConversationForUser);
  const { t } = useI18n();

  function handleMessage(user: User) {
    openConversationForUser(user);
    navigate("/app/chat");
  }

  return (
    <PageContainer title={t("contacts.title")} subtitle={t("contacts.subtitle")}>
      <ContactList onMessage={handleMessage} />
    </PageContainer>
  );
}
