# Detetive Supremo v2 — Plano de Evolução

## Goal
Transformar o Detetive Supremo num verdadeiro "tio protector" com personalidade forte, módulos integrados na viagem, e 4 novas features que fecham as dores reais identificadas no X/Reddit: **colaboração familiar, importação de reservas, mapa com radar, e pace familiar adaptado**.

---

## O que já existe (base sólida)
- ✅ Auth Google OAuth + perfil familiar
- ✅ Raio-X, Roteiro, Radar (APIs + integrados na página de viagem)
- ✅ Chat "Detetive Supremo" com Function Calling + histórico persistido
- ✅ "Minhas Viagens" com formulários inline
- ✅ Sidebar premium com emojis

---

## Fase A — System Prompt "Tio Protector" (sem mudanças de código pesadas)

- [ ] **A1.** Reescrever `DETECTIVE_SYSTEM` no chat route com a personalidade completa: tom detetive, sarcasmo protector, regras de ouro (nunca recomendar sem Raio-X, alertar sem piedade, estrutura Prós/Contras/Alternativa), palavras-chave obrigatórias ("cheira mal", "armadilha", "paz mental", etc.)
  → Verify: Perguntar ao chat e receber resposta com tom protector + estrutura obrigatória

- [ ] **A2.** Adicionar ao system prompt: integração com Perfil Familiar (carregar do DB e injectar no contexto), regra de pace familiar (nunca gerar 18km com miúdos), e memória de viagem activa
  → Verify: Chat responde "com miúdos de 8 e 12 isto vai ser inferno" quando roteiro é impossível

- [ ] **A3.** Melhorar respostas das funções `executeAnalyzeHotel`, `executeGenerateItinerary` para incluir Prós/Contras/Alternativa no prompt
  → Verify: Raio-X retorna `pros`, `cons`, `saferAlternative` no JSON

---

## Fase B — Mapa com Radar (visualização de alertas por zona)

- [ ] **B1.** Instalar Leaflet (`npm install leaflet react-leaflet @types/leaflet`) → Verify: import sem erros
- [ ] **B2.** Criar componente `components/maps/RadarMap.tsx` — mapa interactivo com markers coloridos (vermelho=perigo, amarelo=alerta, verde=ok) e popups com descrição do alerta
  → Verify: Componente renderiza sem erros com dados mock
- [ ] **B3.** Adicionar campo `coordinates` (lat/lng) ao output do Radar para cada alerta no prompt
  → Verify: API retorna `lat`/`lng` por alerta
- [ ] **B4.** Integrar `RadarMap` na página de detalhe da viagem (abaixo do formulário Radar)
  → Verify: Ao fazer Radar, mapa mostra pins com alertas coloridos

---

## Fase C — Colaboração Familiar (Polls + Partilha)

- [ ] **C1.** Novo modelo Prisma: `Poll` (question, tripId, options[]) e `PollVote` (pollId, memberName, optionIndex)
  → Verify: `prisma migrate dev` sem erros
- [ ] **C2.** API routes: `POST /api/trips/[id]/polls` (criar poll), `POST /api/trips/[id]/polls/[pollId]/vote` (votar), `GET /api/trips/[id]/polls` (listar)
  → Verify: curl cria poll e regista votos
- [ ] **C3.** UI: componente `PollCard.tsx` com opções clicáveis, barras de progresso, e resultado visual
  → Verify: Poll aparece na página da viagem com votos
- [ ] **C4.** Link de partilha: gerar URL pública (`/trips/[id]/vote?token=xxx`) para membros da família votarem SEM login
  → Verify: Abrir link mostra poll + permite votar

---

## Fase D — Importação de Reservas (email forward → Raio-X automático)

- [ ] **D1.** Criar API route `POST /api/trips/[id]/import` que recebe texto (email colado ou forwarded) e usa Gemini para extrair: hotel, datas, preço, localização
  → Verify: Colar email de booking retorna dados extraídos
- [ ] **D2.** Auto-trigger: após extração, executar `executeAnalyzeHotel` automaticamente e guardar como TripSearch na viagem
  → Verify: Importar email cria Raio-X automático na viagem
- [ ] **D3.** UI: botão "Importar Reserva" na viagem → modal com textarea para colar email → preview dos dados extraídos → confirmar
  → Verify: Fluxo completo funciona no browser

---

## Fase E — Pace Familiar Adaptado

- [ ] **E1.** Adicionar campos ao `FamilyProfile`: `pacePreference` (relaxed/moderate/active), `mobilityNotes` (texto livre)
  → Verify: Migrate + campo editável no perfil
- [ ] **E2.** Injectar pace no prompt do Roteiro: se `relaxed` → max 5km/dia, pausas de 2h; se `active` → max 12km; se crianças < 10 → forçar versão família
  → Verify: Roteiro para família com miúdos de 6 anos tem notas de cansaço e pausas
- [ ] **E3.** Chat detecta automaticamente: se utilizador pede roteiro e perfil tem crianças < 10, avisa "Com miúdos de X anos, ajustei o ritmo"
  → Verify: Chat avisa sem o utilizador pedir

---

## Fase F — UI Premium Final

- [ ] **F1.** Semáforos visuais em todos os resultados do Raio-X (verde/amarelo/vermelho com gradiente)
- [ ] **F2.** Cards de viagem na lista com preview de status (nº de hotéis analisados, alertas activos, roteiros gerados)
- [ ] **F3.** Loading states premium: skeleton screens nos resultados, shimmer nos cards
- [ ] **F4.** Mobile responsive: sidebar colapsável em < 768px
  → Verify: `npm run build` sem erros + UI funcional em 375px

---

## Fase G — Verificação Final

- [ ] **G1.** `npm run build` → zero erros
- [ ] **G2.** Teste de fluxo: Login → Criar viagem → Raio-X inline → Roteiro → Radar com mapa → Poll → Chat → Importar reserva
- [ ] **G3.** Teste mobile (375px viewport)

---

## Done When
- [ ] Chat com personalidade "tio protector" forte e consistente
- [ ] Mapa interactivo com alertas do Radar por zona
- [ ] Polls familiares com link de partilha sem login
- [ ] Importação de reservas com Raio-X automático
- [ ] Pace familiar adaptado nos roteiros
- [ ] Build sem erros + UI mobile

## Notas
- **LLM**: Usamos Gemini 2.5 Pro (único provider por agora). A arquitectura de Grok como "filtro céptico" pode ser adicionada quando disponível via API.
- **Leaflet**: Library open-source, zero custo, funciona offline. Não requer API key.
- **Polls públicos**: Token aleatório (cuid) no URL. Sem auth, mas rate-limited.
