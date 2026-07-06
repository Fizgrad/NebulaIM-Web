import { ChangeEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, SendHorizontal, X } from "lucide-react";
import { Button } from "../common/Button";
import { useI18n } from "../../i18n";
import { cn } from "../../utils/cn";

type MessageInputProps = {
  disabled?: boolean;
  onSend: (content: string) => Promise<void> | void;
  onSendImage: (file: File) => Promise<void> | void;
};

type SelectedImage = {
  file: File;
  previewUrl: string;
};

const maxImageBytes = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function MessageInput({ disabled, onSend, onSendImage }: MessageInputProps) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (selectedImage) URL.revokeObjectURL(selectedImage.previewUrl);
    };
  }, [selectedImage]);

  async function send() {
    if (disabled || uploading) return;
    const content = value.trim();

    if (selectedImage) {
      const image = selectedImage;
      setError("");
      setUploading(true);
      try {
        await onSendImage(image.file);
      } catch {
        setError(t("chat.imageUploadFailed"));
        setUploading(false);
        return;
      }

      try {
        if (content) await onSend(content);
        setValue("");
        setSelectedImage(null);
      } finally {
        setUploading(false);
      }
      return;
    }

    if (!content) return;
    setValue("");
    await onSend(content);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!allowedImageTypes.has(file.type)) {
      setError(t("chat.imageUnsupported"));
      return;
    }
    if (file.size > maxImageBytes) {
      setError(t("chat.imageTooLarge"));
      return;
    }

    if (selectedImage) URL.revokeObjectURL(selectedImage.previewUrl);
    setSelectedImage({ file, previewUrl: URL.createObjectURL(file) });
    setError("");
  }

  function removeImage() {
    if (selectedImage) URL.revokeObjectURL(selectedImage.previewUrl);
    setSelectedImage(null);
  }

  const sendDisabled = disabled || uploading || (!value.trim() && !selectedImage);

  return (
    <div className="shrink-0 border-t border-nebula-border bg-nebula-panel/80 p-3 sm:p-4">
      <div className="rounded-lg border border-nebula-border bg-white/[0.05] p-2">
        {selectedImage ? (
          <div className="mb-2 flex min-w-0 items-center gap-3 rounded-md border border-nebula-border bg-nebula-bg/60 p-2">
            <img src={selectedImage.previewUrl} alt={t("chat.selectedImage")} className="h-14 w-14 shrink-0 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-nebula-text">{selectedImage.file.name}</div>
              <div className="mt-0.5 text-xs text-nebula-muted">{Math.max(1, Math.round(selectedImage.file.size / 1024))} KB</div>
            </div>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={removeImage} aria-label={t("chat.removeImage")}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
        {error ? <div className="mb-2 rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-200">{error}</div> : null}
        <div className="flex items-end gap-2 sm:gap-3">
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={selectImage} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            disabled={disabled || uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label={t("chat.attachImage")}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          <textarea
            value={value}
            disabled={disabled || uploading}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={t("chat.typeMessage")}
            className="max-h-32 min-h-10 min-w-0 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-nebula-text outline-none placeholder:text-slate-500"
          />
          <Button variant="primary" size="icon" onClick={() => void send()} disabled={sendDisabled} aria-label={uploading ? t("chat.imageUploading") : t("chat.sendMessage")}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className={cn("mt-2 text-xs text-nebula-muted", uploading ? "block" : "hidden")}>{t("chat.imageUploading")}</div>
    </div>
  );
}
