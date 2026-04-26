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
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ao buscar a URL`);
  const html = await r.text();

  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  };

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  // Tenta extrair <main> ou <article>; cai para <body>
  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i) ||
    html.match(/<body[\s\S]*?<\/body>/i);
  const mainHtml = mainMatch ? mainMatch[0] : html;

  // Cabeçalhos (h1-h3) preservados como pistas estruturais
  const headings = Array.from(mainHtml.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi))
    .map((m) => `H${m[1]}: ${m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`)
    .filter((s) => s.length > 4)
    .slice(0, 60)
    .join("\n");

  const body = mainHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const composed =
    `# ${ogTitle || title}\n` +
    (description ? `> ${description}\n\n` : "\n") +
    (headings ? `## Estrutura da página\n${headings}\n\n` : "") +
    `## Conteúdo\n${body}`;

  return composed.slice(0, 20000);
}

async function researchWithPerplexity(
  pageContent: string,
  url: string,
  apiKey: string,
  model = "sonar",
): Promise<{ content: string; citations: string[] }> {
  // Etapa 1: extrair nicho/subnicho/público a partir da página
  const trimmed = pageContent.slice(0, 6000);
  const userQuery =
    `Com base no conteúdo abaixo (extraído de ${url}), faça uma pesquisa aprofundada SOMENTE em fontes públicas verificáveis sobre o PÚBLICO-ALVO do produto.\n\n` +
    `CONTEÚDO DA PÁGINA:\n"""\n${trimmed}\n"""\n\n` +
    `INSTRUÇÕES OBRIGATÓRIAS:\n` +
    `1. Identifique o NICHO e SUBNICHO do produto.\n` +
    `2. Descreva o AVATAR (perfil demográfico/psicográfico) com base em fontes reais do nicho.\n` +
    `3. Liste DORES, DESEJOS e OBJEÇÕES típicas desse público no subnicho identificado.\n` +
    `4. Levante POSICIONAMENTO e DIFERENCIAIS de concorrentes diretos no mesmo subnicho.\n` +
    `5. Inclua CANAIS ONLINE onde esse público se concentra.\n` +
    `6. NÃO invente números, nomes próprios, depoimentos ou estatísticas. Se não houver fonte clara, escreva "não verificado".\n` +
    `7. Cite as fontes ao final de cada bloco entre colchetes [URL].\n` +
    `Formato: tópicos curtos e objetivos em português do Brasil.`;

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
            "Você é um pesquisador de mercado sênior especializado em infoprodutos. Trabalha SOMENTE com informações verificáveis em fontes públicas. Nunca inventa dados, números, nomes ou estatísticas. Quando uma informação não puder ser confirmada, escreve explicitamente 'não verificado'. Sempre responde em português do Brasil.",
        },
        { role: "user", content: userQuery },
      ],
      temperature: 0.1,
      max_tokens: 1500,
      return_citations: true,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`Perplexity: ${data?.error?.message ?? r.statusText}`);
  return {
    content: data?.choices?.[0]?.message?.content ?? "",
    citations: data?.citations ?? [],
  };
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

    // 2) Pesquisa adicional (opcional) — focada em público-alvo/nicho

    // 2) Pesquisa adicional (opcional) — focada em público-alvo/nicho
    let research = "";
    let citations: string[] = [];
    if (byProvider.perplexity?.api_key) {
      try {
        const res = await researchWithPerplexity(
          pageContent,
          url,
          byProvider.perplexity.api_key,
          byProvider.perplexity.default_model ?? "sonar",
        );
        research = res.content;
        citations = res.citations;
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
      "Você é um especialista sênior em marketing de infoprodutos preenchendo um briefing estruturado.\n\n" +
      "REGRAS ANTI-ALUCINAÇÃO (OBRIGATÓRIAS):\n" +
      "1. Use APENAS informações presentes no conteúdo da página ou na pesquisa externa fornecida. Nunca invente fatos.\n" +
      "2. NUNCA crie números, preços, datas, nomes próprios, depoimentos ou estatísticas que não estejam explícitos nas fontes.\n" +
      "3. Quando uma informação não estiver disponível ou for ambígua, deixe o campo como string vazia (\"\") em vez de adivinhar.\n" +
      "4. Para dores, desejos, objeções e mapa da empatia, baseie-se no público-alvo e subnicho identificados na pesquisa externa; se não houver pesquisa, infira de forma CONSERVADORA e GENÉRICA, sem citar dados específicos.\n" +
      "5. Diferencie claramente o que é FATO (extraído da página/pesquisa) do que é INFERÊNCIA conservadora — em caso de dúvida, prefira deixar vazio.\n" +
      "6. Use português do Brasil. Para listas (módulos, bônus), separe itens por quebra de linha.\n" +
      "7. Devolva SEMPRE chamando a tool fill_briefing.";

    const userPrompt =
      `URL analisada: ${url}\n\n` +
      `=== CONTEÚDO DA PÁGINA (markdown/texto) ===\n${pageContent}\n\n` +
      (research
        ? `=== PESQUISA EXTERNA SOBRE PÚBLICO-ALVO E NICHO (Perplexity) ===\n${research}\n\n` +
          (citations.length
            ? `Fontes citadas: ${citations.slice(0, 10).join(", ")}\n\n`
            : "")
        : "") +
      `=== INSTRUÇÕES ===\n` +
      `Preencha os campos do briefing usando a tool 'fill_briefing'. Inclua o Mapa da Empatia (me_*) baseado no avatar identificado na pesquisa. ` +
      `Lembre-se: deixe vazio (\"\") qualquer campo cuja informação não esteja claramente suportada pelas fontes — não invente.`;

    const filled = await callLLMWithTool({
      engine, apiKey: engineKey, model: engineModel, systemPrompt, userPrompt,
    });

    return new Response(
      JSON.stringify({
        data: filled,
        usedFirecrawl: !!byProvider.firecrawl?.api_key,
        usedPerplexity: !!byProvider.perplexity?.api_key && !!research,
        citations,
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
