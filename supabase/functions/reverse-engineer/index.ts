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
  // Mapa da empatia (Xplane/Dave Gray) — 6 quadrantes canônicos.
  // Cada quadrante deve trazer 3-4 itens concretos respondendo às perguntas-guia clássicas.
  me_ve: "VÊ — estímulos visuais do cotidiano. Responder: Como é o mundo em que vive? Como são seus amigos? O que enxerga concorrentes oferecendo? Que conteúdos consome (TV, redes, sites, podcasts)? Que ofertas aparecem na frente dele? Mínimo 3 itens concretos do ambiente pessoal E profissional.",
  me_ouve: "OUVE — vozes e influências (não só som). Responder: Quem o influencia (família, amigos, chefe, ídolos, líderes religiosos)? Quais marcas favoritas? Quais produtos de comunicação consome (podcasts, canais, comunidades)? Indique o teor: apoio, pressão ou ruído. Mínimo 3 fontes diferentes.",
  me_pensaSente: "PENSA E SENTE — mundo interior. Responder: Como se sente em relação ao mundo? Quais suas preocupações reais? Quais seus sonhos e aspirações? Que crenças limitantes carrega? Inclua sentimentos que NÃO admite em voz alta. Mínimo 3 frases concretas, sem generalidades.",
  me_falaFaz: "FALA E FAZ — atitude pública e comportamento (discurso x prática). Responder: Sobre o que costuma falar? Como age no dia a dia? Como se veste/se apresenta? Quais hobbies? Onde há contradição entre o que diz e o que faz? Mínimo 3 comportamentos específicos.",
  me_dores: "DORES — dúvidas e obstáculos para consumir a solução. Responder: Do que tem medo? Quais maiores frustrações hoje? Que obstáculos precisa superar (tempo, dinheiro, conhecimento, suporte, autoestima)? Que riscos percebe na decisão de compra? Mínimo 4 itens concretos.",
  me_ganhos: "GANHOS / NECESSIDADES — critérios de sucesso. Responder: O que é sucesso para ele? Onde quer chegar? O que acabaria com seus problemas? Inclua ganhos tangíveis (dinheiro, tempo, métricas com prazo) e intangíveis (orgulho, status, reconhecimento). Mínimo 4 itens.",
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

interface ScrapeOutcome {
  content: string;
  status: number;
  blocked: boolean;
  reason?: string;
}

async function scrapeBasic(url: string): Promise<ScrapeOutcome> {
  let r: Response;
  try {
    r = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
  } catch (e) {
    return { content: "", status: 0, blocked: true, reason: `Falha de rede: ${(e as Error).message}` };
  }

  if (!r.ok) {
    const blocked = [401, 403, 429, 503].includes(r.status);
    return {
      content: "",
      status: r.status,
      blocked,
      reason: blocked
        ? `O site bloqueou o acesso automatizado (HTTP ${r.status}).`
        : `HTTP ${r.status} ao buscar a URL.`,
    };
  }

  const html = await r.text();

  const pick = (re: RegExp) => {
    const m = html.match(re);
    return m ? m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
  };

  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const ogTitle = pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);

  const mainMatch =
    html.match(/<main[\s\S]*?<\/main>/i) ||
    html.match(/<article[\s\S]*?<\/article>/i) ||
    html.match(/<body[\s\S]*?<\/body>/i);
  const mainHtml = mainMatch ? mainMatch[0] : html;

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

  return { content: composed.slice(0, 20000), status: r.status, blocked: false };
}

// ===== Qualidade do conteúdo raspado =====
// Devolve um score 0-100 + nível + recomendação de método alternativo.
const QUALITY_MIN_OK = 60;     // abaixo disso, bloqueia o método e sugere alternativa
const QUALITY_MIN_USABLE = 40; // abaixo disso, considera inutilizável

interface QualityReport {
  ok: boolean;             // score >= QUALITY_MIN_OK
  usable: boolean;         // score >= QUALITY_MIN_USABLE
  score: number;           // 0-100
  level: "alta" | "média" | "baixa" | "insuficiente";
  chars: number;
  words: number;
  reason?: string;
  // Trechos representativos para exibir na UI
  snippets: { head: string; middle: string; tail: string };
}

