// suggest-ads: gera sugestões de PÚBLICOS e CRIATIVOS para tráfego pago
// (Meta Ads / Google Ads / YouTube / TikTok) com base no avatar + mapa empatia.
// Retorna estrutura rica para renderizar no painel — não preenche o briefing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const adsTool = {
  type: "function",
  function: {
    name: "suggest_ads",
    description: "Devolve públicos sugeridos e ângulos de criativos para ads.",
    parameters: {
      type: "object",
      properties: {
        publicos: {
          type: "array",
          description: "Públicos sugeridos (3-6) por plataforma.",
          items: {
            type: "object",
            properties: {
              nome: { type: "string", description: "Nome curto do público (ex.: 'Lookalike compradores 1%')." },
              plataforma: { type: "string", enum: ["Meta Ads", "Google Ads", "YouTube Ads", "TikTok Ads", "Multi-plataforma"] },
              tipo: { type: "string", enum: ["Frio", "Morno", "Quente", "Lookalike", "Retargeting"] },
              segmentacao: { type: "string", description: "Detalhes de segmentação (interesses, comportamentos, listas, palavras-chave)." },
              justificativa: { type: "string", description: "Por que esse público faz sentido para o avatar e a oferta." },
            },
            required: ["nome", "plataforma", "tipo", "segmentacao", "justificativa"],
            additionalProperties: false,
          },
        },
        criativos: {
          type: "array",
          description: "Ângulos de criativo (4-8) prontos para teste.",
          items: {
            type: "object",
            properties: {
              angulo: { type: "string", description: "Nome do ângulo (ex.: 'Antagonista do guru', 'Antes/Depois')." },
              dorOuDesejo: { type: "string", description: "Dor ou desejo do avatar que esse criativo ataca." },
              formato: { type: "string", enum: ["Reels/Short vertical", "Estático (feed)", "Carrossel", "Vídeo longo (1-3min)", "UGC depoimento", "Story"] },
              hook: { type: "string", description: "Hook (3-5 primeiros segundos) — texto literal." },
              roteiro: { type: "string", description: "Roteiro/copy bloco a bloco em 3-5 linhas." },
              cta: { type: "string", description: "CTA final do criativo." },
            },
            required: ["angulo", "dorOuDesejo", "formato", "hook", "roteiro", "cta"],
            additionalProperties: false,
          },
        },
        observacoes: {
          type: "string",
          description: "Notas finais: testes A/B sugeridos, ordem de prioridade, cuidados de policy.",
        },
      },
      required: ["publicos", "criativos"],
      additionalProperties: false,
    },
  },
};

function summarize(d: Record<string, string | undefined>): string {
  const f = (label: string, value?: string) =>
    value && value.trim() ? `- **${label}**: ${value.trim()}` : null;
  return [
    "## Produto",
    f("Nome", d.nomeProduto), f("Nicho", d.nicho), f("Categoria", d.categoriaProduto),
    f("Transformação", d.transformacaoPrincipal), f("Preço", d.precoProduto),
    f("Garantia", d.garantia),
    "## Avatar",
    f("Descrição", d.descricaoAvatar),
    f("Dor #1", d.dor1), f("Dor #2", d.dor2), f("Dor #3", d.dor3),
    f("Desejo #1", d.desejo1), f("Desejo #2", d.desejo2), f("Desejo #3", d.desejo3),
    f("Objeção #1", d.objecao1), f("Objeção #2", d.objecao2), f("Objeção #3", d.objecao3),
    f("Nível de consciência", d.nivelConsciencia),
    f("Canais online", d.canaisOnline),
    "## Mapa da Empatia",
    f("VÊ", d.me_ve), f("OUVE", d.me_ouve),
    f("PENSA/SENTE", d.me_pensaSente), f("FALA/FAZ", d.me_falaFaz),
    f("DORES", d.me_dores), f("GANHOS", d.me_ganhos),
    "## Tráfego",
    f("Orçamento de tráfego", d.orcamentoTrafego),
    f("Fonte de tráfego (perpétuo)", d.pe_fonteTrafego),
    f("Fonte de tráfego (venda direta)", d.vd_fonteTrafego),
    f("Meta CPA", d.vd_metaCPA), f("Meta ROAS", d.vd_metaROAS ?? d.pe_metaROAS),
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
      briefing?: Record<string, string>;
      engine?: "lovable" | "openai" | "gemini";
    };
    if (!briefing) {
      return new Response(JSON.stringify({ error: "Briefing inválido." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasBase =
      (briefing.descricaoAvatar?.trim()?.length ?? 0) > 20 ||
      (briefing.me_dores?.trim()?.length ?? 0) > 20;
    if (!hasBase) {
      return new Response(JSON.stringify({
        error: "Preencha primeiro o Avatar e o Mapa da Empatia para gerar sugestões precisas.",
      }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: integrations } = await supabase
      .from("ai_integrations")
      .select("provider, api_key, default_model, enabled")
      .eq("user_id", userId).eq("enabled", true);
    const byProvider = Object.fromEntries(
      (integrations ?? []).map((i) => [i.provider, i]),
    ) as Record<string, { api_key: string; default_model: string | null }>;

    let url = "", apiKey = "", model = "";
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
      "Você é um media buyer sênior especialista em tráfego pago para infoprodutos (Meta, Google, YouTube, TikTok). " +
      "Sua tarefa é gerar PÚBLICOS e CRIATIVOS de alta qualidade com base no avatar e no mapa da empatia.\n\n" +
      "REGRAS:\n" +
      "1. NUNCA invente números, marcas parceiras ou métricas que não estejam no briefing.\n" +
      "2. Use a LINGUAGEM do avatar (mapa empatia: VÊ/OUVE/FALA-FAZ) nos hooks e copies — não use jargão genérico.\n" +
      "3. Cada criativo ataca UMA dor ou UM desejo específico do avatar (não misture).\n" +
      "4. Diversifique formatos (vídeo curto, estático, UGC, story, carrossel) e ângulos (dor, desejo, prova, contraste, antagonista, mecanismo único).\n" +
      "5. Para públicos: combine públicos frios (interesses/comportamentos), lookalikes (quando há base), retargeting (visitantes/leads) e palavras-chave (Google).\n" +
      "6. Português do Brasil. Frases curtas. Sem clichês.\n" +
      "7. Devolva SEMPRE via tool `suggest_ads`.";

    const userPrompt =
      `=== BRIEFING ===\n${summarize(briefing)}\n\n` +
      `=== TAREFA ===\n` +
      `Gere 3-6 públicos e 4-8 ângulos de criativos prontos para teste em tráfego pago. ` +
      `Coerência obrigatória: cada criativo deve ressoar com pelo menos um item de DORES, GANHOS ou PENSA-SENTE do mapa da empatia. ` +
      `Inclua observações finais sobre prioridade de teste e cuidados de política de anúncios (claims, antes/depois) quando relevante.`;

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [adsTool],
        tool_choice: { type: "function", function: { name: "suggest_ads" } },
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

    return new Response(
      JSON.stringify({ data: parsed, engine, model }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-ads error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
