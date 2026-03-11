# O Meu Detetive de Viagens — Plano de Execução

## Goal
Construir uma aplicação web de luxo para planeamento de viagens com 3 módulos de IA (Raio-X de Hotéis, Roteiros Anti-Massas, Radar em Tempo Real), autenticação Google OAuth, perfis familiares hiper-personalizados, UI dark premium e integração WebMCP para expor as funcionalidades do site como ferramentas nativas a agentes IA (Gemini/Copilot) no browser.

**Stack:** Next.js 14+ (App Router) · Prisma ORM · PostgreSQL · Gemini API · NextAuth.js · Framer Motion · TypeScript · WebMCP (`navigator.modelContext`)

---

## Fase 1: Fundação do Projeto

- [ ] **1.1** Inicializar Next.js com `npx -y create-next-app@latest ./` (TypeScript, App Router, ESLint) → Verify: `npm run dev` serve na porta 3000
- [ ] **1.2** Configurar Prisma ORM: `npm install prisma @prisma/client` + `npx prisma init` → Verify: ficheiro `prisma/schema.prisma` criado
- [ ] **1.3** Criar `docker-compose.yml` com PostgreSQL 16 (`port 5432`, db: `detetive_viagens`) → Verify: `docker compose up -d` + `psql` conecta
- [ ] **1.4** Instalar dependências core: `next-auth @auth/prisma-adapter @google/generative-ai framer-motion zod` → Verify: `package.json` atualizado
- [ ] **1.5** Configurar variáveis de ambiente em `.env`:
  - `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `GEMINI_API_KEY`
  → Verify: `.env.example` criado com placeholders

---

## Fase 2: Schema da Base de Dados

- [ ] **2.1** Definir schema Prisma com 5 modelos: `User`, `FamilyProfile`, `Member`, `TripSearch`, `HotelAnalysis` com relações (1:1, 1:N, N:1) → Verify: `npx prisma validate` sem erros
- [ ] **2.2** Gerar migração: `npx prisma migrate dev --name init` → Verify: tabelas criadas no PostgreSQL
- [ ] **2.3** Criar singleton do Prisma Client em `lib/prisma.ts` → Verify: import funciona sem erros de tipo

---

## Fase 3: Autenticação Google OAuth

- [ ] **3.1** Configurar NextAuth.js em `app/api/auth/[...nextauth]/route.ts` com Google Provider + PrismaAdapter → Verify: rota `/api/auth/signin` responde
- [ ] **3.2** Criar `lib/auth.ts` com `getServerSession` helper e configurações de segurança (JWT + cookies httpOnly) → Verify: sessão retorna `user.id` após login
- [ ] **3.3** Implementar middleware em `middleware.ts` para proteger rotas `/dashboard/*` → Verify: redirect para `/login` se não autenticado
- [ ] **3.4** Criar páginas `app/(auth)/login/page.tsx` + `layout.tsx` com botão "Entrar com Google" (UI luxo) → Verify: fluxo OAuth completo funciona no browser

---

## Fase 4: Landing Page & Design System Luxo

- [ ] **4.1** Criar design system em `components/luxury-ui/` com tokens: cores dark (background `#0a0a0a`, gold accent `#c9a96e`, texto offwhite `#e8e4dc`), tipografia premium (font Inter/Playfair Display) → Verify: ficheiro CSS global aplicado
- [ ] **4.2** Construir landing page `app/page.tsx` com hero de alto impacto: headline forte, CTA animado, parallax subtil com Framer Motion → Verify: abrir `/` no browser mostra design premium dark
- [ ] **4.3** Criar layout de dashboard `app/(dashboard)/layout.tsx` com sidebar elegante, user profile, navegação entre 3 módulos → Verify: navegação funciona entre `/xray`, `/itinerary`, `/radar`

---

## Fase 5: Perfil Familiar (CRUD)

- [ ] **5.1** Criar API routes em `app/api/profile/route.ts` (GET/POST/PUT) para `FamilyProfile` + `Member` com validação Zod → Verify: `curl POST /api/profile` cria perfil com membros
- [ ] **5.2** Criar formulário em `components/forms/FamilyProfileForm.tsx`: campos para orçamento, restrições alimentares, membros da família (nome, idade, hobbies, interesses) → Verify: formulário submete e persiste na DB
- [ ] **5.3** Página de perfil `app/(dashboard)/profile/page.tsx` com listagem de membros e edição inline → Verify: dados carregam e atualizam corretamente

---

## Fase 6: WebMCP — Tool Definitions & Manifesto

> **Conceito:** Expor as funcionalidades do site como tools invocáveis por agentes IA (Gemini no Chrome, Copilot no Edge) via `navigator.modelContext`. Foco apenas em **consulta/pesquisa** — zero transações financeiras.

- [ ] **6.1** Criar `public/.well-known/mcp-manifest.json` com a declaração de capacidades do site:
  ```json
  {
    "schema_version": "1.0",
    "name": "O Meu Detetive de Viagens",
    "description": "Plataforma de inteligência para viagens de luxo com análise de hotéis, roteiros culturais e radar em tempo real.",
    "auth": {
      "type": "session_inheritance",
      "requires_login": true,
      "login_url": "/login"
    },
    "capabilities": {
      "tools": true,
      "resources": false,
      "prompts": false
    },
    "tools_registration": "imperative"
  }
  ```
  → Verify: `curl http://localhost:3000/.well-known/mcp-manifest.json` retorna JSON válido

- [ ] **6.2** Criar `lib/webmcp/tools.ts` com definições das 5 WebMCP Tools (read-only):

  | Tool Name | Descrição | Input Schema | Output |
  |-----------|-----------|-------------|--------|
  | `get_user_preferences` | Retorna perfil familiar, orçamento e restrições | `{}` (sem input — usa sessão) | `FamilyProfile + Member[]` |
  | `analyze_hotel` | Executa Raio-X de um hotel específico | `{ hotelName: string, destination: string }` | Veredito, Red Flags, Índice |
  | `generate_itinerary` | Gera roteiro anti-massas cruzado com perfil | `{ destination: string, days: number }` | Itinerário por dia/período |
  | `get_travel_radar` | Pesquisa alertas em tempo real para destino | `{ destination: string }` | Alertas, fontes, pivoting |
  | `get_trip_history` | Retorna histórico de pesquisas do utilizador | `{ limit?: number }` | `TripSearch[]` |

  → Verify: ficheiro exporta array de `ModelContextTool` com `name`, `description` e `inputSchema` tipados

- [ ] **6.3** Criar `lib/webmcp/register.ts` — script client-side que regista as tools via API imperativa:
  ```typescript
  // Registar tools no browser via navigator.modelContext
  if ('modelContext' in navigator) {
    const tools = getToolDefinitions();
    for (const tool of tools) {
      navigator.modelContext.registerTool(tool);
    }
  }
  ```
  → Verify: em Chrome Canary 146+ com flag `chrome://flags/#web-mcp` ativa, `navigator.modelContext` é acessível e as tools são registadas sem erros na consola

- [ ] **6.4** Criar `lib/webmcp/handlers.ts` — handlers de execução para cada tool, que reutilizam a lógica existente dos API routes (Fases 8-10):
  - `get_user_preferences` → chama `GET /api/profile` internamente
  - `analyze_hotel` → chama `POST /api/gemini/xray` internamente
  - `generate_itinerary` → chama `POST /api/gemini/itinerary` internamente
  - `get_travel_radar` → chama `POST /api/gemini/radar` internamente
  - `get_trip_history` → chama `GET /api/trips` internamente
  → Verify: handler de cada tool retorna dados válidos quando invocado com `navigator.modelContext.executeTool('tool_name', params)`

---

## Fase 7: WebMCP — Autenticação por Session-Inheritance & Interface Humano-IA

- [ ] **7.1** Implementar session-inheritance: as WebMCP tools executam **dentro do browser session do utilizador logado** — sem troca de credenciais. O handler verifica sessão via `getServerSession()` antes de retornar dados. Se não autenticado, retorna erro `{ error: "auth_required", login_url: "/login" }` → Verify: tool `get_user_preferences` retorna dados com sessão ativa e erro sem sessão

- [ ] **7.2** Adicionar validação de input com Zod em cada handler WebMCP — os schemas de input declarados no manifesto devem coincidir com a validação server-side → Verify: input inválido (ex: `days: -1`) retorna erro descritivo, não crash

- [ ] **7.3** Criar componente `components/ai/WebMCPStatus.tsx` — indicador visual no dashboard quando a IA está a invocar uma tool:
  - Estado `idle`: ícone subtil "AI-Ready" no header (badge dourado)
  - Estado `processing`: animação pulse + texto "O Detetive está a investigar..." com nome da tool ativa
  - Estado `complete`: flash de confirmação + preview do resultado
  - Usar `navigator.modelContext.addEventListener('toolinvocation', ...)` para escutar eventos
  → Verify: ao invocar uma tool manualmente no console, o indicador visual muda de estado no UI

- [ ] **7.4** Adicionar `<WebMCPProvider>` no layout do dashboard `app/(dashboard)/layout.tsx`:
  - Importa e regista tools ao montar (client-side `useEffect`)
  - Disponibiliza estado WebMCP via React Context para componentes filhos
  - Graceful fallback: se `navigator.modelContext` não existe, funciona normalmente sem WebMCP
  → Verify: dashboard carrega sem erros tanto em browsers com WebMCP como sem

---

## Fase 8: Módulo A — Raio-X de Hotéis

- [ ] **8.1** Criar wrapper Gemini em `lib/gemini.ts` com instância configurada (model, safety settings, temperature) → Verify: chamada de teste retorna resposta válida
- [ ] **8.2** Criar API route `app/api/gemini/xray/route.ts` que recebe nome do hotel + reviews, envia prompt estruturado do "Detetive de Hospitalidade" (XML tags, Padrão das Caraíbas) → Verify: resposta contém Veredito, Índice de Fartura, Red Flags, Experiência Real
- [ ] **8.3** Construir página `app/(dashboard)/xray/page.tsx` com input de hotel, área de resultados com cards visuais (verde/amarelo/vermelho para veredito), progressive disclosure nos detalhes → Verify: pesquisar hotel mostra análise formatada com animações
- [ ] **8.4** Implementar cache de análises na tabela `HotelAnalysis` → Verify: segunda pesquisa do mesmo hotel retorna do cache

---

## Fase 9: Módulo B — Roteiros Anti-Massas

- [ ] **9.1** Criar API route `app/api/gemini/itinerary/route.ts` com prompt do "Arquiteto de Culturas" — cruza perfil familiar + destino, aplica lógica manhã/almoço/tarde/nota → Verify: resposta segue estrutura de roteiro por dia
- [ ] **9.2** Construir página `app/(dashboard)/itinerary/page.tsx` com formulário (destino, datas, nº dias) + visualização timeline do roteiro gerado → Verify: roteiro aparece com separação por período do dia
- [ ] **9.3** Guardar pesquisas na tabela `TripSearch` com resultados JSON → Verify: histórico de roteiros persiste e é listável

---

## Fase 10: Módulo C — Radar em Tempo Real

- [ ] **10.1** Criar API route `app/api/gemini/radar/route.ts` com Google Search Grounding ativado + prompt da "Sentinela de Viagens" (temperatura 1.0, dados da última semana) → Verify: resposta inclui `groundingMetadata` com fontes e citações
- [ ] **10.2** Construir página `app/(dashboard)/radar/page.tsx` com input de destino + cards de alertas (Segurança, Infraestrutura, Eventos, Elogios) com links para fontes originais → Verify: pesquisar destino mostra alertas com referências clicáveis
- [ ] **10.3** Destacar visualmente alertas de risco com badge "ALERTA" no topo + sugestões de Pivoting → Verify: alertas médios/altos aparecem destacados em vermelho/laranja

---

## Fase 11: Polimento & Segurança

- [ ] **11.1** Implementar filtros de segurança IA (safety settings do Gemini: `BLOCK_MEDIUM_AND_ABOVE` para harassment/hate) → Verify: prompt ofensivo é bloqueado
- [ ] **11.2** Validar todos os inputs com Zod em cada API route (destinos, idades, nomes) → Verify: payload inválido retorna 400 com mensagem clara
- [ ] **11.3** Garantir API keys nunca expostas no client — todas as chamadas Gemini via Server Components ou Route Handlers → Verify: `GEMINI_API_KEY` não aparece no bundle (`npm run build` + inspeção)
- [ ] **11.4** Adicionar responsividade mobile-first a todas as páginas → Verify: UI funcional em viewport 375px no browser
- [ ] **11.5** Adicionar micro-interações com Framer Motion: transições de página, loading states animados, hover effects nos cards → Verify: interações fluidas e suaves no browser
- [ ] **11.6** Rate-limiting nas WebMCP tools: máximo 10 invocações/minuto por sessão para prevenir abuso por agentes → Verify: 11ª chamada no mesmo minuto retorna `429 Too Many Requests`

---

## Fase 12: Verificação Final

- [ ] **12.1** `npm run build` — zero erros TypeScript → Verify: build completo com sucesso
- [ ] **12.2** Testar fluxo completo no browser: Login → Perfil → Raio-X → Roteiro → Radar → Logout → Verify: toda a jornada funciona sem erros
- [ ] **12.3** Testar fluxo WebMCP em Chrome Canary: abrir site logado → Gemini invoca `get_user_preferences` → invoca `analyze_hotel` com dados do perfil → UI mostra indicador de processamento → Verify: resultado correto retornado ao agente IA + indicador visual funciona
- [ ] **12.4** Executar scripts de auditoria relevantes:
  - `python .agent/skills/vulnerability-scanner/scripts/security_scan.py .` (segurança)
  - `python .agent/skills/frontend-design/scripts/ux_audit.py .` (UX)
  - `python .agent/skills/seo-fundamentals/scripts/seo_checker.py .` (SEO)
  → Verify: zero bloqueadores críticos

---

## Done When
- [ ] Aplicação funcional com login Google OAuth
- [ ] 3 módulos de IA operacionais (Raio-X, Roteiros, Radar)
- [ ] Perfis familiares com CRUD completo
- [ ] UI dark premium com animações e responsividade
- [ ] Segurança: keys protegidas, inputs validados, IA filtrada
- [ ] **WebMCP: 5 tools registadas via `navigator.modelContext`, manifesto servido em `/.well-known/mcp-manifest.json`, session-inheritance funcional, indicadores visuais de invocação IA ativos**
- [ ] Build sem erros + auditorias sem bloqueadores críticos

## Notas
- **Google OAuth**: requer credenciais configuradas na [Google Cloud Console](https://console.cloud.google.com/) com redirect URI `http://localhost:3000/api/auth/callback/google`
- **Gemini API**: requer chave ativa em [Google AI Studio](https://aistudio.google.com/)
- **Google Search Grounding** (Módulo C): verificar disponibilidade na conta/API tier
- **PostgreSQL**: pode usar Docker local ou Neon/Supabase serverless como alternativa
- **WebMCP**: requer Chrome Canary 146+ com flag `chrome://flags/#web-mcp` ativada para testes. Em browsers sem suporte, o site funciona normalmente (graceful degradation)
- **WebMCP Scope**: apenas operações de leitura/pesquisa — nenhuma tool permite transações financeiras, edição de perfis ou eliminação de dados
- **WebMCP Types**: como a API `navigator.modelContext` é experimental, criar ficheiro `types/webmcp.d.ts` com declarações de tipo para TypeScript
