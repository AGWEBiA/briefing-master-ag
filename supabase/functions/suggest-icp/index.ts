// suggest-icp: analisa o briefing atual e devolve um perfil de Cliente Ideal (ICP)
// preenchendo descricaoAvatar, dores/desejos/objeções e os 6 quadrantes do mapa da empatia.
// Usa Lovable AI Gateway por padrão (Gemini Flash); cai para chave do usuário se solicitado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Campos que serão sugeridos / sobrescritos.
const ICP_FIELDS: Record<string, string> = {
  descricaoAvatar: "Perfil detalhado do Cliente Ideal: idade, profissão, momento de vida/carreira, situação atual, comportamento de consumo. Mínimo 4 frases.",
  dor1: "Maior dor do ICP — objetiva e específica.",
  dor2: "Segunda dor do ICP.",
  dor3: "Terceira dor do ICP.",
  desejo1: "Maior desejo do ICP — concreto, com métrica se possível.",
  desejo2: "Segundo desejo do ICP.",
  desejo3: "Terceiro desejo do ICP.",
  objecao1: "Principal objeção à compra.",
  objecao2: "Segunda objeção.",
  objecao3: "Terceira objeção.",
  nivelConsciencia: "Uma destas: Inconsciente | Consciente do problema | Consciente da solução | Consciente do produto | Mais consciente.",
  canaisOnline: "Canais online onde o ICP está presente (Instagram, YouTube, podcasts, comunidades).",
  empatiaResumo: "Síntese curta (2-3 frases) do mapa da empatia.",
  // Mapa da empatia (Xplane/Dave Gray) — 6 quadrantes canônicos com perguntas-guia.
  me_ve: "VÊ — estímulos visuais do cotidiano. Como é o mundo dele? Como são seus amigos? O que vê os concorrentes oferecendo? Que conteúdos consome? Que ofertas aparecem na frente dele? Mínimo 3 itens concretos.",
  me_ouve: "OUVE — vozes e influências. Quem o influencia (família, amigos, chefe, ídolos)? Marcas favoritas? Produtos de comunicação que consome (podcasts, canais, comunidades)? Indique apoio, pressão ou ruído. Mínimo 3 fontes.",
  me_pensaSente: "PENSA E SENTE — mundo interior. Como se sente em relação ao mundo? Preocupações? Sonhos e aspirações? Crenças limitantes? Inclua sentimentos que NÃO admite em voz alta. Mínimo 3 frases concretas.",
  me_falaFaz: "FALA E FAZ — atitude pública (discurso x prática). Sobre o que costuma falar? Como age? Como se apresenta? Hobbies? Contradições entre o que diz e o que faz. Mínimo 3 comportamentos.",
  me_dores: "DORES — dúvidas e obstáculos para consumir a solução. Do que tem medo? Frustrações? Obstáculos (tempo/dinheiro/conhecimento/suporte/autoestima)? Riscos percebidos na decisão. Mínimo 4 itens.",
  me_ganhos: "GANHOS / NECESSIDADES — critérios de sucesso. O que é sucesso para ele? Onde quer chegar? O que acabaria com seus problemas? Inclua tangíveis (dinheiro, tempo, métricas) e intangíveis (orgulho, reconhecimento). Mínimo 4 itens.",
};

function buildToolSchema() {
  const properties: Record<string, unknown> = {};
  for (const id of Object.keys(ICP_FIELDS)) {
    properties[id] = { type: "string", description: ICP_FIELDS[id] };
  }
  return {
    type: "function",
    function: {
      name: "suggest_icp",
      description: "Devolve o perfil de Cliente Ideal (ICP) sugerido com base no briefing.",
      parameters: {
        type: "object",
        properties,
        required: ["descricaoAvatar"],
        additionalProperties: false,
      },
    },
  };
}

interface BriefingSnapshot {
  nomeProduto?: string;
  nicho?: string;
  categoriaProduto?: string;
  formatoEntrega?: string;
  transformacaoPrincipal?: string;
  precoProduto?: string;
  modulosPrincipais?: string;
  diferenciais?: string;
  provasSociais?: string;
  // demais campos opcionais
  [key: string]: string | undefined;
}

