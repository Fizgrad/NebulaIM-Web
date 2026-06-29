import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Group } from "../types/group";
import { GroupList } from "../components/groups/GroupList";
import { GroupMemberList } from "../components/groups/GroupMemberList";
import { Modal } from "../components/common/Modal";
import { PageContainer } from "../components/layout/PageContainer";
import { useChatStore } from "../store/chatStore";

export function GroupsPage() {
  const navigate = useNavigate();
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const openConversationForGroup = useChatStore((state) => state.openConversationForGroup);

  function handleMessage(group: Group) {
    openConversationForGroup(group);
    navigate("/app/chat");
  }

  return (
    <PageContainer title="Groups" subtitle="Create, join, leave and inspect mock group conversations.">
      <GroupList onMessage={handleMessage} onMembers={setSelectedGroup} />
      <Modal open={Boolean(selectedGroup)} title={selectedGroup?.name ?? "Group members"} onClose={() => setSelectedGroup(null)}>
        <GroupMemberList members={selectedGroup?.members ?? []} />
      </Modal>
    </PageContainer>
  );
}
