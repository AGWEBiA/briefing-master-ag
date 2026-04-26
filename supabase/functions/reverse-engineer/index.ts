// Engenharia reversa: dado um link, extrai conteúdo (Firecrawl, fallback fetch),
// enriquece com pesquisa (Perplexity, opcional) e usa LLM com tool calling
// para devolver os campos do briefing estruturados.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ===== Schema espelhado do frontend =====
// Todos os campos textuais que a IA pode preencher.
const FIELD_DESCRIPTIONS: Record<string, string> = {
  // Identidade
  nomeProduto: "Nome comercial do produto/infoproduto.",
  nicho: "Nicho de mercado (ex.: Marketing Digital, Emagrecimento).",
  categoriaProduto: "Uma destas: Curso Online | Mentoria | Consultoria | Evento/Workshop | Assinatura/Comunidade | E-book/Material Digital | Software/Ferramenta.",
  formatoEntrega: "Uma destas: Online ao Vivo | Gravado/Assíncrono | Híbrido | Presencial.",
  transformacaoPrincipal: "Resultado final/transformação prometida ao cliente.",
  tempoResultado: "Tempo estimado para ver o resultado.",
  precoProduto: "Preço do produto principal (com moeda).",
  garantia: "Garantia oferecida (ex.: 7 dias incondicional).",
  // Avatar
  descricaoAvatar: "Descrição detalhada do cliente ideal.",
  dor1: "Maior dor do avatar.",
  dor2: "Segunda dor.",
  dor3: "Terceira dor.",
  desejo1: "Maior desejo.",
  desejo2: "Segundo desejo.",
  desejo3: "Terceiro desejo.",
  objecao1: "Principal objeção.",
  objecao2: "Segunda objeção.",
  objecao3: "Terceira objeção.",
  nivelConsciencia: "Uma destas: Inconsciente | Consciente do problema | Consciente da solução | Consciente do produto | Mais consciente.",
  canaisOnline: "Canais online onde o avatar está (ex.: Instagram, YouTube).",
  empatiaResumo: "Síntese curta do mapa da empatia do avatar.",
  // Mapa da empatia
  me_pensaSente: "O que o avatar PENSA e SENTE.",
  me_ve: "O que o avatar VÊ no ambiente/mercado.",
  me_ouve: "O que o avatar OUVE de pessoas e canais.",
  me_falaFaz: "O que o avatar FALA e FAZ publicamente.",
  me_dores: "Dores: medos, frustrações e obstáculos.",
  me_ganhos: "Ganhos: desejos, necessidades e métricas de sucesso.",
  // Posicionamento
  nomeExpert: "Nome do expert/produtor.",
  audienciaAtual: "Tamanho/origem da audiência atual.",
  historiaTransformacao: "História de transformação do expert.",
  provasSociais: "Provas sociais disponíveis.",
  diferenciais: "Diferenciais frente à concorrência.",
  // Estrutura
  modulosPrincipais: "Módulos/conteúdos principais (texto livre).",
  bonusIncluidos: "Bônus que acompanham o produto.",
  suporteOferecido: "Suporte oferecido (ex.: e-mail, Telegram).",
  plataformaEntrega: "Plataforma de entrega (Hotmart, Kiwify, etc.).",
  // Estratégia
  metaFaturamento: "Meta de faturamento total.",
  orcamentoTrafego: "Orçamento para tráfego pago.",
  plataformaCheckout: "Plataforma de checkout.",
  ferramentaEmail: "Ferramenta de e-mail marketing.",
  plataformaEvento: "Plataforma de evento (se houver).",
};

const ALL_FIELDS = Object.keys(FIELD_DESCRIPTIONS);

function buildToolSchema() {
  const properties: Record<string, unknown> = {};
  for (const id of ALL_FIELDS) {
    properties[id] = {
      type: "string",
      description: FIELD_DESCRIPTIONS[id],
    };
  }
  return {
    type: "function",
    function: {
      name: "fill_briefing",
      description:
        "Devolve os campos do briefing preenchidos com base no conteúdo coletado da página e da pesquisa.",
      parameters: {
        type: "object",
        properties,
        additionalProperties: false,
      },
    },
  };
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<string> {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Firecrawl: ${data?.error ?? r.statusText}`);
  return (data?.data?.markdown ?? data?.markdown ?? "").slice(0, 20000);
}

async function scrapeBasic(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 BriefingBot/1.0" },
  });
  const html = await r.text();
  // Remove scripts/styles e tags, mantendo texto bruto.
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 20000);
}

async function researchWithPerplexity(
  query: string,
  apiKey: string,
  model = "sonar",
): Promise<string> {
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "Você é um pesquisador de mercado. Resuma o público, dores, desejos, posicionamento e diferenciais que aparecem em fontes públicas.",
        },
        { role: "user", content: query },
      ],
      max_tokens: 800,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Perplexity: ${data?.error?.message ?? r.statusText}`);
  return data?.choices?.[0]?.message?.content ?? "";
}

