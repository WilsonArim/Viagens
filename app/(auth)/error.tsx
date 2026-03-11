"use client";

export default function AuthError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
            <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>Erro de autenticacao</h2>
            <p style={{ opacity: 0.7, marginBottom: "1rem" }}>
                {error.message || "Ocorreu um erro ao autenticar."}
            </p>
            <button
                onClick={reset}
                style={{
                    padding: "0.5rem 1.2rem",
                    borderRadius: "8px",
                    border: "1px solid #c9a96e",
                    background: "transparent",
                    color: "#c9a96e",
                    cursor: "pointer",
                }}
            >
                Tentar novamente
            </button>
        </div>
    );
}
