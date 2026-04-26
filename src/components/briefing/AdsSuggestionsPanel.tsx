import { useState } from "react";
import { Loader2, Megaphone, Target, Copy, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface AdAudience {
  nome: string;
  plataforma: string;
  tipo: string;
  segmentacao: string;
  justificativa: string;
}
interface AdCreative {
  angulo: string;
  dorOuDesejo: string;
  formato: string;
  hook: string;
  roteiro: string;
  cta: string;
}
interface AdsResponse {
  publicos: AdAudience[];
  criativos: AdCreative[];
  observacoes?: string;
}

interface Props {
  briefing: Record<string, string>;
}

export const AdsSuggestionsPanel = ({ briefing }: Props) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdsResponse | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("suggest-ads", {
      body: { briefing },
    });
    setLoading(false);
    if (error || res?.error) {
      toast.error(res?.error ?? (error as { message?: string })?.message ?? "Falha ao gerar sugestões.");
      return;
    }
    if (!res?.data) {
      toast.error("A IA não retornou dados.");
      return;
    }
    setResult(res.data as AdsResponse);
    toast.success("Sugestões de ads geradas.");
  };

  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="space-y-3 border-b">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-primary-foreground">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Sugestões de Públicos & Criativos para Ads</h3>
              <p className="text-xs text-muted-foreground">
                A IA usa o Avatar e o Mapa da Empatia para gerar segmentações e ângulos prontos para teste.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={generate} disabled={loading} className="shrink-0">
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : result ? (
              <RefreshCw className="mr-2 h-4 w-4" />
            ) : (
              <Megaphone className="mr-2 h-4 w-4" />
            )}
            {result ? "Regenerar" : "Gerar sugestões"}
          </Button>
        </div>
      </CardHeader>

      {result && (
        <CardContent className="pt-5">
          <Tabs defaultValue="publicos">
            <TabsList className="mb-4">
              <TabsTrigger value="publicos">
                <Target className="mr-1.5 h-4 w-4" />
                Públicos ({result.publicos?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="criativos">
                <Megaphone className="mr-1.5 h-4 w-4" />
                Criativos ({result.criativos?.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="publicos" className="space-y-3">
              {result.publicos?.map((p, i) => {
                const text = `${p.nome} [${p.plataforma} • ${p.tipo}]\nSegmentação: ${p.segmentacao}\nPor quê: ${p.justificativa}`;
                const key = `pub-${i}`;
                return (
                  <div key={key} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{p.nome}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{p.plataforma}</Badge>
                          <Badge variant="outline">{p.tipo}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copy(key, text)}>
                        {copiedKey === key ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="mt-3 text-sm"><strong>Segmentação:</strong> {p.segmentacao}</p>
                    <p className="mt-1 text-sm text-muted-foreground"><strong>Por quê:</strong> {p.justificativa}</p>
                  </div>
                );
              })}
            </TabsContent>

            <TabsContent value="criativos" className="space-y-3">
              {result.criativos?.map((c, i) => {
                const text = `[${c.angulo} • ${c.formato}] alvo: ${c.dorOuDesejo}\nHOOK: ${c.hook}\nROTEIRO: ${c.roteiro}\nCTA: ${c.cta}`;
                const key = `cre-${i}`;
                return (
                  <div key={key} className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-semibold">{c.angulo}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary">{c.formato}</Badge>
                          <Badge variant="outline">{c.dorOuDesejo}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => copy(key, text)}>
                        {copiedKey === key ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2 text-sm">
                      <p><strong className="text-primary">Hook:</strong> {c.hook}</p>
                      <p className="whitespace-pre-line"><strong>Roteiro:</strong> {c.roteiro}</p>
                      <p><strong>CTA:</strong> {c.cta}</p>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>

          {result.observacoes && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary-soft/30 p-3 text-sm">
              <p className="font-semibold text-primary">Observações</p>
              <p className="mt-1 whitespace-pre-line text-foreground/80">{result.observacoes}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};
