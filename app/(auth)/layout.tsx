export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="auth-layout">
      <div className="ambient-glow ambient-one" />
      <div className="ambient-glow ambient-two" />
      <section className="auth-panel">{children}</section>
    </main>
  );
}
