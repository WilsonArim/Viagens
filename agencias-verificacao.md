# Módulo de Verificação de Agências — Plano de Execução

## Objetivo

Validar agências de viagens portuguesas cruzando o registo oficial (Excel do Turismo de Portugal) com dados de reputação online (Google Places, Portal da Queixa, Trustpilot), usando **Lazy Loading + Cache 30 dias** e **zero cron jobs**.

---

## Contexto Atual

| Componente | Estado |
|---|---|
| `AgencyCheck` model | ✅ Existe — mas guarda **resultados de investigação IA**, não dados oficiais |
| `registos_avt_2026.xlsx` | ✅ Na raiz do projeto (583KB) — ficheiro semente |
| WebMCP tools | ✅ `sniff_agency_reputation` já definido |
| Google Places API | ❌ Não implementado |
| Base legal de agências | ❌ Não existe tabela dedicada |

---

## Tasks

### Fase 1: Schema Prisma + Seed

- [ ] **T1.1** — Criar modelo `Agency` no `schema.prisma` (dados do Excel + campos cache)
  → Verificar: `npx prisma validate` passa sem erros

- [ ] **T1.2** — Criar modelo `AgencyExternalLink` para URLs descobertos (Portal da Queixa, Trustpilot)
  → Verificar: `npx prisma validate`

- [ ] **T1.3** — Atualizar `AgencyCheck` para ter FK opcional para `Agency`
  → Verificar: `npx prisma validate`

- [ ] **T1.4** — Gerar e aplicar migration: `npx prisma migrate dev --name add-agency-registry`
  → Verificar: migration criada sem erros

- [ ] **T1.5** — Criar script `prisma/seed-agencies.ts` para ler o Excel e popular `Agency`
  → Verificar: `npx tsx prisma/seed-agencies.ts` → tabela `Agency` populada

### Fase 2: API Route — Lógica de Cache

- [ ] **T2.1** — Criar rota `app/api/agency/verify/route.ts` com lógica:
  1. Input: `{ query, type: "nif" | "rnavt" | "name" | "instagram" }`
  2. Lookup na tabela `Agency` (match local)
  3. Verificar cache: se `cacheExpiresAt > now()` → retornar dados em cache
  4. Se cache expirado ou inexistente → fetch externo + guardar + retornar
  → Verificar: resposta JSON correta para NIF/RNAVT existente na BD

- [ ] **T2.2** — Implementar helper `lib/agency-cache.ts`:
  - `checkCache(agencyId)` → retorna dados se válidos
  - `updateCache(agencyId, data)` → grava com `expiresAt = now + 30d`
  - `forceRefresh(agencyId)` → ignora cache, refaz fetch
  → Verificar: função exporta corretamente, TypeScript compila

- [ ] **T2.3** — Integrar Google Places API em `lib/maps/places.ts`:
  - Input: nome legal + morada
  - Output: `{ rating, reviewCount, reviews: Review[3] }`
  → Verificar: chamada com agência conhecida retorna rating

### Fase 3: WebMCP — Tools de Scraping

- [ ] **T3.1** — Adicionar tool `read_instagram_bio` ao WebMCP:
  - Input: `{ instagramUrl: string }`
  - Output: texto da bio (para extrair NIF/RNAVT)
  → Verificar: definição adicionada a `lib/webmcp/tools.ts`

- [ ] **T3.2** — Adicionar tool `discover_complaint_urls` ao WebMCP:
  - Input: `{ agencyName: string, nif?: string }`
  - Output: `{ portalDaQueixaUrl?, trustpilotUrl? }`
  → Verificar: definição adicionada a `lib/webmcp/tools.ts`

- [ ] **T3.3** — Adicionar tool `read_complaints_summary` ao WebMCP:
  - Input: `{ url: string, source: "portalDaQueixa" | "trustpilot" }`
  - Output: `{ totalComplaints, averageRating, recentComplaints: string[] }`
  → Verificar: definição adicionada a `lib/webmcp/tools.ts`

