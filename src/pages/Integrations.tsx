import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound,
  Loader2, Plug, Sparkles, Trash2, XCircle, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { PROVIDERS, type AIProvider } from "@/lib/aiProviders";

interface IntegrationRow {
  id: string;
  provider: AIProvider;
  api_key: string;
  default_model: string | null;
  enabled: boolean;
}

const Integrations = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<AIProvider, IntegrationRow | null>>({
    perplexity: null, openai: null, gemini: null, firecrawl: null,
  });
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<AIProvider, { key: string; model: string }>>({
    perplexity: { key: "", model: "" },
    openai: { key: "", model: "" },
    gemini: { key: "", model: "" },
    firecrawl: { key: "", model: "" },
  });
  const [reveal, setReveal] = useState<Record<AIProvider, boolean>>({
    perplexity: false, openai: false, gemini: false, firecrawl: false,
  });
  const [saving, setSaving] = useState<AIProvider | null>(null);
  const [testing, setTesting] = useState<AIProvider | null>(null);
  const [testResults, setTestResults] = useState<Record<AIProvider, { ok: boolean; message: string } | null>>({
    perplexity: null, openai: null, gemini: null, firecrawl: null,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("ai_integrations").select("*");
      if (error) { toast.error("Erro ao carregar integrações"); setLoading(false); return; }
      const next = { perplexity: null, openai: null, gemini: null, firecrawl: null } as Record<AIProvider, IntegrationRow | null>;
      const draftNext = { ...drafts };
      (data ?? []).forEach((r) => {
        next[r.provider as AIProvider] = r as IntegrationRow;
        draftNext[r.provider as AIProvider] = { key: r.api_key, model: r.default_model ?? "" };
      });
      setRows(next);
      setDrafts(draftNext);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [user]);

  const save = async (provider: AIProvider) => {
    if (!user) return;
    const draft = drafts[provider];
    if (!draft.key.trim()) { toast.error("Informe uma chave de API"); return; }
    setSaving(provider);
    const payload = {
      user_id: user.id,
      provider,
      api_key: draft.key.trim(),
      default_model: draft.model.trim() || null,
      enabled: true,
    };
    const { data, error } = await supabase
      .from("ai_integrations")
      .upsert(payload, { onConflict: "user_id,provider" })
      .select("*").single();
    setSaving(null);
    if (error) { toast.error("Falha ao salvar integração"); return; }
    setRows((r) => ({ ...r, [provider]: data as IntegrationRow }));
    toast.success("Integração salva");
  };

  const toggleEnabled = async (provider: AIProvider, enabled: boolean) => {
    const row = rows[provider]; if (!row) return;
    const { error } = await supabase
      .from("ai_integrations").update({ enabled }).eq("id", row.id);
    if (error) { toast.error("Falha ao atualizar"); return; }
    setRows((r) => ({ ...r, [provider]: { ...row, enabled } }));
  };

  const remove = async (provider: AIProvider) => {
    const row = rows[provider]; if (!row) return;
    if (!confirm(`Remover a integração ${provider}?`)) return;
    const { error } = await supabase.from("ai_integrations").delete().eq("id", row.id);
    if (error) { toast.error("Falha ao remover"); return; }
    setRows((r) => ({ ...r, [provider]: null }));
    setDrafts((d) => ({ ...d, [provider]: { key: "", model: "" } }));
    toast.success("Integração removida");
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
        </Button>

        <div className="mt-3 mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Plug className="h-6 w-6 text-primary" /> Integrações de IA
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte motores externos para potencializar a engenharia reversa de briefings a partir de um link.
          </p>
        </div>

        {/* Lovable AI – sempre ativo */}
        <Card className="mb-6 border-primary/30 bg-primary-soft/40">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Lovable AI</CardTitle>
                <CardDescription>
                  Modelos do Lovable AI Gateway (Gemini e GPT) — pré-configurado, sem chave necessária.
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-success text-success-foreground gap-1">
              <CheckCircle2 className="h-3 w-3" /> Ativo
            </Badge>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-4">
            {PROVIDERS.map((p) => {
              const row = rows[p.id];
              const draft = drafts[p.id];
              const isConnected = !!row;
              return (
                <Card key={p.id} className={isConnected ? "border-primary/30" : ""}>
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                        <span>{p.emoji}</span>
                      </div>
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {p.name}
                          {isConnected && (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3 text-success" /> Conectado
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>{p.description}</CardDescription>
                      </div>
                    </div>
                    {isConnected && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={row.enabled}
                          onCheckedChange={(v) => toggleEnabled(p.id, v)}
                          aria-label="Habilitar"
                        />
                        <Button variant="ghost" size="icon" onClick={() => remove(p.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor={`${p.id}-key`} className="flex items-center gap-1.5">
                        <KeyRound className="h-3.5 w-3.5" /> Chave de API
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id={`${p.id}-key`}
                          type={reveal[p.id] ? "text" : "password"}
                          placeholder="sk-..."
                          value={draft.key}
                          onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], key: e.target.value } }))}
                        />
                        <Button type="button" variant="outline" size="icon"
                          onClick={() => setReveal((r) => ({ ...r, [p.id]: !r[p.id] }))}>
                          {reveal[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                      <a href={p.docsUrl} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        Onde encontrar a chave <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {p.needsModel && (
                      <div className="space-y-1.5">
                        <Label>Modelo padrão</Label>
                        <Select
                          value={draft.model || p.defaultModel || ""}
                          onValueChange={(v) =>
                            setDrafts((d) => ({ ...d, [p.id]: { ...d[p.id], model: v } }))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            {p.modelOptions?.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button onClick={() => save(p.id)} disabled={saving === p.id}>
                        {saving === p.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isConnected ? "Atualizar" : "Conectar"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Integrations;
