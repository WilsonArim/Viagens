import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AnimatedCTA,
  AnimatedEyebrow,
  AnimatedFeatureCard,
  AnimatedFeatureGrid,
  AnimatedSubtitle,
  AnimatedTitle,
} from "@/components/luxury-ui/LandingAnimations";
import { LuxButton } from "@/components/luxury-ui/LuxButton";
import { getServerAuthSession } from "@/lib/auth";

const features = [
  {
    title: "Raio-X de Hotéis",
    description: "Veredito clínico com red flags, fartura real e experiência prática antes da reserva.",
  },
  {
    title: "Roteiros Anti-Massas",
    description: "Dias desenhados por interesses familiares, sem turismo de fila e sem perda de tempo.",
  },
  {
    title: "Radar em Tempo Real",
    description: "Alertas de segurança, eventos e infraestrutura com pivoting estratégico de viagem.",
  },
];

export default async function LandingPage() {
  const session = await getServerAuthSession();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  return (
    <main className="landing-root">
      <div className="ambient-glow ambient-one" />
      <div className="ambient-glow ambient-two" />

      <section className="landing-shell">
        <AnimatedEyebrow>Concierge Intelligence Suite</AnimatedEyebrow>

        <AnimatedTitle>O Meu Detetive de Viagens</AnimatedTitle>

        <AnimatedSubtitle>
          Planeamento de viagens de luxo com IA orientada a verdade operacional, cultura real e decisões sem ruído.
        </AnimatedSubtitle>

        <AnimatedCTA>
          <Link href="/login">
            <LuxButton>Entrar com Google</LuxButton>
          </Link>
          <a className="ghost-link" href="#modules">
            Explorar módulos
          </a>
        </AnimatedCTA>

        <AnimatedFeatureGrid>
          {features.map((feature) => (
            <AnimatedFeatureCard key={feature.title}>
              <h2>{feature.title}</h2>
              <p>{feature.description}</p>
            </AnimatedFeatureCard>
          ))}
        </AnimatedFeatureGrid>
      </section>
    </main>
  );
}