function summarizeBriefing(d: BriefingSnapshot): string {
  const f = (label: string, value?: string) =>
    value && value.trim() ? `- **${label}**: ${value.trim()}` : null;
  return [
    f("Nome do produto", d.nomeProduto),
    f("Nicho", d.nicho),
    f("Categoria", d.categoriaProduto),
    f("Formato de entrega", d.formatoEntrega),
    f("Transformação prometida", d.transformacaoPrincipal),
    f("Tempo para resultado", d.tempoResultado),
    f("Preço", d.precoProduto),
    f("Garantia", d.garantia),
    f("Avatar atual (a complementar)", d.descricaoAvatar),
    f("Módulos principais", d.modulosPrincipais),
    f("Bônus", d.bonusIncluidos),
    f("Suporte", d.suporteOferecido),
    f("Plataforma de entrega", d.plataformaEntrega),
    f("Diferenciais", d.diferenciais),
    f("Provas sociais", d.provasSociais),
    f("História do expert", d.historiaTransformacao),
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

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
    const { briefing, engine = "lovable" } = body as {
      briefing?: BriefingSnapshot;
      engine?: "lovable" | "openai" | "gemini";
    };

    if (!briefing || typeof briefing !== "object") {
      return new Response(JSON.stringify({ error: "Briefing inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const summary = summarizeBriefing(briefing);
    if (summary.length < 40) {
      return new Response(JSON.stringify({
        error: "Briefing ainda muito vazio. Preencha pelo menos nome do produto, nicho e transformação principal antes de pedir a sugestão de ICP.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Carrega integrações para os engines OpenAI/Gemini, se necessário
    const { data: integrations } = await supabase
      .from("ai_integrations")
      .select("provider, api_key, default_model, enabled")
      .eq("user_id", userId)
      .eq("enabled", true);
    const byProvider = Object.fromEntries(
      (integrations ?? []).map((i) => [i.provider, i]),
    ) as Record<string, { api_key: string; default_model: string | null }>;

    // Resolve engine
    let url = "";
    let apiKey = "";
    let model = "";
    if (engine === "lovable") {
      if (!LOVABLE_API_KEY) throw new Error("Lovable AI não está configurado.");
      url = "https://ai.gateway.lovable.dev/v1/chat/completions";
      apiKey = LOVABLE_API_KEY;
      model = "google/gemini-3-flash-preview";
    } else if (engine === "openai") {
      if (!byProvider.openai?.api_key) throw new Error("Conecte sua chave OpenAI em Integrações.");
      url = "https://api.openai.com/v1/chat/completions";
      apiKey = byProvider.openai.api_key;
      model = byProvider.openai.default_model ?? "gpt-4o-mini";
    } else if (engine === "gemini") {
      if (!byProvider.gemini?.api_key) throw new Error("Conecte sua chave Gemini em Integrações.");
      url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
      apiKey = byProvider.gemini.api_key;
      model = byProvider.gemini.default_model ?? "gemini-2.0-flash";
    } else {
      throw new Error("Motor de IA inválido.");
    }

    const systemPrompt =
      "Você é um estrategista sênior de marketing de infoprodutos. Sua tarefa é definir o PERFIL DE CLIENTE IDEAL (ICP) com base no briefing fornecido.\n\n" +
      "REGRAS OBRIGATÓRIAS:\n" +
      "1. Baseie-se EXCLUSIVAMENTE nas informações do briefing. Nunca invente números, nomes próprios, depoimentos ou estatísticas.\n" +
      "2. Quando o briefing não fornecer base, prefira inferências CONSERVADORAS e GENÉRICAS do nicho/categoria — sem dados específicos.\n" +
      "3. Para dores/desejos/objeções, seja específico ao nicho identificado e ao formato de entrega.\n" +
      "4. Use português do Brasil. Tom direto, sem floreios.\n\n" +
      "MAPA DA EMPATIA (campos me_*) — siga o método canônico Xplane/Dave Gray, com as perguntas-guia abaixo. Cada quadrante exige itens CONCRETOS (não 'quer ter sucesso'):\n" +
      "• me_ve (VÊ): Como é o mundo dele? Como são os amigos? O que vê concorrentes oferecendo? Que conteúdos consome? Que ofertas aparecem na frente dele? ≥3 itens.\n" +
      "• me_ouve (OUVE): Quem o influencia (família, amigos, chefe, ídolos)? Marcas favoritas? Podcasts/canais/comunidades que consome? Indique apoio, pressão ou ruído. ≥3 fontes.\n" +
      "• me_pensaSente (PENSA E SENTE): Como se sente em relação ao mundo? Preocupações reais? Sonhos? Crenças limitantes? O que NÃO admite em voz alta. ≥3 frases.\n" +
      "• me_falaFaz (FALA E FAZ): Sobre o que costuma falar? Como age? Como se apresenta? Hobbies? Contradições entre discurso e prática? ≥3 comportamentos.\n" +
      "• me_dores (DORES): Do que tem medo? Frustrações? Obstáculos (tempo/dinheiro/conhecimento/suporte/autoestima)? Riscos percebidos para comprar? ≥4 itens.\n" +
      "• me_ganhos (GANHOS/NECESSIDADES): O que é sucesso para ele? Onde quer chegar? O que acabaria com seus problemas? Tangíveis (dinheiro, tempo, métricas com prazo) + intangíveis (orgulho, status, reconhecimento). ≥4 itens.\n\n" +
      "5. Devolva SEMPRE chamando a tool `suggest_icp`.";

    const userPrompt =
      `=== BRIEFING ATUAL DO PRODUTO ===\n${summary}\n\n` +
      `=== TAREFA ===\n` +
      `Defina o ICP (Perfil de Cliente Ideal) deste produto preenchendo todos os campos da tool 'suggest_icp'. ` +
      `Comece pela descricaoAvatar (perfil completo: idade, profissão, momento de vida/carreira, comportamento de consumo). Em seguida derive dores, desejos, objeções, nível de consciência, canais e os 6 quadrantes do mapa da empatia (Xplane/Dave Gray) seguindo as perguntas-guia do system prompt. ` +
      `Garanta coerência: as dores do ICP devem casar com a transformação prometida; os desejos com os benefícios; o nível de consciência com o preço e a complexidade do produto.`;

    const tool = buildToolSchema();
    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "suggest_icp" } },
      }),
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

    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "string" && v.trim()) out[k] = v.trim();
    }

    return new Response(
      JSON.stringify({ data: out, engine, model }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-icp error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
