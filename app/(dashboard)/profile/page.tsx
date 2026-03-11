import { FamilyProfileForm } from "@/components/forms/FamilyProfileForm";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProfilePage() {
  const session = await getServerAuthSession();

  const profile = session?.user?.id
    ? await prisma.familyProfile.findUnique({
        where: {
          userId: session.user.id,
        },
        include: {
          members: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      })
    : null;

  return (
    <div className="module-page">
      <p className="eyebrow">Perfil Familiar</p>
      <h1>Preferências Hiper-Personalizadas</h1>
      <p>Define orçamento, ritmo e interesses para a IA adaptar hotel, roteiro e radar em cada consulta.</p>
      <FamilyProfileForm initialProfile={profile} />
    </div>
  );
}
