"use client";

import { useMemo, useState } from "react";

import { LuxButton } from "@/components/luxury-ui/LuxButton";

interface MemberFormRow {
  id?: string;
  name: string;
  age: number;
  hobbiesText: string;
  interestsText: string;
}

interface ProfileResponse {
  id?: string;
  generalBudget: string;
  dietaryRestrictions: string[];
  travelPace: string;
  notes?: string | null;
  members: Array<{
    id: string;
    name: string;
    age: number;
    hobbies: string[];
    interests: string[];
  }>;
}

function normalizeTravelPace(value?: string): "slow" | "balanced" | "fast" {
  if (value === "slow" || value === "fast" || value === "balanced") {
    return value;
  }

  return "balanced";
}

export function FamilyProfileForm({ initialProfile }: { initialProfile: ProfileResponse | null }) {
  const [generalBudget, setGeneralBudget] = useState(initialProfile?.generalBudget ?? "Premium flexível");
  const [dietaryRestrictions, setDietaryRestrictions] = useState(
    (initialProfile?.dietaryRestrictions ?? []).join(", "),
  );
  const [travelPace, setTravelPace] = useState<"slow" | "balanced" | "fast">(
    normalizeTravelPace(initialProfile?.travelPace),
  );
  const [notes, setNotes] = useState(initialProfile?.notes ?? "");
  const [members, setMembers] = useState<MemberFormRow[]>(
    initialProfile?.members?.length
      ? initialProfile.members.map((member) => ({
          id: member.id,
          name: member.name,
          age: member.age,
          hobbiesText: member.hobbies.join(", "),
          interestsText: member.interests.join(", "),
        }))
      : [
          {
            name: "",
            age: 12,
            hobbiesText: "",
            interestsText: "",
          },
        ],
  );

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState(Boolean(initialProfile));

  const payload = useMemo(
    () => ({
      generalBudget,
      dietaryRestrictions: dietaryRestrictions
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      travelPace,
      notes: notes.trim() || undefined,
      members: members.map((member) => ({
        id: member.id,
        name: member.name.trim(),
        age: Number(member.age),
        hobbies: member.hobbiesText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        interests: member.interestsText
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      })),
    }),
    [dietaryRestrictions, generalBudget, members, notes, travelPace],
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/profile", {
        method: hasProfile ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Falha ao guardar perfil");
      }

      setHasProfile(true);
      setMessage("Perfil guardado com sucesso.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Erro inesperado");
    } finally {
      setLoading(false);
    }
  }

  function updateMember(index: number, next: Partial<MemberFormRow>) {
    setMembers((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) {
          return row;
        }

        return {
          ...row,
          ...next,
        };
      }),
    );
  }

  return (
    <form className="profile-form" onSubmit={onSubmit}>
      <div className="field-grid">
        <label>
          Orçamento Geral
          <input
            value={generalBudget}
            onChange={(event) => setGeneralBudget(event.target.value)}
            placeholder="Ex: Premium flexível"
            required
          />
        </label>

        <label>
          Ritmo de Viagem
          <select value={travelPace} onChange={(event) => setTravelPace(event.target.value as "slow" | "balanced" | "fast")}
          >
            <option value="slow">Lento</option>
            <option value="balanced">Equilibrado</option>
            <option value="fast">Dinâmico</option>
          </select>
        </label>

        <label className="full-width">
          Restrições Alimentares (separadas por vírgulas)
          <input
            value={dietaryRestrictions}
            onChange={(event) => setDietaryRestrictions(event.target.value)}
            placeholder="Sem lactose, vegetariano"
          />
        </label>

        <label className="full-width">
          Notas do Perfil
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ex: Preferência por hotéis silenciosos e atividades ao ar livre"
          />
        </label>
      </div>

      <div className="member-section">
        <div className="member-section-header">
          <h3>Membros da Família</h3>
          <LuxButton
            type="button"
            variant="ghost"
            onClick={() =>
              setMembers((current) => [
                ...current,
                { name: "", age: 8, hobbiesText: "", interestsText: "" },
              ])
            }
          >
            + Adicionar membro
          </LuxButton>
        </div>

        {members.map((member, index) => (
          <div className="member-row" key={member.id ?? `member-${index}`}>
            <label>
              Nome
              <input
                value={member.name}
                onChange={(event) => updateMember(index, { name: event.target.value })}
                required
              />
            </label>

            <label>
              Idade
              <input
                min={0}
                max={120}
                type="number"
                value={member.age}
                onChange={(event) => updateMember(index, { age: Number(event.target.value) })}
                required
              />
            </label>

            <label>
              Hobbies
              <input
                value={member.hobbiesText}
                onChange={(event) => updateMember(index, { hobbiesText: event.target.value })}
                placeholder="natação, fotografia"
              />
            </label>

            <label>
              Interesses
              <input
                value={member.interestsText}
                onChange={(event) => updateMember(index, { interestsText: event.target.value })}
                placeholder="história, arte"
              />
            </label>

            <LuxButton
              type="button"
              variant="ghost"
              onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}
              disabled={members.length === 1}
            >
              Remover
            </LuxButton>
          </div>
        ))}
      </div>

      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="form-success">{message}</p> : null}

      <LuxButton disabled={loading} type="submit">
        {loading ? "A guardar..." : hasProfile ? "Atualizar Perfil" : "Criar Perfil"}
      </LuxButton>
    </form>
  );
}
