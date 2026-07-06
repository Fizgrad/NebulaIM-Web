import { cn } from "../../utils/cn";
import { useI18n } from "../../i18n";

type SpinnerProps = {
  className?: string;
};

export function Spinner({ className }: SpinnerProps) {
  const { t } = useI18n();

  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-label={t("common.loading")}
    />
  );
}
