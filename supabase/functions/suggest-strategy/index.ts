// suggest-strategy: preenche os campos textuais (textarea/text longos) da
// estratégia ativa do briefing usando como base o estudo de público-alvo
// (avatar + dores/desejos/objeções + nível de consciência) e o mapa da empatia.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Catálogo de campos preenchíveis por IA, por estratégia.
// Mantemos apenas campos textuais ricos (textarea / texto longo). Datas, valores
// e selects ficam de fora — o usuário decide.
const STRATEGY_FILLABLE: Record<string, Record<string, string>> = {
  lp: {
    lp_promessaEvento: "Grande promessa do evento pago — o que a pessoa sairá sabendo/conseguindo fazer. Frase única, direta.",
    lp_sequenciaEmail: "Sequência de e-mails pós-compra do ingresso até o dia do evento. Liste 4-6 e-mails com objetivo + ângulo de cada um.",
    lp_inclusoVIP: "Diferenciais do ingresso VIP frente ao básico (acesso, bônus, mentoria, gravações, etc.).",
    lp_orderBump: "Sugestão de order bump no checkout do ingresso — produto barato e complementar.",
    lp_downsell: "Downsell para quem participou mas não comprou o produto principal.",
    lp_estrategiaShowup: "Estratégia detalhada de show-up para garantir presença no evento (lembretes, gamificação, bônus por presença).",
    lp_pitchVendas: "Estrutura do pitch de vendas durante o evento (sequência de blocos: contexto → método → oferta → bônus → urgência → CTA).",
  },
  lo: {
    lo_temaCPLs: "Tema e foco de cada CPL (gratuito). Detalhe CPL1, CPL2 e CPL3 com promessa e gatilho de cada um.",
    lo_estrategiaCaptura: "Estratégia de captura de leads para os CPLs (iscas, página de captura, anúncios, parcerias).",
    lo_sequenciaEmail: "Sequência completa de e-mails do pré-lançamento (do opt-in até abertura de carrinho). Liste 6-10 e-mails com ângulo.",
    lo_estrategiaCarrinho: "Estratégia de abertura de carrinho — gatilhos, bônus por ordem de compra, lives, contagem regressiva.",
  },
  ls: {
    ls_ideiacentral: "Refine a ideia central do produto-piloto a ser validado (problema atacado + solução proposta + público).",
  },
  li: {
    li_reaquecimento: "Estratégia detalhada de reaquecimento da base antes da oferta interna (tipo de conteúdo, frequência, formato).",
    li_sequenciaEmail: "Sequência de e-mails do lançamento interno do início do reaquecimento até o fechamento. Liste 6-10 e-mails.",
  },
  pe: {
    pe_upsellDownsell: "Sequência de upsell/downsell pós-compra adequada ao funil escolhido. Justifique cada oferta.",
    pe_automacao: "Sequência de automação (e-mail / WhatsApp) do funil evergreen — do opt-in à conversão e nutrição pós-compra.",
  },
  af: {
    af_recrutamento: "Estratégia de recrutamento de afiliados (canais, abordagem, ranking, premiações, materiais de convite).",
    af_materiais: "Lista de materiais de divulgação a serem fornecidos para afiliados (copies, criativos, templates, swipes).",
    af_suporteAfiliados: "Plano de suporte e treinamento contínuo para afiliados (lives, grupo, FAQ, onboarding).",
  },
  cp: {
    cp_papelExpert: "Responsabilidades específicas do expert na co-produção (conteúdo, autoridade, gravações, presença).",
    cp_papelProdutor: "Responsabilidades específicas do produtor na co-produção (operação, tráfego, copy, equipe, tecnologia).",
    cp_responsabilidades: "Detalhamento operacional de quem faz o quê (matriz RACI simplificada por pilar).",
  },
  vd: {
    vd_grandePromessa: "Grande promessa da oferta direta — promessa + prazo + mecanismo único. Frase única e potente.",
    vd_mecanismoUnico: "Mecanismo único / diferencial: por que ESSA oferta funciona quando outras falharam? Liste 2-3 razões.",
    vd_urgenciaEscassez: "Urgência e escassez reais e éticas (vagas, bônus por tempo, condição especial). 2-3 alavancas.",
    vd_estruturaCopy: "Estrutura completa da copy/roteiro VSL: hook → história → problema → solução → prova → oferta → urgência → CTA. Detalhe blocos.",
    vd_anguloCriativo: "Ao menos 4 ângulos distintos de criativos para teste em ads (dor, desejo, prova, contraste, mecanismo, antagonista).",
    vd_orderBump: "Order bump complementar à oferta principal.",
    vd_upsell1: "Upsell #1 imediato pós-compra (produto/serviço de maior ticket coerente com a transformação).",
    vd_downsell: "Downsell caso o lead recuse o upsell.",
    vd_recuperacaoCarrinho: "Estratégia multi-canal de recuperação de carrinho (e-mail + WhatsApp + retargeting).",
    vd_pagamentoBoleto: "Régua de recuperação de boleto/PIX pendente (timing, canais, ofertas).",
  },
};

function buildToolSchema(strategyId: string) {
  const fields = STRATEGY_FILLABLE[strategyId];
  if (!fields) return null;
  const properties: Record<string, unknown> = {};
  for (const id of Object.keys(fields)) {
    properties[id] = { type: "string", description: fields[id] };
  }
  return {
    type: "function",
    function: {
      name: "suggest_strategy_fields",
      description: "Devolve preenchimento textual sugerido para os campos da estratégia ativa.",
      parameters: {
        type: "object",
        properties,
        required: [Object.keys(fields)[0]],
        additionalProperties: false,
      },
    },
  };
}