- [ ] **T3.4** — Implementar handlers para as 3 novas tools em `lib/webmcp/handlers.ts`
  → Verificar: handler mapeia corretamente `toolName → function`

### Fase 4: Verificação Final

- [ ] **T4.1** — Testar fluxo completo: NIF → match BD → cache miss → fetch Google Places → guardar → retornar
- [ ] **T4.2** — Testar fluxo Instagram: link IG → WebMCP lê bio → extrai RNAVT → match BD
- [ ] **T4.3** — Testar botão Refresh: forçar novo fetch ignorando cache

---

## Schema Prisma (Proposta)

```prisma
model Agency {
  id              String    @id @default(cuid())
  rnavt           String    @unique           // Ex: "1234"
  nif             String                       // NIF/NIPC
  legalName       String                       // Denominação Social
  commercialName  String?                      // Nome Comercial (pode diferir)
  address         String?                      // Morada completa
  city            String?                      // Cidade / Concelho
  district        String?                      // Distrito
  postalCode      String?                      // Código Postal
  phone           String?
  email           String?
  licenseType     String?                      // Tipo de licença
  status          String?                      // "Ativa", "Suspensa", etc.

  // --- Cache de dados externos (Lazy Loading) ---
  googleRating      Float?
  googleReviewCount Int?
  googleReviews     Json?                      // Array com as 3 últimas reviews
  googlePlaceId     String?
  googleCachedAt    DateTime?                  // Timestamp do último fetch Google

  complaintsSummary Json?                      // Resumo de queixas (PQ + TP)
  complaintsCachedAt DateTime?                 // Timestamp do último fetch queixas

  // --- URLs descobertos (persistem para sempre) ---
  externalLinks     AgencyExternalLink[]

  // --- Relações ---
  checks            AgencyCheck[]

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([nif])
  @@index([legalName])
  @@index([commercialName])
}

model AgencyExternalLink {
  id        String   @id @default(cuid())
  agencyId  String
  source    String   // "portalDaQueixa" | "trustpilot" | "instagram" | "facebook" | "website"
  url       String
  agency    Agency   @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([agencyId, source])
}
```

**Alteração ao `AgencyCheck` existente:**
```diff
 model AgencyCheck {
   id           String   @id @default(cuid())
   userId       String
   tripId       String?
+  agencyId     String?  // FK para Agency (registo oficial)
   cacheKey     String
   ...
+  agency  Agency?  @relation(fields: [agencyId], references: [id], onDelete: SetNull)
   user    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   trip    Trip?    @relation(fields: [tripId], references: [id], onDelete: SetNull)
 }
```

---

## Lógica de Cache (Pseudocódigo)

```typescript
// lib/agency-cache.ts
const CACHE_TTL_DAYS = 30;

export function isCacheValid(cachedAt: Date | null): boolean {
  if (!cachedAt) return false;
  const diffMs = Date.now() - cachedAt.getTime();
  return diffMs < CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
}

export async function getAgencyData(agencyId: string, forceRefresh = false) {
  const agency = await prisma.agency.findUnique({ 
    where: { id: agencyId },
    include: { externalLinks: true }
  });

  if (!agency) return null;

  const result: AgencyData = { ...agency };

  // Google Places — Lazy
  if (!forceRefresh && isCacheValid(agency.googleCachedAt)) {
    result.google = { rating: agency.googleRating, reviews: agency.googleReviews };
  } else {
    const places = await fetchGooglePlaces(agency.legalName, agency.address);
    await prisma.agency.update({
      where: { id: agencyId },
      data: {
        googleRating: places.rating,
        googleReviewCount: places.reviewCount,
        googleReviews: places.reviews,
        googlePlaceId: places.placeId,
        googleCachedAt: new Date(),
      }
    });
    result.google = places;
  }

  // Queixas — Lazy (primeiro descobre URLs, depois lê)
  if (!forceRefresh && isCacheValid(agency.complaintsCachedAt)) {
    result.complaints = agency.complaintsSummary;
  } else {
    let links = agency.externalLinks;
    
    // Fase Descoberta: se não temos URLs, pesquisar via WebMCP
    if (!links.find(l => l.source === 'portalDaQueixa')) {
      const discovered = await webmcp.discoverComplaintUrls(agency.legalName, agency.nif);
      // Guardar URLs permanentemente
      if (discovered.portalDaQueixaUrl) {
        await prisma.agencyExternalLink.upsert({ ... });
      }
    }
    
    // Fase Leitura: ir direto aos URLs guardados
    const complaints = await webmcp.readComplaintsSummary(links);
    await prisma.agency.update({
      where: { id: agencyId },
      data: { complaintsSummary: complaints, complaintsCachedAt: new Date() }
    });
    result.complaints = complaints;
  }

  return result;
}
```

