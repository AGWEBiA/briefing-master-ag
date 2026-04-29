import { useEffect, useState } from "react";
import { AlertTriangle, Link as LinkIcon, Loader2, RefreshCw, Sparkles, Star, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
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
import { useUserRole } from "@/hooks/useUserRole";

type Engine = "lovable" | "openai" | "gemini";
type ForceMethod = "fetch" | "firecrawl" | "perplexity";
type PageType = "spa" | "amp" | "ssr" | "static" | "blocked" | "unknown";

const PROVIDER_LABELS = {
  lovable: { label: "Lovable AI", icon: "✨" },
  openai: { label: "OpenAI", icon: "🤖" },
  gemini: { label: "Google Gemini", icon: "✨" },
  firecrawl: { label: "Firecrawl", icon: "🔥" },
  perplexity: { label: "Perplexity", icon: "🔎" },
} as const;

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
  recommended?: ForceMethod | null;
  methods?: { fetch: MethodFlag; firecrawl: MethodFlag; perplexity: MethodFlag };
  pageType?: PageType;
  pageTypeLabel?: string;
  pageSignals?: string[];
  thresholds?: { ok: number; usable: number; adjustment: number };
}

interface Props {
  onApply: (data: Record<string, string>) => void;
  trigger?: React.ReactNode;
}

