import Link from "next/link";

export default function DashboardNotFound() {
    return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Pagina nao encontrada</h2>
            <p style={{ opacity: 0.7, marginBottom: "1rem" }}>
                Esta secao nao existe no painel.
            </p>
            <Link
                href="/dashboard"
                style={{ color: "#c9a96e", textDecoration: "underline" }}
            >
                Voltar ao painel
            </Link>
        </div>
    );
}