// Chama LLM com tool calling — gateway depende do engine
async function callLLMWithTool(opts: {
  engine: "lovable" | "openai" | "gemini";
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
}): Promise<Record<string, string>> {
  const { engine, apiKey, model, systemPrompt, userPrompt } = opts;
  const tool = buildToolSchema();

  let url: string;
  let body: Record<string, unknown>;

  if (engine === "lovable") {
    url = "https://ai.gateway.lovable.dev/v1/chat/completions";
    body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "fill_briefing" } },
    };
  } else if (engine === "openai") {
    url = "https://api.openai.com/v1/chat/completions";
    body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "fill_briefing" } },
    };
  } else {
    // Gemini via OpenAI-compatible endpoint do Google
    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
    body = {
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [tool],
      tool_choice: { type: "function", function: { name: "fill_briefing" } },
    };
  }

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const text = await r.text();
    if (r.status === 429) throw new Error("Limite de requisições atingido. Tente novamente em instantes.");
    if (r.status === 402) throw new Error("Créditos insuficientes no provedor de IA selecionado.");
    throw new Error(`LLM ${engine}: ${r.status} ${text.slice(0, 300)}`);
  }

  const data = await r.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  const args = toolCall?.function?.arguments;
  if (!args) throw new Error("A IA não retornou dados estruturados.");
  const parsed = typeof args === "string" ? JSON.parse(args) : args;
  // Sanear: só strings
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === "string") out[k] = v.trim();
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

    // Auth do usuário
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const { url, engine = "lovable" } = body as { url?: string; engine?: "lovable" | "openai" | "gemini" };

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega integrações do usuário
    const { data: integrations } = await supabase
      .from("ai_integrations")
      .select("provider, api_key, default_model, enabled")
      .eq("user_id", userId)
      .eq("enabled", true);

    const byProvider = Object.fromEntries(
      (integrations ?? []).map((i) => [i.provider, i]),
    ) as Record<string, { api_key: string; default_model: string | null }>;

    // 1) Scrape
    let pageContent = "";
    if (byProvider.firecrawl?.api_key) {
      try {
        pageContent = await scrapeWithFirecrawl(url, byProvider.firecrawl.api_key);
      } catch (e) {
        console.warn("Firecrawl falhou, caindo para fetch direto:", (e as Error).message);
      }
    }
    if (!pageContent) pageContent = await scrapeBasic(url);
    if (!pageContent || pageContent.length < 100) {
      return new Response(JSON.stringify({ error: "Não foi possível extrair conteúdo da URL." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Pesquisa adicional (opcional)
    let research = "";
    if (byProvider.perplexity?.api_key) {
      try {
        research = await researchWithPerplexity(
          `Pesquise no Google e em fontes públicas informações relevantes sobre o produto/oferta da página ${url}. Resuma público-alvo, dores, desejos, diferenciais e posicionamento.`,
          byProvider.perplexity.api_key,
          byProvider.perplexity.default_model ?? "sonar",
        );
      } catch (e) {
        console.warn("Perplexity falhou:", (e as Error).message);
      }
    }

    // 3) Engine de LLM
    let engineKey = "";
    let engineModel = "";
    if (engine === "lovable") {
      if (!LOVABLE_API_KEY) throw new Error("Lovable AI não está configurado.");
      engineKey = LOVABLE_API_KEY;
      engineModel = "google/gemini-3-flash-preview";
    } else if (engine === "openai") {
      if (!byProvider.openai?.api_key) throw new Error("Conecte sua chave OpenAI em Integrações.");
      engineKey = byProvider.openai.api_key;
      engineModel = byProvider.openai.default_model ?? "gpt-4o-mini";
    } else if (engine === "gemini") {
      if (!byProvider.gemini?.api_key) throw new Error("Conecte sua chave Gemini em Integrações.");
      engineKey = byProvider.gemini.api_key;
      engineModel = byProvider.gemini.default_model ?? "gemini-2.0-flash";
    } else {
      throw new Error("Motor de IA inválido.");
    }

    const systemPrompt =
      "Você é um especialista em marketing de infoprodutos. Sua tarefa é preencher um briefing estruturado com base em uma página web e pesquisa adicional. Use português do Brasil. Para listas (módulos, bônus), use texto com itens separados por quebra de linha. Quando uma informação não estiver clara, faça uma inferência conservadora baseada no contexto, sem inventar números ou nomes específicos. Devolva SEMPRE chamando a tool fill_briefing.";

    const userPrompt =
      `URL analisada: ${url}\n\n` +
      `=== CONTEÚDO DA PÁGINA (markdown/texto) ===\n${pageContent}\n\n` +
      (research
        ? `=== PESQUISA EXTERNA (Perplexity) ===\n${research}\n\n`
        : "") +
      `=== INSTRUÇÕES ===\nPreencha o máximo possível dos campos do briefing usando a tool 'fill_briefing'. Inclua o Mapa da Empatia (me_*) com base no avatar inferido.`;

    const filled = await callLLMWithTool({
      engine, apiKey: engineKey, model: engineModel, systemPrompt, userPrompt,
    });

    return new Response(
      JSON.stringify({
        data: filled,
        usedFirecrawl: !!byProvider.firecrawl?.api_key,
        usedPerplexity: !!byProvider.perplexity?.api_key && !!research,
        engine,
        model: engineModel,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("reverse-engineer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