---

## Estratégia de Seed

```typescript
// prisma/seed-agencies.ts
import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

async function main() {
  const workbook = XLSX.readFile('registos_avt_2026.xlsx');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet);

  console.log(`📋 ${rows.length} registos encontrados no Excel`);

  for (const row of rows) {
    await prisma.agency.upsert({
      where: { rnavt: row['RNAVT'] || row['Nº Registo'] },
      create: {
        rnavt: row['RNAVT'] || row['Nº Registo'],
        nif: row['NIF'] || row['NIPC'],
        legalName: row['Denominação Social'] || row['Nome'],
        commercialName: row['Nome Comercial'] || null,
        address: row['Morada'] || null,
        city: row['Concelho'] || row['Cidade'] || null,
        district: row['Distrito'] || null,
        postalCode: row['Código Postal'] || null,
        phone: row['Telefone'] || null,
        email: row['Email'] || null,
        licenseType: row['Tipo'] || null,
        status: row['Estado'] || 'Ativa',
      },
      update: {} // Não sobrescrever se já existe
    });
  }

  console.log('✅ Seed completo!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

> **Nota:** Os nomes das colunas no `row['...']` serão ajustados após inspecionar os headers reais do Excel.

---

## WebMCP — Novas Tools (Input Schemas)

```typescript
// Adições a lib/webmcp/tools.ts

{
  name: "read_instagram_bio",
  description: "Lê a bio de um perfil Instagram público para extrair NIF/RNAVT.",
  inputSchema: {
    type: "object",
    properties: {
      instagramUrl: { type: "string", description: "URL completo do perfil IG" },
    },
    required: ["instagramUrl"],
  },
},
{
  name: "discover_complaint_urls",
  description: "Pesquisa Google para descobrir URLs oficiais da agência no Portal da Queixa e Trustpilot.",
  inputSchema: {
    type: "object",
    properties: {
      agencyName: { type: "string" },
      nif: { type: "string" },
    },
    required: ["agencyName"],
  },
},
{
  name: "read_complaints_summary",
  description: "Lê e resume queixas recentes de um URL já conhecido (Portal da Queixa ou Trustpilot).",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string" },
      source: { type: "string", enum: ["portalDaQueixa", "trustpilot"] },
    },
    required: ["url", "source"],
  },
}
```

---

## Verificação

### Automatizada
- `npx prisma validate` — schema sem erros
- `npx prisma migrate dev --name add-agency-registry` — migration aplicada
- `npx tsx prisma/seed-agencies.ts` — tabela populada com registos do Excel
- `npm run build` — projeto compila sem erros TypeScript

### Manual (pelo utilizador)
1. Abrir Prisma Studio (`npx prisma studio`) → confirmar tabela `Agency` com registos
2. Fazer POST a `/api/agency/verify` com um NIF real → receber match + dados em cache
3. Repetir o mesmo POST → confirmar que retorna dados do cache (sem novo fetch)
4. Clicar "Refresh" no UI → confirmar que dados são actualizados

---

## Done When
- [x] Tabela `Agency` populada com dados do Excel
- [x] API `/api/agency/verify` funcional com lógica cache/fetch
- [x] WebMCP tools para Instagram, Portal da Queixa e Trustpilot definidos
- [x] Cache de 30 dias a funcionar (sem cron jobs)
