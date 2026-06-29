import { useEffect } from "react";
import { ChatWindow } from "../components/chat/ChatWindow";
import { ConversationList } from "../components/chat/ConversationList";
import { useChatStore } from "../store/chatStore";

export function ChatPage() {
  const startGatewaySession = useChatStore((state) => state.startGatewaySession);

  useEffect(() => {
    void startGatewaySession();
  }, [startGatewaySession]);

  return (
    <div className="flex h-screen min-w-0">
      <ConversationList />
      <ChatWindow />
    </div>
  );
}
