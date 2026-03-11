import type { ModelContextTool } from "@/types/webmcp";

export type WebMCPToolName =
  | "get_user_preferences"
  | "analyze_hotel"
  | "generate_itinerary"
  | "get_travel_radar"
  | "get_trip_history"
  | "sniff_agency_reputation"
  | "read_instagram_bio"
  | "discover_complaint_urls"
  | "read_complaints_summary";

export interface DetetiveToolDefinition extends ModelContextTool {
  name: WebMCPToolName;
}

export function getToolDefinitions(): DetetiveToolDefinition[] {
  return [
    {
      name: "get_user_preferences",
      description: "Retorna perfil familiar, orçamento e restrições do utilizador autenticado.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
      },
    },
    {
      name: "analyze_hotel",
      description: "Executa o Raio-X de um hotel específico.",
      inputSchema: {
        type: "object",
        properties: {
          hotelName: { type: "string" },
          destination: { type: "string" },
        },
        required: ["hotelName", "destination"],
        additionalProperties: false,
      },
    },
    {
      name: "generate_itinerary",
      description: "Gera roteiro anti-massas cruzando destino e perfil familiar.",
      inputSchema: {
        type: "object",
        properties: {
          destination: { type: "string" },
          days: { type: "number", minimum: 1 },
        },
        required: ["destination", "days"],
        additionalProperties: false,
      },
    },
    {
      name: "get_travel_radar",
      description: "Pesquisa alertas em tempo real para o destino.",
      inputSchema: {
        type: "object",
        properties: {
          destination: { type: "string" },
        },
        required: ["destination"],
        additionalProperties: false,
      },
    },
    {
      name: "get_trip_history",
      description: "Retorna histórico de pesquisas do utilizador.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", minimum: 1, maximum: 50 },
        },
        additionalProperties: false,
      },
    },
    {
      name: "sniff_agency_reputation",
      description: "Pesquisa reputação online de uma agência de viagens portuguesa confirmada. Usa Google Business, portais de queixas e redes sociais.",
      inputSchema: {
        type: "object",
        properties: {
          commercialName: { type: "string", description: "Nome comercial curto da agência (ex: Multi Destinos)" },
          city: { type: "string", description: "Cidade ou distrito onde opera (opcional)" },
          website: { type: "string", description: "Website oficial se conhecido (opcional)" },
        },
        required: ["commercialName"],
        additionalProperties: false,
      },
    },
    {
      name: "read_instagram_bio",
      description: "Lê a bio de um perfil Instagram público para extrair NIF/RNAVT de uma agência de viagens.",
      inputSchema: {
        type: "object",
        properties: {
          instagramUrl: { type: "string", description: "URL completo do perfil Instagram (ex: https://instagram.com/agencia)" },
        },
        required: ["instagramUrl"],
        additionalProperties: false,
      },
    },
    {
      name: "discover_complaint_urls",
      description: "Pesquisa no Google para descobrir URLs oficiais da agência no Portal da Queixa e Trustpilot. Guarda os links na BD para consultas futuras.",
      inputSchema: {
        type: "object",
        properties: {
          agencyName: { type: "string", description: "Nome da agência a pesquisar" },
          nif: { type: "string", description: "NIF/NIPC da agência (opcional, melhora a precisão)" },
        },
        required: ["agencyName"],
        additionalProperties: false,
      },
    },
    {
      name: "read_complaints_summary",
      description: "Lê e resume queixas recentes de um URL já conhecido (Portal da Queixa ou Trustpilot).",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL directo da página de queixas" },
          source: { type: "string", enum: ["portalDaQueixa", "trustpilot"], description: "Plataforma de origem" },
        },
        required: ["url", "source"],
        additionalProperties: false,
      },
    },
  ];
}
