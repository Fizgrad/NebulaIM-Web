import { MessageSquareMore } from "lucide-react";

export function EmptyChatState() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
          <MessageSquareMore className="h-7 w-7" />
        </div>
        <h2 className="mt-5 text-lg font-semibold text-nebula-text">Select a conversation to start messaging</h2>
        <p className="mt-2 max-w-sm text-sm text-nebula-muted">
          The mock gateway will stream incoming messages, heartbeat updates and delivery states.
        </p>
      </div>
    </div>
  );
}
