import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LockKeyhole, UserRound } from "lucide-react";
import { Button } from "../common/Button";
import { Input } from "../common/Input";
import { Spinner } from "../common/Spinner";
import { useAuthStore } from "../../store/authStore";

export function LoginForm() {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuthStore();
  const [username, setUsername] = useState("demo");
  const [password, setPassword] = useState("nebulaim");

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
        label="Username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="demo"
        icon={<UserRound className="h-4 w-4" />}
        autoComplete="username"
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="nebulaim"
        icon={<LockKeyhole className="h-4 w-4" />}
        autoComplete="current-password"
      />
      {error ? <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      <Button type="submit" variant="primary" className="w-full" disabled={isLoading}>
        {isLoading ? <Spinner /> : null}
        Login
      </Button>
      <p className="text-center text-sm text-nebula-muted">
        New to NebulaIM?{" "}
        <Link to="/register" className="font-medium text-cyan-200 hover:text-cyan-100">
          Create an account
        </Link>
      </p>
    </form>
  );
}
