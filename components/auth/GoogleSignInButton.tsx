"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

import { LuxButton } from "@/components/luxury-ui/LuxButton";

export function GoogleSignInButton() {
  const searchParams = useSearchParams();

  const callbackUrl = useMemo(() => {
    const value = searchParams.get("callbackUrl");
    if (value && value.startsWith("/")) {
      return value;
    }

    return "/dashboard";
  }, [searchParams]);

  return (
    <LuxButton
      onClick={() => signIn("google", { callbackUrl })}
      type="button"
      variant="gold"
    >
      Entrar com Google
    </LuxButton>
  );
}
