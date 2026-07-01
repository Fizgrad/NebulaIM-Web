import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Binary,
  ChartNoAxesCombined,
  Database,
  Gauge,
  MessageSquare,
  Network,
  Radio,
  Server,
  Workflow,
  Zap
} from "lucide-react";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { Card } from "../components/common/Card";
import { Logo } from "../components/brand/Logo";
import { NebulaBackground } from "../components/brand/NebulaBackground";

const stack = ["React", "TypeScript", "Vite", "Tailwind CSS", "Zustand", "React Router", "Axios"];

const capabilities = [
  { title: "High Performance Gateway", icon: Gauge },
  { title: "Custom Binary Protocol", icon: Binary },
  { title: "Distributed Messaging", icon: Network },
  { title: "Kafka Push Pipeline", icon: Workflow },
  { title: "Redis Online Presence", icon: Radio },
  { title: "MySQL Persistence", icon: Database },
  { title: "Prometheus Monitoring", icon: ChartNoAxesCombined }
];

const architecture = ["Web Client", "Web Bridge", "Gateway /ws", "MessageService", "Kafka", "Storage"];

export function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-nebula-bg text-nebula-text">
      <NebulaBackground />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
        <Logo />
        <nav className="hidden items-center gap-6 text-sm text-nebula-muted md:flex">
          <a href="#features" className="hover:text-nebula-text">Capabilities</a>
          <a href="#architecture" className="hover:text-nebula-text">Architecture</a>
          <Link to="/dashboard" className="hover:text-nebula-text">Dashboard</Link>
        </nav>
        <Link to="/login">
          <Button variant="outline" size="sm">
            Launch
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:pt-20">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <Badge tone="cyan">A modern web client for NebulaIM</Badge>
            <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-normal text-white md:text-7xl">NebulaIM</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
              A modern distributed instant messaging system built with C++17, epoll, Reactor, gRPC, Kafka, Redis and MySQL.
            </p>
            <p className="mt-3 max-w-3xl text-base leading-7 text-nebula-muted">
              基于 C++17 / epoll / Reactor / gRPC / Kafka 的高性能分布式即时通信系统。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/login">
                <Button variant="primary" size="lg">
                  Launch Web Client
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/dashboard">
                <Button variant="secondary" size="lg">
                  View Dashboard
                  <Activity className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/admin">
                <Button variant="outline" size="lg">
                  Admin Console
                  <Server className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap gap-2">
              {stack.map((item) => (
                <Badge key={item} tone="slate">{item}</Badge>
              ))}
            </div>
          </motion.div>

          <Card className="relative overflow-hidden p-5">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-nebula-text">Real Gateway Session</p>
                <p className="mt-1 text-xs text-nebula-muted">Browser WebSocket binary Packet + Protobuf</p>
              </div>
              <Badge tone="emerald">Online</Badge>
            </div>
            <div className="space-y-3">
              {[
                ["Gateway TCP Long Connection", "9000", "connected"],
                ["Gateway RPC", "50055", "healthy"],
                ["MessageService", "50052", "ACK 18ms"],
                ["Kafka Push Pipeline", "9092", "stable"]
              ].map(([name, port, status]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-nebula-border bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-cyan-300/10 text-cyan-100">
                      <Server className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-nebula-text">{name}</p>
                      <p className="text-xs text-nebula-muted">port {port}</p>
                    </div>
                  </div>
                  <span className="text-xs text-emerald-200">{status}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-12">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Core Capabilities</h2>
              <p className="mt-2 text-sm text-nebula-muted">
                Login, sessions, direct chat, Gateway heartbeat, offline pull and ACK status run through the Bridge `/ws` Gateway path.
              </p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {capabilities.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-lg border border-violet-300/20 bg-violet-300/10 text-violet-100">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-nebula-text">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-nebula-muted">Designed as a focused showcase for the NebulaIM distributed backend.</p>
                </Card>
              );
            })}
          </div>
        </section>

        <section id="architecture" className="mx-auto max-w-7xl px-5 py-12">
          <Card className="p-5">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-white">Architecture Highlights</h2>
              <p className="mt-2 text-sm text-nebula-muted">
                Browser clients use the Bridge `/ws` endpoint, which proxies the same NebulaIM Packet protocol as native TCP clients.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-6">
              {architecture.map((item, index) => (
                <div key={item} className="relative rounded-lg border border-nebula-border bg-white/[0.04] p-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-gradient text-white">
                      {index === 0 ? <MessageSquare className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                    </span>
                    <span className="text-sm font-medium text-nebula-text">{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-5 py-8 text-sm text-nebula-muted">
        NebulaIM Web 是 NebulaIM 分布式即时通信系统的现代化 Web 客户端，用于展示登录、会话、消息收发、在线状态和系统监控等核心能力。
      </footer>
    </div>
  );
}
