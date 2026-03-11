import type { ButtonHTMLAttributes, ReactNode } from "react";

interface LuxButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "gold" | "ghost";
}

export function LuxButton({ children, className = "", variant = "gold", ...props }: LuxButtonProps) {
  return (
    <button
      {...props}
      className={`lux-button ${variant === "ghost" ? "lux-button-ghost" : "lux-button-gold"} ${className}`.trim()}
    >
      {children}
    </button>
  );
}
