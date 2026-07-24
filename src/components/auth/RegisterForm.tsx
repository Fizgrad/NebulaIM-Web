import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, Sparkles, UserRound } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Spinner } from "../common/Spinner";
import { useAuthStore } from "../../store/authStore";
import { useI18n } from "../../i18n";

export function RegisterForm() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    clearError();
  }, [clearError]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError("");
    if (password !== confirmPassword) {
      setLocalError(t("auth.passwordMismatch"));
      return;
    }
    if (password.length < 6) {
      setLocalError(t("auth.passwordTooShort"));
      return;
    }
    try {
      await register(username, password, nickname);
      navigate("/login");
    } catch {
      // Store owns the visible API error state.
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Input
        label={t("auth.username")}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="nebula"
        icon={<UserRound className="h-4 w-4" />}
        autoComplete="username"
        maxLength={64}
      />
      <Input
        label={t("auth.nickname")}
        value={nickname}
        onChange={(event) => setNickname(event.target.value)}
        placeholder="Nebula Operator"
        icon={<Sparkles className="h-4 w-4" />}
        maxLength={64}
      />
      <Input
        label={t("auth.password")}
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        icon={<LockKeyhole className="h-4 w-4" />}
        autoComplete="new-password"
        maxLength={256}
      />
      <Input
        label={t("auth.confirmPassword")}
        type="password"
        value={confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
        icon={<LockKeyhole className="h-4 w-4" />}
        autoComplete="new-password"
        maxLength={256}
      />
      {localError || error ? (
        <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {localError || error}
        </div>
      ) : null}
      <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
        {isLoading ? <Spinner /> : null}
        {t("auth.register")}
      </Button>
      <p className="text-center text-sm text-nebula-muted">
        {t("auth.haveAccount")}{" "}
        <Link to="/login" className="font-medium text-cyan-200 hover:text-cyan-100">
          {t("auth.signIn")}
        </Link>
      </p>
    </form>
  );
}
