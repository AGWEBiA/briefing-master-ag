import { useEffect, useState } from "react";
import { Link as LinkIcon, Loader2, Sparkles, Wand2 } from "lucide-react";
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
  const [available, setAvailable] = useState<{ openai: boolean; gemini: boolean; perplexity: boolean; firecrawl: boolean }>({
    openai: false, gemini: false, perplexity: false, firecrawl: false,
  });

  useEffect(() => {
    if (!open || !user) return;
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

  const run = async () => {
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
    const { data, error } = await supabase.functions.invoke("reverse-engineer", {
      body: { url, engine },
    });
    setRunning(false);

    if (error) {
      const msg = (error as { message?: string }).message ?? "Falha ao executar engenharia reversa";
      toast.error(msg);
      return;
    }
    if (data?.error) {
      toast.error(data.error);
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
              <span className="font-medium">Pesquisa enriquecida:</span>{" "}
              {available.firecrawl ? "🔥 Firecrawl ativo" : "⚪ Firecrawl não conectado (usaremos fetch direto)"} ·{" "}
              {available.perplexity ? "🔎 Perplexity ativo" : "⚪ Perplexity não conectado"}.{" "}
              <Link to="/integrations" className="text-primary underline">Gerenciar integrações</Link>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={running}>Cancelar</Button>
          <Button onClick={run} disabled={running || !url}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {running ? "Analisando..." : "Preencher briefing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
