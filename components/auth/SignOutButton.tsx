"use client";

import { signOut } from "next-auth/react";

import { LuxButton } from "@/components/luxury-ui/LuxButton";

export function SignOutButton() {
  return (
    <LuxButton onClick={() => signOut({ callbackUrl: "/login" })} type="button" variant="ghost">
      Sair
    </LuxButton>
  );
}
