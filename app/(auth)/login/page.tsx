"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="login-content">
      <p className="eyebrow">Área Privada</p>
      <h1>Entrar no Detetive</h1>
      <p>
        Acede ao dashboard premium com análise de hotéis, roteiros personalizados e radar em tempo real.
      </p>

      {error === "unauthorized" && (
        <p className="form-error">
          Esta conta Google não está autorizada. O Detetive de Viagens é de acesso restrito.
        </p>
      )}

      <GoogleSignInButton />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
