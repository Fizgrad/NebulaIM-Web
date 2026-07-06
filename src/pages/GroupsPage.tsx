import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Group } from "../types/group";
import { GroupList } from "../components/groups/GroupList";
import { GroupMemberList } from "../components/groups/GroupMemberList";
import { Modal } from "../components/common/Modal";
import { PageContainer } from "../components/layout/PageContainer";
import { useChatStore } from "../store/chatStore";
import { useGroupStore } from "../store/groupStore";
import { useI18n } from "../i18n";

export function GroupsPage() {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const openConversationForGroup = useChatStore((state) => state.openConversationForGroup);
  const loadGroups = useGroupStore((state) => state.loadGroups);
  const loadGroupMembers = useGroupStore((state) => state.loadGroupMembers);
  const { t } = useI18n();

  useEffect(() => {
    void loadGroups().catch(() => {
      // Store owns the displayed error state.
    });
  }, [loadGroups]);

  function handleMessage(group: Group) {
    openConversationForGroup(group);
    navigate("/app/chat");
  }

  async function handleMembers(group: Group) {
    try {
      const members = await loadGroupMembers(group.id);
      setSelectedGroup({ ...group, members, memberCount: members.length });
    } catch {
      // Store owns the displayed error state.
    }
  }

  return (
    <PageContainer title={t("groups.title")} subtitle={t("groups.subtitle")}>
      <GroupList onMessage={handleMessage} onMembers={(group) => void handleMembers(group)} />
      <Modal open={Boolean(selectedGroup)} title={selectedGroup?.name ?? t("groups.membersTitle")} onClose={() => setSelectedGroup(null)}>
        <GroupMemberList members={selectedGroup?.members ?? []} />
      </Modal>
    </PageContainer>
  );
}
