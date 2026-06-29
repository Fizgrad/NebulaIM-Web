export function NebulaBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-nebula-bg">
      <div className="absolute inset-0 bg-nebula-grid bg-[size:36px_36px] opacity-55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,58,237,0.18),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(6,182,212,0.14),transparent_30%),linear-gradient(180deg,rgba(7,10,19,0.18),#070A13_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(248,250,252,0.10)_1px,transparent_1px)] bg-[size:54px_54px] opacity-30" />
    </div>
  );
}
