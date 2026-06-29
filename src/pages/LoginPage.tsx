import { Link } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";
import { LoginForm } from "../components/auth/LoginForm";

export function LoginPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-nebula-bg px-5 py-10 text-nebula-text">
      <NebulaBackground />
      <div className="w-full max-w-md">
        <Link to="/" className="mb-7 flex justify-center">
          <Logo />
        </Link>
        <Card className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white">Sign in to NebulaIM</h1>
            <p className="mt-2 text-sm text-nebula-muted">
              Sign in with a NebulaIM account. Production mode connects through the Web Bridge to the C++ Gateway.
            </p>
          </div>
          <LoginForm />
        </Card>
      </div>
    </div>
  );
}
