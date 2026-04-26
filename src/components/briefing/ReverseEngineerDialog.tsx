import { useEffect, useState } from "react";
import { AlertTriangle, Link as LinkIcon, Loader2, RefreshCw, Sparkles, Star, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Engine = "lovable" | "openai" | "gemini";
type ForceMethod = "fetch" | "firecrawl" | "perplexity";

interface PreviewPayload {
  length: number;
  chars: number;
  words: number;
  score: number;
  level: "alta" | "média" | "baixa" | "insuficiente";
  head: string;
  middle: string;
  tail: string;
}

interface MethodFlag { available: boolean; disabled: boolean; reason?: string }

interface ChoicePayload {
  errorCode: "SITE_BLOCKED" | "WEAK_CONTENT" | "EMPTY_CONTENT" | "INVALID_URL";
  message: string;
  preview: PreviewPayload;
  hasPerplexity: boolean;
  hasFirecrawl: boolean;
  scrapeStatus?: number;
  scrapeMethod?: string;
  recommended?: "fetch" | "firecrawl" | "perplexity" | null;
  methods?: { fetch: MethodFlag; firecrawl: MethodFlag; perplexity: MethodFlag };
}

interface Props {
  onApply: (data: Record<string, string>) => void;
  trigger?: React.ReactNode;
}

export const ReverseEngineerDialog = ({ onApply, trigger }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [engine, setEngine] = useState<Engine>("lovable");
  const [running, setRunning] = useState(false);
  const [choice, setChoice] = useState<ChoicePayload | null>(null);
  const [available, setAvailable] = useState<{ openai: boolean; gemini: boolean; perplexity: boolean; firecrawl: boolean }>({
    openai: false, gemini: false, perplexity: false, firecrawl: false,
  });

  useEffect(() => {
    if (!open || !user) return;
    setChoice(null);
    (async () => {
      const { data } = await supabase
        .from("ai_integrations")
        .select("provider, enabled")
        .eq("enabled", true);
      const set = { openai: false, gemini: false, perplexity: false, firecrawl: false };
      (data ?? []).forEach((r) => { (set as Record<string, boolean>)[r.provider] = true; });
      setAvailable(set);
    })();
  }, [open, user]);

  const run = async (forceMethod?: ForceMethod) => {
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Informe uma URL válida (http/https).");
      return;
    }
    if (engine === "openai" && !available.openai) {
      toast.error("Conecte sua chave OpenAI em Integrações.");
      return;
    }
    if (engine === "gemini" && !available.gemini) {
      toast.error("Conecte sua chave Gemini em Integrações.");
      return;
    }

    setRunning(true);
    setChoice(null);
    const { data, error } = await supabase.functions.invoke("reverse-engineer", {
      body: { url, engine, mode: forceMethod ? "run" : "auto", forceMethod },
    });
    setRunning(false);

    if (error) {
      const msg = (error as { message?: string }).message ?? "Falha ao executar engenharia reversa";
      toast.error(msg);
      return;
    }

    // Conteúdo fraco / site bloqueado → mostra opções
    if (data?.needsChoice) {
      setChoice(data as ChoicePayload);
      return;
    }

    if (data?.error) {
      const code = data.errorCode;
      if (code === "SITE_BLOCKED") {
        toast.error("Site bloqueou a leitura automatizada. Tente com Perplexity ou outro link.");
      } else {
        toast.error(data.error);
      }
      return;
    }
    if (!data?.data || Object.keys(data.data).length === 0) {
      toast.error("A IA não retornou campos.");
      return;
    }

    onApply(data.data as Record<string, string>);
    toast.success(
      `Briefing preenchido (${data.engine}${data.usedPerplexity ? " + Perplexity" : ""}${data.usedFirecrawl ? " + Firecrawl" : ""}).`,
    );
    setOpen(false);
    setUrl("");
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="default" className="gap-2">
            <Wand2 className="h-4 w-4" /> Engenharia Reversa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Engenharia Reversa por Link
          </DialogTitle>
          <DialogDescription>
            Cole o link de uma página de vendas ou site. A IA analisa o conteúdo e preenche o briefing automaticamente.
            <strong className="block mt-1 text-foreground">Atenção: todos os campos atuais serão sobrescritos.</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="re-url">URL da página</Label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="re-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemplo.com/produto"
                className="pl-9"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Motor de IA para estruturar</Label>
            <Select value={engine} onValueChange={(v) => setEngine(v as Engine)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">✨ Lovable AI (Gemini Flash) — pré-configurado</SelectItem>
                <SelectItem value="openai" disabled={!available.openai}>
                  🤖 OpenAI {!available.openai && "(conecte em Integrações)"}
                </SelectItem>
                <SelectItem value="gemini" disabled={!available.gemini}>
                  ✨ Google Gemini {!available.gemini && "(conecte em Integrações)"}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              <span className="font-medium">Extração de conteúdo:</span> usamos leitura direta da página por padrão.{" "}
              {available.firecrawl && "🔥 Firecrawl ativo (extração avançada de SPAs/sites protegidos). "}
              {available.perplexity && "🔎 Perplexity ativo (pesquisa de público-alvo + fallback se o site bloquear). "}
              {!available.firecrawl && !available.perplexity && "Conecte Firecrawl ou Perplexity para resultados melhores em sites que bloqueiam scraping."}{" "}
              <Link to="/integrations" className="text-primary underline">Gerenciar integrações</Link>
            </AlertDescription>
          </Alert>

          {choice && (
            <Alert variant="destructive" className="border-warning/40 bg-warning/10 text-foreground">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div>
                  <p className="font-medium">
                    {choice.errorCode === "SITE_BLOCKED"
                      ? `Site bloqueou a leitura${choice.scrapeStatus ? ` (HTTP ${choice.scrapeStatus})` : ""}`
                      : "Conteúdo extraído insuficiente"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{choice.message}</p>
                </div>
                {/* Indicador de qualidade */}
                <div className="rounded-md border bg-background/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Qualidade do conteúdo raspado</span>
                    <span className="font-mono">{choice.preview.score}/100 · {choice.preview.level}</span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={
                        "h-full transition-all " + (
                          choice.preview.level === "alta" ? "bg-success" :
                          choice.preview.level === "média" ? "bg-primary" :
                          choice.preview.level === "baixa" ? "bg-warning" : "bg-destructive"
                        )
                      }
                      style={{ width: `${choice.preview.score}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                    <span>{choice.preview.length.toLocaleString("pt-BR")} caracteres</span>
                    <span>·</span>
                    <span>{choice.preview.words.toLocaleString("pt-BR")} palavras</span>
                    {choice.scrapeMethod && <><span>·</span><span>via {choice.scrapeMethod}</span></>}
                  </div>
                </div>

                {/* Prévia em trechos */}
                {(choice.preview.head || choice.preview.middle || choice.preview.tail) && (
                  <details className="text-xs" open={choice.preview.score < 30}>
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver trechos do conteúdo extraído
                    </summary>
                    <div className="mt-2 space-y-2 text-[11px]">
                      {choice.preview.head && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Início</div>
                          <p className="rounded bg-muted/50 p-2 whitespace-pre-wrap">{choice.preview.head}</p>
                        </div>
                      )}
                      {choice.preview.middle && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Meio</div>
                          <p className="rounded bg-muted/50 p-2 whitespace-pre-wrap">{choice.preview.middle}</p>
                        </div>
                      )}
                      {choice.preview.tail && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Fim</div>
                          <p className="rounded bg-muted/50 p-2 whitespace-pre-wrap">{choice.preview.tail}</p>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">Escolha como prosseguir:</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {(["fetch", "firecrawl", "perplexity"] as const).map((id) => {
                      const meta = {
                        fetch: { icon: "⚡", label: "Scrape direto", hint: "Rápido, falha em SPAs" },
                        firecrawl: { icon: "🔥", label: "Firecrawl", hint: "Renderiza JavaScript" },
                        perplexity: { icon: "🔎", label: "Perplexity", hint: "Pesquisa o nicho" },
                      }[id];
                      const flag = (choice.methods ?? {
                        fetch: { available: true, disabled: false },
                        firecrawl: { available: choice.hasFirecrawl, disabled: false },
                        perplexity: { available: choice.hasPerplexity, disabled: false },
                      })[id];
                      const isRecommended = choice.recommended === id;

                      if (!flag.available) {
                        return (
                          <Button key={id} type="button" size="sm" variant="outline" asChild className="h-auto py-2">
                            <Link to="/integrations" className="flex flex-col items-start gap-0.5 w-full">
                              <span>{meta.icon} Conectar {meta.label}</span>
                              <span className="text-[10px] text-muted-foreground">{flag.reason ?? meta.hint}</span>
                            </Link>
                          </Button>
                        );
                      }
                      return (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant={isRecommended ? "default" : "outline"}
                          onClick={() => run(id)}
                          disabled={running || flag.disabled}
                          className="h-auto py-2 flex flex-col items-start gap-0.5 relative"
                          title={flag.reason}
                        >
                          {isRecommended && (
                            <Badge className="absolute -top-2 -right-2 h-4 px-1.5 text-[9px] gap-0.5">
                              <Star className="h-2.5 w-2.5" /> Recomendado
                            </Badge>
                          )}
                          <span className="flex items-center gap-1">
                            {id === "fetch" && <RefreshCw className="h-3.5 w-3.5" />}
                            <span>{meta.icon} {meta.label}</span>
                          </span>
                          <span className="text-[10px] opacity-80 font-normal">
                            {flag.disabled ? (flag.reason ?? "Indisponível") : meta.hint}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => { setChoice(null); setUrl(""); }}
                    disabled={running}
                    className="w-full justify-start"
                  >
                    Usar outro link
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    💡 Métodos abaixo do mínimo aparecem desabilitados; a alternativa <strong>Recomendada</strong> está destacada.
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>Cancelar</Button>
          <Button onClick={() => run()} disabled={running || !url}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {running ? "Analisando..." : "Preencher briefing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