const PAGE_TYPE_BADGE: Record<PageType, { label: string; cls: string }> = {
  spa: { label: "SPA (JS)", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
  amp: { label: "AMP", cls: "bg-primary/20 text-primary border-primary/40" },
  ssr: { label: "SSR", cls: "bg-success/20 text-success border-success/40" },
  static: { label: "HTML estático", cls: "bg-success/20 text-success border-success/40" },
  blocked: { label: "Bloqueado", cls: "bg-destructive/20 text-destructive border-destructive/40" },
  unknown: { label: "Tipo ?", cls: "bg-muted text-muted-foreground border-border" },
};

export const ReverseEngineerDialog = ({ onApply, trigger }: Props) => {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [engine, setEngine] = useState<Engine>("lovable");
  const [running, setRunning] = useState(false);
  const [choice, setChoice] = useState<ChoicePayload | null>(null);
  const [tried, setTried] = useState<ForceMethod[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<"good" | "bad" | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [available, setAvailable] = useState<{ openai: boolean; gemini: boolean; perplexity: boolean; firecrawl: boolean }>({
    openai: false, gemini: false, perplexity: false, firecrawl: false,
  });

  useEffect(() => {
    if (!open || !user) return;
    setChoice(null); setTried([]); setFeedbackSent(null);
    (async () => {
      setCheckingAvailability(true);
      // Pergunta à edge function quais providers estão *de fato* disponíveis
      // (mescla ai_integrations + secrets dos connectors do Lovable Cloud)
      const { data, error } = await supabase.functions.invoke("reverse-engineer", {
        body: { url: "https://ping.local", mode: "ping" },
      });
      if (error || !data) {
        // Fallback: lê só do banco
        const { data: db } = await supabase
          .from("ai_integrations")
          .select("provider, enabled")
          .eq("enabled", true);
        const set = { openai: false, gemini: false, perplexity: false, firecrawl: false };
        (db ?? []).forEach((r) => { (set as Record<string, boolean>)[r.provider] = true; });
        setAvailable(set);
        setCheckingAvailability(false);
        return;
      }
      setAvailable({
        openai: !!data.openai,
        gemini: !!data.gemini,
        perplexity: !!data.perplexity,
        firecrawl: !!data.firecrawl,
      });
      setCheckingAvailability(false);
    })();
  }, [open, user]);

  const providerStatus = [
    { id: "lovable" as const, active: true },
    { id: "firecrawl" as const, active: available.firecrawl },
    { id: "perplexity" as const, active: available.perplexity },
    { id: "openai" as const, active: available.openai },
    { id: "gemini" as const, active: available.gemini },
  ];

  const run = async (forceMethod?: ForceMethod, opts?: { keepTried?: boolean }) => {
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Informe uma URL válida (http/https).");
      return;
    }
    if (engine === "openai" && !available.openai) { toast.error("Conecte sua chave OpenAI em Integrações."); return; }
    if (engine === "gemini" && !available.gemini) { toast.error("Conecte sua chave Gemini em Integrações."); return; }

    setRunning(true);
    if (!opts?.keepTried) setFeedbackSent(null);

    const triedMethods = forceMethod ? Array.from(new Set([...tried, forceMethod])) : tried;
    const { data, error } = await supabase.functions.invoke("reverse-engineer", {
      body: { url, engine, mode: forceMethod ? "run" : "auto", forceMethod, triedMethods },
    });
    setRunning(false);

    if (error) {
      const msg = (error as { message?: string }).message ?? "Falha ao executar engenharia reversa";
      toast.error(msg);
      return;
    }

    if (data?.needsChoice) {
      setChoice(data as ChoicePayload);
      if (forceMethod) setTried((t) => Array.from(new Set([...t, forceMethod])));
      return;
    }

    if (data?.error) {
      toast.error(data.errorCode === "SITE_BLOCKED" ? "Site bloqueou a leitura. Tente Perplexity ou outro link." : data.error);
      return;
    }
    if (!data?.data || Object.keys(data.data).length === 0) {
      toast.error("A IA não retornou campos.");
      return;
    }

    onApply(data.data as Record<string, string>);
    toast.success(`Briefing preenchido (${data.engine}${data.usedPerplexity ? " + Perplexity" : ""}${data.usedFirecrawl ? " + Firecrawl" : ""}).`);
    setOpen(false); setUrl(""); setTried([]);
  };

  // Tenta automaticamente o próximo método não-tentado, na ordem recomendada
  const repeatScrape = async () => {
    if (!choice) return;
    const order: ForceMethod[] = [];
    if (choice.recommended) order.push(choice.recommended);
    (["firecrawl", "perplexity", "fetch"] as ForceMethod[]).forEach((m) => {
      if (!order.includes(m)) order.push(m);
    });
    const next = order.find((m) => {
      if (tried.includes(m)) return false;
      const flag = choice.methods?.[m];
      return flag?.available && !flag?.disabled;
    });
    if (!next) {
      toast.info("Todos os métodos disponíveis já foram tentados. Tente outro link ou conecte mais integrações.");
      return;
    }
    toast.info(`Tentando próximo método: ${next}…`);
    await run(next, { keepTried: true });
  };

  const sendFeedback = async (rating: "good" | "bad") => {
    if (!choice) return;
    setFeedbackSent(rating);
    const { data, error } = await supabase.functions.invoke("reverse-engineer", {
      body: {
        url, engine, mode: "feedback", rating,
        ratingScore: choice.preview.score,
        ratingMethod: choice.scrapeMethod,
        ratingChars: choice.preview.chars,
        ratingWords: choice.preview.words,
        ratingPageType: choice.pageType,
      },
    });
    if (error || data?.error) {
      toast.error("Não foi possível salvar seu feedback.");
      setFeedbackSent(null);
      return;
    }
    const adj = data?.thresholdAdjustment ?? 0;
    toast.success(
      `Obrigado! Limiar ajustado para ${data?.newOkThreshold ?? "—"}/100 ${adj > 0 ? `(+${adj})` : adj < 0 ? `(${adj})` : "(sem mudança)"}.`,
    );
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
                onChange={(e) => { setUrl(e.target.value); setTried([]); setChoice(null); }}
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
                  🤖 OpenAI {!available.openai && (isAdmin ? "(conecte em Integrações)" : "(indisponível)")}
                </SelectItem>
                <SelectItem value="gemini" disabled={!available.gemini}>
                  ✨ Google Gemini {!available.gemini && (isAdmin ? "(conecte em Integrações)" : "(indisponível)")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-foreground">Motores configurados</p>
              {checkingAvailability && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {providerStatus.map(({ id, active }) => {
                const meta = PROVIDER_LABELS[id];
                return (
                  <Badge key={id} variant={active ? "default" : "outline"} className="gap-1 text-[11px]">
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span className="opacity-75">{active ? "ativo" : "inativo"}</span>
                  </Badge>
                );
              })}
            </div>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              <span className="font-medium">Extração de conteúdo:</span> Firecrawl e Perplexity são fontes de scraping/pesquisa; OpenAI/Gemini são motores opcionais de estruturação. Usamos leitura direta da página por padrão.{" "}
              {available.firecrawl && "🔥 Firecrawl ativo. "}
              {available.perplexity && "🔎 Perplexity ativo. "}
              {!available.firecrawl && !available.perplexity && (isAdmin ? "Conecte Firecrawl ou Perplexity para resultados melhores em sites que bloqueiam scraping." : "Para resultados melhores em sites que bloqueiam scraping, peça ao administrador para conectar Firecrawl ou Perplexity.")}{" "}
              {isAdmin && <Link to="/integrations" className="text-primary underline">Gerenciar integrações</Link>}
            </AlertDescription>
          </Alert>

          {choice && (
            <Alert variant="destructive" className="border-warning/40 bg-warning/10 text-foreground">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {choice.errorCode === "SITE_BLOCKED"
                        ? `Site bloqueou a leitura${choice.scrapeStatus ? ` (HTTP ${choice.scrapeStatus})` : ""}`
                        : "Conteúdo extraído insuficiente"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{choice.message}</p>
                  </div>
                  {choice.pageType && (
                    <Badge variant="outline" className={`text-[10px] ${PAGE_TYPE_BADGE[choice.pageType].cls}`} title={choice.pageSignals?.join(" · ")}>
                      {PAGE_TYPE_BADGE[choice.pageType].label}
                    </Badge>
                  )}
                </div>

                {/* Indicador de qualidade */}
                <div className="rounded-md border bg-background/60 p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">Qualidade do conteúdo raspado</span>
                    <span className="font-mono">
                      {choice.preview.score}/100 · {choice.preview.level}
                      {choice.thresholds && choice.thresholds.adjustment !== 0 && (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          (limiar {choice.thresholds.ok}{choice.thresholds.adjustment > 0 ? ` +${choice.thresholds.adjustment}` : ` ${choice.thresholds.adjustment}`})
                        </span>
                      )}
                    </span>
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

                  {/* Feedback bom/ruim */}
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t">
                    <span className="text-[10px] text-muted-foreground">Esta avaliação ajuda?</span>
                    <div className="flex gap-1">
                      <Button
                        type="button" size="sm" variant={feedbackSent === "good" ? "default" : "outline"}
                        className="h-6 px-2 text-[10px] gap-1"
                        disabled={!!feedbackSent}
                        onClick={() => sendFeedback("good")}
                      >
                        <ThumbsUp className="h-3 w-3" /> Bom
                      </Button>
                      <Button
                        type="button" size="sm" variant={feedbackSent === "bad" ? "default" : "outline"}
                        className="h-6 px-2 text-[10px] gap-1"
                        disabled={!!feedbackSent}
                        onClick={() => sendFeedback("bad")}
                      >
                        <ThumbsDown className="h-3 w-3" /> Ruim
                      </Button>
                    </div>
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
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Escolha como prosseguir:</p>
                    <Button
                      type="button" size="sm" variant="secondary"
                      onClick={repeatScrape} disabled={running}
                      className="h-7 px-2 text-[11px] gap-1"
                      title="Tenta automaticamente o próximo método disponível, mantendo o mesmo link"
                    >
                      <RefreshCw className={`h-3 w-3 ${running ? "animate-spin" : ""}`} /> Repetir raspagem
                    </Button>
                  </div>

                  {tried.length > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      Já tentado: {tried.join(", ")}
                    </p>
                  )}

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
                      const wasTried = tried.includes(id);

                      if (!flag.available) {
                        if (!isAdmin) {
                          return (
                            <Button key={id} type="button" size="sm" variant="outline" disabled className="h-auto py-2 flex flex-col items-start gap-0.5">
                              <span>{meta.icon} {meta.label}</span>
                              <span className="text-[10px] text-muted-foreground">Indisponível</span>
                            </Button>
                          );
                        }
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
                          key={id} type="button" size="sm"
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
                            <span>{meta.icon} {meta.label}</span>
                            {wasTried && <span className="text-[9px] opacity-70">(tentado)</span>}
                          </span>
                          <span className="text-[10px] opacity-80 font-normal">
                            {flag.disabled ? (flag.reason ?? "Indisponível") : meta.hint}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                  <Button
                    type="button" size="sm" variant="ghost"
                    onClick={() => { setChoice(null); setUrl(""); setTried([]); }}
                    disabled={running} className="w-full justify-start"
                  >
                    Usar outro link
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    💡 A página foi classificada como <strong>{choice.pageType ? PAGE_TYPE_BADGE[choice.pageType].label : "?"}</strong>; a recomendação se ajusta a esse tipo. Seu feedback recalibra o limiar de qualidade.
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
