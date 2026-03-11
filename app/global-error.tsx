"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div style={{ padding: "3rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
                    <h2 style={{ fontSize: "1.5rem", marginBottom: "0.75rem" }}>Algo correu mal</h2>
                    <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>
                        {error.message || "Erro inesperado na aplicacao."}
                    </p>
                    <button
                        onClick={reset}
                        style={{
                            padding: "0.6rem 1.4rem",
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
            </body>
        </html>
    );
}
