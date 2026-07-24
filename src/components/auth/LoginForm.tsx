import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Spinner } from "../common/Spinner";
import { useAuthStore } from "../../store/authStore";
import { useI18n } from "../../i18n";

export function LoginForm() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await login(username, password);
      navigate("/app/chat");
    } catch {
      // Store owns the visible error state.
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Input
        label={t("auth.username")}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder={t("auth.username")}
        icon={<UserRound className="h-4 w-4" />}
        autoComplete="username"
        maxLength={64}
      />
      <Input
        label={t("auth.password")}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={t("auth.password")}
        icon={<LockKeyhole className="h-4 w-4" />}
        autoComplete="current-password"
        maxLength={256}
      />
      {error ? <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
        {isLoading ? <Spinner /> : null}
        {t("auth.login")}
      </Button>
      <p className="text-center text-sm text-nebula-muted">
        {t("auth.newAccount")}{" "}
        <Link to="/register" className="font-medium text-cyan-200 hover:text-cyan-100">
          {t("auth.createAccount")}
        </Link>
      </p>
    </form>
  );
}
