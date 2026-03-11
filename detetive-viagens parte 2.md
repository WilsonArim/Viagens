1. Foco disperso das concorrentes → o que puxamos (com twist Detetive)
Foco da concorrente,Dor real que as pessoas gritam (X/Reddit 2026),Como puxamos para o Detetive (com personalidade protectora)
Itinerário + mapa + colaboração (Wanderlog),"Família discorda, ninguém decide, partilhar fica paywall ou confuso","Roteiros Anti-Massas com mapa interativo + polls familiares dentro de cada “Minhas Viagens”. Link para a mãe, pai e miúdos votarem. Detetive avisa: “3 votos contra este bairro — 7 queixas recentes no X de carteiristas.”"
Organização automática de reservas (TripIt),“Tenho 12 e-mails e não sei onde está nada”,Botão “Importar reservas” (Gmail/Outlook forward). Tudo cai na viagem. Detetive faz Raio-X automático: “Hotel importado tem taxa de limpeza escondida de 180 € — confirma ou cancela?”
Chat AI + recomendações locais (Mindtrip),Recomendações genéricas/tourist trap cheias de influencers,"Recomendações filtradas pelo Raio-X: só locais sem queixas recentes de “conta inflacionada”, “fila de 2h” ou “atendimento mau”. Detetive diz: “Este restaurante parece giro nas fotos, mas 68 % das reviews recentes chamam-lhe armadilha para turistas.”"
Group trips + polls/chat (FlowTrip),"“Fica tudo no WhatsApp uma semana, ninguém decide”",Polls nativos + chat familiar privado (só quem tem o link da viagem). Zero paywall.
AI itinerários rápidos + maps,Gera roteiro bonito mas irreal (18 km a pé com criança de 6 anos),“Roteiro Rápido em 30 segundos” mas sempre com alerta: “Este dia tem 18 km e 4 ladeiras — com miúdos de 12 e 8 anos vai ser inferno. Queres versão família real e equilibrada?”

2. As 4 dores que ainda não cobrimos (prioridade máxima — estas vão diferenciar-te já)

Colaboração familiar real (votos + partilha sem paywall)
Importação automática de reservas (o que mais irrita quem usa TripIt/Wanderlog)
Mapa com alertas reais de segurança/bairro/ruído (Radar pinta vermelho onde há queixas recentes)
Pace familiar adaptado (cansaço de crianças/idosos, ritmo “equilibrado” do Perfil)

Tudo isto se implementa em 7-10 dias porque já tens a estrutura de “Minhas Viagens” + histórico de conversas por card.
3. LLM ideal para cada módulo (setup vencedor 2026)
Híbrido Grok + Gemini — é o que os apps sérios de nicho estão a usar.
Módulo,LLM principal,LLM secundário (tools),Porquê
Raio-X (auditoria profunda),Grok,Gemini,Grok snifa porcaria no X como ninguém. Gemini traz reviews Google + dados estruturados
Roteiros Anti-Massas,Grok,Gemini,Grok cria roteiros cépticos e anti-stress. Gemini trata distâncias e mapas
Radar (alertas em tempo real),Grok,—,Grok tem pipeline nativo com X — imbatível em “preço subiu 40 % em 48 h” ou “greve amanhã”
Detetive Supremo (chat principal),Grok,Gemini (quando precisa de facts),"Grok tem o tom protector, direto e sem filtro corporativo. É o cérebro que decide e fala com o utilizador"

Para as novas features (mapa, polls, importação, recomendações locais):
Gemini como motor de precisão e velocidade
Grok como filtro céptico final (“isto cheira mal — mostro ou escondo?”)
Fluxo simples:
Utilizador → Detetive (Grok) → quando precisa de dados reais chama Gemini via tool → Grok recebe o resultado limpo e responde com personalidade protectora.