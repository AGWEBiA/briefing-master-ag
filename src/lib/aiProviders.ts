export type AIProvider = "perplexity" | "openai" | "gemini" | "firecrawl";

export interface ProviderInfo {
  id: AIProvider;
  name: string;
  emoji: string;
  description: string;
  docsUrl: string;
  defaultModel?: string;
  modelOptions?: string[];
  needsModel: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: "firecrawl",
    name: "Firecrawl",
    emoji: "🔥",
    description: "Extrai conteúdo limpo de sites/páginas para alimentar a engenharia reversa.",
    docsUrl: "https://www.firecrawl.dev/app/api-keys",
    needsModel: false,
  },
  {
    id: "perplexity",
    name: "Perplexity",
    emoji: "🔎",
    description: "Pesquisa em tempo real na web com citações para enriquecer o briefing.",
    docsUrl: "https://www.perplexity.ai/settings/api",
    defaultModel: "sonar",
    modelOptions: ["sonar", "sonar-pro", "sonar-reasoning", "sonar-reasoning-pro"],
    needsModel: true,
  },
  {
    id: "openai",
    name: "OpenAI",
    emoji: "🤖",
    description: "Modelos GPT para estruturar dados do briefing.",
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o-mini",
    modelOptions: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"],
    needsModel: true,
  },
  {
    id: "gemini",
    name: "Google Gemini",
    emoji: "✨",
    description: "Modelos Gemini do Google AI Studio para estruturar o briefing.",
    docsUrl: "https://aistudio.google.com/app/apikey",
    defaultModel: "gemini-2.0-flash",
    modelOptions: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    needsModel: true,
  },
];

export const getProvider = (id: AIProvider) =>
  PROVIDERS.find((p) => p.id === id)!;
