import Link from "next/link";

export default function NotFound() {
    return (
        <div style={{ padding: "3rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
            <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Pagina nao encontrada</h2>
            <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
                O endereco que procuras nao existe.
            </p>
            <Link
                href="/"
                style={{ color: "#c9a96e", textDecoration: "underline" }}
            >
                Voltar ao inicio
            </Link>
        </div>
    );
}