function assessContentQuality(content: string): QualityReport {
  const trimmed = content.trim();
  const chars = trimmed.length;
  const wordMatches = trimmed.match(/[A-Za-zÀ-ÿ]{4,}/g) ?? [];
  const words = wordMatches.length;

  // Score por caracteres (até 60 pts) + por palavras significativas (até 40 pts)
  const charScore = Math.min(60, Math.round((chars / 2000) * 60));
  const wordScore = Math.min(40, Math.round((words / 250) * 40));
  let score = charScore + wordScore;
  if (chars < 100) score = Math.min(score, 10);
  score = Math.max(0, Math.min(100, score));

  let level: QualityReport["level"];
  let reason: string | undefined;
  if (score >= 75) level = "alta";
  else if (score >= QUALITY_MIN_OK) level = "média";
  else if (score >= QUALITY_MIN_USABLE) {
    level = "baixa";
    reason = `Conteúdo abaixo do recomendado (${chars} caracteres, ${words} palavras).`;
  } else {
    level = "insuficiente";
    reason =
      chars < 300
        ? "Conteúdo muito curto (provável SPA ou bloqueio)."
        : "Conteúdo sem texto significativo.";
  }

  // Trechos: começo, meio e fim, sem ultrapassar limites
  const snip = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, 280);
  const mid = chars > 600 ? Math.floor(chars / 2) - 140 : 0;
  const snippets = {
    head: snip(trimmed.slice(0, 280)),
    middle: chars > 600 ? snip(trimmed.slice(mid, mid + 280)) : "",
    tail: chars > 1200 ? snip(trimmed.slice(-280)) : "",
  };

  return {
    ok: score >= QUALITY_MIN_OK,
    usable: score >= QUALITY_MIN_USABLE,
    score,
    level,
    chars,
    words,
    reason,
    snippets,
  };
}

// Sugere o melhor método alternativo dadas as integrações disponíveis.
function recommendNextMethod(opts: {
  triedMethod: string;
  hasFirecrawl: boolean;
  hasPerplexity: boolean;
  blocked: boolean;
}): "firecrawl" | "perplexity" | "fetch" | null {
  const { triedMethod, hasFirecrawl, hasPerplexity, blocked } = opts;
  // Se site bloqueia bots, fetch direto não vai resolver — pular para Firecrawl/Perplexity
  if (blocked) {
    if (hasFirecrawl && triedMethod !== "firecrawl") return "firecrawl";
    if (hasPerplexity) return "perplexity";
    return null;
  }
  // Se conteúdo curto vindo de fetch, Firecrawl renderiza JS → melhor alternativa
  if (triedMethod === "fetch" && hasFirecrawl) return "firecrawl";
  // Se Firecrawl já tentou e falhou, ou não há Firecrawl, vai para Perplexity
  if (hasPerplexity) return "perplexity";
  if (hasFirecrawl && triedMethod !== "firecrawl") return "firecrawl";
  return null;
}