function summarize(d: Record<string, string | undefined>): string {
  const f = (label: string, value?: string) =>
    value && value.trim() ? `- **${label}**: ${value.trim()}` : null;
  return [
    "## Produto",
    f("Nome", d.nomeProduto),
    f("Nicho", d.nicho),
    f("Categoria", d.categoriaProduto),
    f("Formato de entrega", d.formatoEntrega),
    f("Transformação", d.transformacaoPrincipal),
    f("Tempo p/ resultado", d.tempoResultado),
    f("Preço", d.precoProduto),
    f("Garantia", d.garantia),
    "## Avatar",
    f("Descrição", d.descricaoAvatar),
    f("Dor #1", d.dor1), f("Dor #2", d.dor2), f("Dor #3", d.dor3),
    f("Desejo #1", d.desejo1), f("Desejo #2", d.desejo2), f("Desejo #3", d.desejo3),
    f("Objeção #1", d.objecao1), f("Objeção #2", d.objecao2), f("Objeção #3", d.objecao3),
    f("Nível de consciência", d.nivelConsciencia),
    f("Canais online", d.canaisOnline),
    "## Mapa da Empatia",
    f("VÊ", d.me_ve),
    f("OUVE", d.me_ouve),
    f("PENSA/SENTE", d.me_pensaSente),
    f("FALA/FAZ", d.me_falaFaz),
    f("DORES", d.me_dores),
    f("GANHOS", d.me_ganhos),
    "## Posicionamento",
    f("Expert", d.nomeExpert),
    f("História", d.historiaTransformacao),
    f("Provas sociais", d.provasSociais),
    f("Diferenciais", d.diferenciais),
    "## Estrutura",
    f("Módulos", d.modulosPrincipais),
    f("Bônus", d.bonusIncluidos),
    f("Suporte", d.suporteOferecido),
    "## Metas",
    f("Meta de faturamento", d.metaFaturamento),
    f("Orçamento de tráfego", d.orcamentoTrafego),
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
    const { briefing, strategyId, engine = "lovable", overwrite = false } = body as {
      briefing?: Record<string, string>;
      strategyId?: string;
      engine?: "lovable" | "openai" | "gemini";
      overwrite?: boolean;
    };

    if (!briefing || !strategyId) {
      return new Response(JSON.stringify({ error: "Faltam briefing/strategyId." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tool = buildToolSchema(strategyId);
    if (!tool) {
      return new Response(JSON.stringify({ error: `Estratégia '${strategyId}' sem campos preenchíveis por IA.` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pré-condição: precisa ter alguma base de avatar/empatia
    const hasBase =
      (briefing.descricaoAvatar?.trim()?.length ?? 0) > 20 ||
      (briefing.me_dores?.trim()?.length ?? 0) > 20 ||
      (briefing.me_ganhos?.trim()?.length ?? 0) > 20;
    if (!hasBase) {
      return new Response(JSON.stringify({
        error: "Preencha primeiro o Avatar (descrição/dores/desejos) e o Mapa da Empatia. A IA usa esses dados como base.",
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

    const summary = summarize(briefing);
    const fillable = STRATEGY_FILLABLE[strategyId];
    const fillableList = Object.entries(fillable)
      .map(([k, v]) => `- \`${k}\`: ${v}`).join("\n");

    const systemPrompt =
      "Você é um estrategista sênior de lançamentos e marketing de resposta direta para infoprodutos. " +
      "Sua tarefa é preencher campos TEXTUAIS de uma estratégia específica de lançamento, com base no estudo de público-alvo (avatar) e no mapa da empatia já definidos no briefing.\n\n" +
      "REGRAS OBRIGATÓRIAS:\n" +
      "1. NUNCA invente números, depoimentos, métricas, prazos ou nomes que não estejam no briefing.\n" +
      "2. Use SEMPRE a linguagem, dores e desejos do avatar — recorra ao mapa da empatia para escolher palavras (VÊ/OUVE) e ângulos emocionais (PENSA-SENTE, DORES, GANHOS).\n" +
      "3. Português do Brasil. Tom direto, prático, executável. Sem clichês ('alavancar', 'transformar vidas').\n" +
      "4. Para sequências de e-mails: liste itens curtos no formato `Email N — [ângulo/objetivo]: 1 frase do que entrega`.\n" +
      "5. Para roteiros/copy: blocos numerados, máximo 1-2 frases por bloco.\n" +
      "6. Quando inventar é necessário (ex.: nome de bônus), use [colchetes] para indicar placeholder.\n" +
      "7. Devolva SEMPRE chamando a tool `suggest_strategy_fields`.";

    const userPrompt =
      `=== BRIEFING ===\n${summary}\n\n` +
      `=== ESTRATÉGIA ATIVA ===\n${strategyId}\n\n` +
      `=== CAMPOS A PREENCHER ===\n${fillableList}\n\n` +
      `=== TAREFA ===\n` +
      `Preencha cada campo da tool com texto pronto para uso, fortemente ancorado no avatar e no mapa da empatia. ` +
      `${overwrite ? "Você pode sobrescrever conteúdo já existente." : "Se já houver conteúdo no briefing para um campo, complemente sem duplicar."}`;

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
        tool_choice: { type: "function", function: { name: "suggest_strategy_fields" } },
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
      if (typeof v === "string" && v.trim()) {
        // Respeita overwrite: se false e já houver valor, mantém o existente
        const existing = (briefing[k] ?? "").trim();
        if (!overwrite && existing.length > 0) continue;
        out[k] = v.trim();
      }
    }

    return new Response(
      JSON.stringify({ data: out, engine, model, strategyId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("suggest-strategy error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
