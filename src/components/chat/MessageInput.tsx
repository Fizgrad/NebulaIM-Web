import { KeyboardEvent, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "../common/Button";

type MessageInputProps = {
  disabled?: boolean;
  onSend: (content: string) => Promise<void> | void;
};

export function MessageInput({ disabled, onSend }: MessageInputProps) {
  const [value, setValue] = useState("");

  async function send() {
    const content = value.trim();
    if (!content || disabled) return;
    setValue("");
    await onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  return (
    <div className="border-t border-nebula-border bg-nebula-panel/80 p-4">
      <div className="flex items-end gap-3 rounded-lg border border-nebula-border bg-white/[0.05] p-2">
        <textarea
          value={value}
          disabled={disabled}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Type a message..."
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-nebula-text outline-none placeholder:text-slate-500"
        />
        <Button variant="primary" size="icon" onClick={() => void send()} disabled={disabled || !value.trim()} aria-label="Send message">
          <SendHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