async function researchWithPerplexity(
  pageContent: string,
  url: string,
  apiKey: string,
  model = "sonar",
): Promise<{ content: string; citations: string[] }> {
  const trimmed = pageContent.slice(0, 6000);
  const userQuery =
    `Tenho uma página de produto/infoproduto em ${url}. Use o conteúdo abaixo como ponto de partida e pesquise APENAS em fontes públicas verificáveis para mapear o PÚBLICO-ALVO, NICHO e SUBNICHO.\n\n` +
    `=== CONTEÚDO DA PÁGINA ===\n"""\n${trimmed}\n"""\n\n` +
    `=== O QUE EU PRECISO (responda em blocos numerados, em português do Brasil) ===\n` +
    `1. NICHO e SUBNICHO — categoria de mercado e recorte específico do produto.\n` +
    `2. PÚBLICO-ALVO PRIMÁRIO — perfil demográfico (faixa etária, gênero predominante, renda, escolaridade) e psicográfico (estilo de vida, valores, momento de carreira/vida). Cite a fonte de cada afirmação.\n` +
    `3. DORES — 3 a 5 dores recorrentes desse público nesse subnicho, com fonte para cada uma.\n` +
    `4. DESEJOS — 3 a 5 desejos/aspirações típicas, com fonte.\n` +
    `5. OBJEÇÕES — 3 a 5 objeções comuns à compra de soluções no subnicho, com fonte.\n` +
    `6. NÍVEL DE CONSCIÊNCIA dominante (escala de Eugene Schwartz: inconsciente → consciente do problema → da solução → do produto → mais consciente).\n` +
    `7. CANAIS ONLINE — onde esse público se concentra (redes sociais, comunidades, podcasts, fóruns), com exemplos verificáveis.\n` +
    `8. CONCORRENTES diretos no mesmo subnicho — 2 a 5 nomes verificáveis, com posicionamento e diferenciais.\n` +
    `9. MAPA DA EMPATIA do avatar — preencha os 6 quadrantes (PENSA E SENTE / VÊ / OUVE / FALA E FAZ / DORES / GANHOS) baseando-se EXCLUSIVAMENTE no que foi pesquisado.\n\n` +
    `=== REGRAS RÍGIDAS ANTI-ALUCINAÇÃO ===\n` +
    `- NUNCA invente nomes próprios, depoimentos, números, percentuais, datas, preços ou estatísticas.\n` +
    `- Se uma informação não estiver claramente em uma fonte pública, escreva literalmente "não verificado" naquele item.\n` +
    `- Cite a fonte ao final de cada afirmação relevante usando [URL] entre colchetes.\n` +
    `- NÃO repita literalmente o texto da página; use-o apenas como contexto para a pesquisa externa.\n` +
    `- Se a página estiver vazia, em outro idioma ou inacessível, identifique o nicho a partir da URL e diga claramente quais blocos não puderam ser respondidos.\n` +
    `- Tom: objetivo, em tópicos curtos. Sem floreio.`;

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
            "Você é um pesquisador de mercado sênior especializado em infoprodutos no Brasil. Trabalha EXCLUSIVAMENTE com informações verificáveis em fontes públicas (sites oficiais, relatórios de mercado, estudos públicos, conteúdos de imprensa, comunidades públicas). NUNCA inventa dados, números, nomes próprios, depoimentos ou estatísticas. Quando algo não pode ser confirmado, escreve literalmente 'não verificado'. Cita as fontes entre colchetes [URL]. Sempre responde em português do Brasil, em tópicos objetivos.",
        },
        { role: "user", content: userQuery },
      ],
      temperature: 0.1,
      max_tokens: 1800,
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
    const {
      url,
      engine = "lovable",
      mode = "auto",
      forceMethod,
    } = body as {
      url?: string;
      engine?: "lovable" | "openai" | "gemini";
      // "auto" = comportamento atual; "inspect" = só raspar e devolver prévia/qualidade; "run" = forçar execução com forceMethod
      mode?: "auto" | "inspect" | "run";
      forceMethod?: "fetch" | "firecrawl" | "perplexity";
    };

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(
        JSON.stringify({ error: "URL inválida. Use http:// ou https://", errorCode: "INVALID_URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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

    // 1) Scrape — segue forceMethod quando informado
    let pageContent = "";
    type ScrapeMethod = "firecrawl" | "fetch" | "perplexity-fallback";
    let scrapeMethod: ScrapeMethod = "fetch";
    let scrapeStatus = 0;
    let scrapeBlocked = false;
    let scrapeReason: string | undefined;

    const tryFirecrawl = async () => {
      if (!byProvider.firecrawl?.api_key) return false;
      try {
        const c = await scrapeWithFirecrawl(url, byProvider.firecrawl.api_key);
        if (c) { pageContent = c; scrapeMethod = "firecrawl"; return true; }
      } catch (e) {
        console.warn("Firecrawl falhou:", (e as Error).message);
        scrapeReason = `Firecrawl: ${(e as Error).message}`;
      }
      return false;
    };

    const tryFetch = async () => {
      const out = await scrapeBasic(url);
      scrapeStatus = out.status;
      scrapeBlocked = out.blocked;
      if (out.content) { pageContent = out.content; scrapeMethod = "fetch"; return true; }
      scrapeReason = out.reason;
      return false;
    };

    const tryPerplexity = async () => {
      if (!byProvider.perplexity?.api_key) return false;
      try {
        const fb = await researchWithPerplexity(
          pageContent || `Página inacessível por scraping direto. URL: ${url}`,
          url,
          byProvider.perplexity.api_key,
          byProvider.perplexity.default_model ?? "sonar",
        );
        if (fb.content && fb.content.length > 200) {
          pageContent = `# Conteúdo recuperado via Perplexity\n\n${fb.content}`;
          scrapeMethod = "perplexity-fallback";
          return true;
        }
      } catch (e) {
        console.warn("Perplexity fallback falhou:", (e as Error).message);
        scrapeReason = `Perplexity: ${(e as Error).message}`;
      }
      return false;
    };

    if (forceMethod === "perplexity") {
      await tryPerplexity();
    } else if (forceMethod === "firecrawl") {
      await tryFirecrawl();
    } else if (forceMethod === "fetch") {
      await tryFetch();
    } else {
      // Ordem padrão: firecrawl (se conectado) → fetch → perplexity (fallback)
      const ok = await tryFirecrawl();
      if (!ok) await tryFetch();
    }

    // Avaliação de qualidade do conteúdo já raspado
    let quality = assessContentQuality(pageContent);

    // Helper para montar o payload de "needsChoice" com prévia rica + recomendação
    const buildChoicePayload = (extra?: Partial<Record<string, unknown>>) => {
      const hasFirecrawl = !!byProvider.firecrawl?.api_key;
      const hasPerplexity = !!byProvider.perplexity?.api_key;
      const recommended = recommendNextMethod({
        triedMethod: scrapeMethod,
        hasFirecrawl,
        hasPerplexity,
        blocked: scrapeBlocked,
      });

      // Bloqueio automático: método que claramente não vai funcionar fica desabilitado
      const methods = {
        fetch: {
          available: true,
          disabled: scrapeBlocked && scrapeMethod === "fetch",
          reason: scrapeBlocked && scrapeMethod === "fetch"
            ? `Bloqueado pelo site (HTTP ${scrapeStatus || "?"})`
            : undefined,
        },
        firecrawl: {
          available: hasFirecrawl,
          disabled: false,
          reason: hasFirecrawl ? undefined : "Conecte Firecrawl em Integrações",
        },
        perplexity: {
          available: hasPerplexity,
          disabled: false,
          reason: hasPerplexity ? undefined : "Conecte Perplexity em Integrações",
        },
      };

      return {
        needsChoice: true,
        errorCode: scrapeBlocked ? "SITE_BLOCKED" : "WEAK_CONTENT",
        message: scrapeBlocked
          ? `O site bloqueou a leitura automatizada${scrapeStatus ? ` (HTTP ${scrapeStatus})` : ""}. ${
              recommended === "perplexity"
                ? "Recomendamos pesquisar o nicho via Perplexity."
                : recommended === "firecrawl"
                ? "Recomendamos extrair com Firecrawl (renderiza JS)."
                : "Conecte Firecrawl ou Perplexity para contornar."
            }`
          : `Conteúdo extraído tem qualidade ${quality.level} (${quality.score}/100, ${quality.chars} caracteres, ${quality.words} palavras). ${
              recommended === "firecrawl"
                ? "Recomendamos Firecrawl — renderiza JavaScript e funciona melhor em SPAs."
                : recommended === "perplexity"
                ? "Recomendamos Perplexity — pesquisa o nicho mesmo sem ler a página."
                : "Conecte Firecrawl ou Perplexity para tentar uma extração melhor."
            }`,
        quality,
        scrapeMethod,
        scrapeStatus,
        preview: {
          length: pageContent.length,
          chars: quality.chars,
          words: quality.words,
          score: quality.score,
          level: quality.level,
          head: quality.snippets.head,
          middle: quality.snippets.middle,
          tail: quality.snippets.tail,
        },
        recommended,
        methods,
        hasPerplexity,
        hasFirecrawl,
        ...(extra ?? {}),
      };
    };

    // Modo "inspect": só raspa e devolve métricas — nunca chama LLM
    if (mode === "inspect") {
      return new Response(
        JSON.stringify({
          inspected: true,
          ...buildChoicePayload({ needsChoice: !quality.ok }),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Modo "auto" e qualidade ruim: tenta cascata automática (Firecrawl → Perplexity)
    // sem precisar de novo clique do usuário.
    if (mode === "auto" && !quality.ok && forceMethod !== "perplexity") {
      // 1ª tentativa automática: Firecrawl, se conectado e ainda não usado
      if (byProvider.firecrawl?.api_key && (scrapeMethod as string) !== "firecrawl") {
        await tryFirecrawl();
        quality = assessContentQuality(pageContent);
      }
      // 2ª tentativa automática: Perplexity, se conectada
      if (!quality.ok && byProvider.perplexity?.api_key) {
        await tryPerplexity();
        quality = assessContentQuality(pageContent);
      }

      // Se ainda assim não atingiu qualidade mínima utilizável, devolve prévia + recomendação
      if (!quality.usable) {
        return new Response(
          JSON.stringify(buildChoicePayload()),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (!pageContent || pageContent.length < 100) {
      return new Response(
        JSON.stringify({
          error: "Não foi possível extrair conteúdo da URL.",
          errorCode: scrapeBlocked ? "SITE_BLOCKED" : "EMPTY_CONTENT",
          scrapeStatus,
          hasPerplexity: !!byProvider.perplexity?.api_key,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


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

    const finalMethod: string = scrapeMethod;
    return new Response(
      JSON.stringify({
        data: filled,
        scrapeMethod: finalMethod,
        usedFirecrawl: finalMethod === "firecrawl",
        usedPerplexity:
          !!byProvider.perplexity?.api_key &&
          (!!research || finalMethod === "perplexity-fallback"),
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
