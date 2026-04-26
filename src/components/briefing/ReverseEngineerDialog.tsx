import { useEffect, useState } from "react";
import { AlertTriangle, Link as LinkIcon, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
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

interface ChoicePayload {
  errorCode: "SITE_BLOCKED" | "WEAK_CONTENT" | "EMPTY_CONTENT" | "INVALID_URL";
  message: string;
  preview: string;
  hasPerplexity: boolean;
  hasFirecrawl: boolean;
  scrapeStatus?: number;
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
                {choice.preview && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                      Ver prévia do conteúdo extraído
                    </summary>
                    <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted/50 p-2 text-[11px] whitespace-pre-wrap">
                      {choice.preview || "(vazio)"}
                    </pre>
                  </details>
                )}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-foreground">
                    Escolha como prosseguir:
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => run("fetch")}
                      disabled={running}
                      className="justify-start"
                    >
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                      Tentar scrape direto novamente
                    </Button>

                    {choice.hasFirecrawl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => run("firecrawl")}
                        disabled={running}
                        className="justify-start"
                      >
                        🔥 Extrair com Firecrawl
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" asChild className="justify-start">
                        <Link to="/integrations">🔥 Conectar Firecrawl</Link>
                      </Button>
                    )}

                    {choice.hasPerplexity ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => run("perplexity")}
                        disabled={running}
                        className="justify-start"
                      >
                        🔎 Pesquisar com Perplexity
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" asChild className="justify-start">
                        <Link to="/integrations">🔎 Conectar Perplexity</Link>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => { setChoice(null); setUrl(""); }}
                      disabled={running}
                      className="justify-start"
                    >
                      Usar outro link
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    💡 <strong>Scrape direto</strong>: rápido, mas falha em SPAs/sites protegidos.{" "}
                    <strong>Firecrawl</strong>: extração avançada (renderiza JS).{" "}
                    <strong>Perplexity</strong>: ignora a página e pesquisa o nicho na web.
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
