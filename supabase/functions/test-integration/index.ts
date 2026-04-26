// Testa se a chave de API de um provedor de IA realmente funciona,
// fazendo uma chamada leve à API do provedor.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Provider = "perplexity" | "openai" | "gemini" | "firecrawl";

interface TestResult {
  ok: boolean;
  provider: Provider;
  message: string;
  detail?: string;
  model?: string;
}

async function testFirecrawl(apiKey: string): Promise<TestResult> {
  // Endpoint leve: scrape de example.com
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: "https://example.com",
      formats: ["markdown"],
      onlyMainContent: true,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    return {
      ok: true,
      provider: "firecrawl",
      message: "Conexão validada — scraping funcionando.",
    };
  }
  return {
    ok: false,
    provider: "firecrawl",
    message: r.status === 401 || r.status === 403
      ? "Chave inválida ou sem permissão."
      : `Falha (${r.status}).`,
    detail: data?.error ?? r.statusText,
  };
}

async function testPerplexity(apiKey: string, model: string): Promise<TestResult> {
  const r = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "Reply with the single word: OK" },
        { role: "user", content: "ping" },
      ],
      max_tokens: 5,
      temperature: 0,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    return {
      ok: true,
      provider: "perplexity",
      message: "Conexão validada com Perplexity.",
      model,
    };
  }
  return {
    ok: false,
    provider: "perplexity",
    message: r.status === 401 ? "Chave inválida." : `Falha (${r.status}).`,
    detail: data?.error?.message ?? data?.error ?? r.statusText,
    model,
  };
}

async function testOpenAI(apiKey: string, model: string): Promise<TestResult> {
  // /v1/models é leve e valida a chave sem consumir tokens
  const r = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    const hasModel = Array.isArray(data?.data)
      ? data.data.some((m: { id: string }) => m.id === model)
      : false;
    return {
      ok: true,
      provider: "openai",
      message: hasModel
        ? `Conexão validada. Modelo "${model}" disponível.`
        : `Conexão validada, mas o modelo "${model}" não foi encontrado nesta conta.`,
      model,
    };
  }
  return {
    ok: false,
    provider: "openai",
    message: r.status === 401 ? "Chave inválida." : `Falha (${r.status}).`,
    detail: data?.error?.message ?? r.statusText,
    model,
  };
}

async function testGemini(apiKey: string, model: string): Promise<TestResult> {
  // Lista modelos disponíveis para a chave
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  const data = await r.json().catch(() => ({}));
  if (r.ok) {
    const names: string[] = (data?.models ?? []).map((m: { name: string }) =>
      (m.name ?? "").replace(/^models\//, "")
    );
    const hasModel = names.includes(model);
    return {
      ok: true,
      provider: "gemini",
      message: hasModel
        ? `Conexão validada. Modelo "${model}" disponível.`
        : `Conexão validada, mas o modelo "${model}" não foi encontrado.`,
      model,
    };
  }
  return {
    ok: false,
    provider: "gemini",
    message: r.status === 400 || r.status === 403
      ? "Chave inválida ou API Generative Language não habilitada."
      : `Falha (${r.status}).`,
    detail: data?.error?.message ?? r.statusText,
    model,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const body = await req.json().catch(() => ({}));
    const provider = body?.provider as Provider | undefined;
    if (!provider || !["perplexity", "openai", "gemini", "firecrawl"].includes(provider)) {
      return new Response(JSON.stringify({ error: "Provedor inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Carrega a chave do banco (não confia em chave vinda do cliente)
    const { data: integration, error: intErr } = await supabase
      .from("ai_integrations")
      .select("api_key, default_model")
      .eq("user_id", userId)
      .eq("provider", provider)
      .maybeSingle();

    if (intErr || !integration?.api_key) {
      return new Response(
        JSON.stringify({
          ok: false,
          provider,
          message: "Nenhuma chave salva para este provedor. Salve antes de testar.",
        } as TestResult),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = integration.api_key;
    const model = integration.default_model ?? "";

    let result: TestResult;
    if (provider === "firecrawl") {
      result = await testFirecrawl(apiKey);
    } else if (provider === "perplexity") {
      result = await testPerplexity(apiKey, model || "sonar");
    } else if (provider === "openai") {
      result = await testOpenAI(apiKey, model || "gpt-4o-mini");
    } else {
      result = await testGemini(apiKey, model || "gemini-2.0-flash");
    }

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("test-integration error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
