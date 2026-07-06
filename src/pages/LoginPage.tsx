import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";
import { LoginForm } from "../components/auth/LoginForm";
import { useI18n } from "../i18n";

export function LoginPage() {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen place-items-center bg-nebula-bg px-5 py-10 text-nebula-text">
      <NebulaBackground />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-7 flex justify-center">
          <Logo />
        </Link>
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-nebula-text">{t("auth.loginTitle")}</h1>
            <p className="mt-2 text-sm text-nebula-muted">{t("auth.loginSubtitle")}</p>
          </div>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
