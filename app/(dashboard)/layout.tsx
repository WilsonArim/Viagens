import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/auth/SignOutButton";
import { getServerAuthSession } from "@/lib/auth";

const navItems = [
  { href: "/chat", label: "Detetive", icon: "🕵️" },
  { href: "/trips", label: "Minhas Viagens", icon: "✈️" },
  { href: "/agency-check", label: "Farejar Agência", icon: "🐾" },
  { href: "/saved-agencies", label: "Agências Guardadas", icon: "★" },
  { href: "/profile", label: "Perfil", icon: "👨‍👩‍👧" },
  { href: "/dashboard", label: "Resumo", icon: "📊" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">🔍</span>
          <div>
            <p className="brand-overline">O Meu Detetive</p>
            <h2 className="brand-title">Viagens</h2>
          </div>
        </div>

        <nav className="dashboard-nav">
          {navItems.map((item) => (
            <Link className="dashboard-nav-link" href={item.href} key={item.href}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-user">
          <div className="user-avatar">{(session.user.name ?? "V")[0].toUpperCase()}</div>
          <div className="user-info">
            <p>{session.user.name ?? "Viajante"}</p>
            <span>{session.user.email}</span>
          </div>
        </div>

        <SignOutButton />
      </aside>

      <div className="dashboard-main">
        <section className="dashboard-content">{children}</section>
      </div>
    </div>
  );
}
