import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, FileType, Loader2,
  RefreshCw, Rocket, Save, Sparkles, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Menu } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { BriefingSidebar } from "@/components/briefing/BriefingSidebar";
import { FieldRenderer } from "@/components/briefing/FieldRenderer";
import { StrategyPicker } from "@/components/briefing/StrategyPicker";
import { ReverseEngineerDialog } from "@/components/briefing/ReverseEngineerDialog";
import {
  FIXED_SECTIONS, getStrategy, type Section, type StrategyId,
} from "@/lib/briefingSchema";
import { exportBriefing, type ExportFormat } from "@/lib/exportBriefing";

type Data = Record<string, string>;

const BriefingEditor = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("Novo briefing");
  const [strategyId, setStrategyId] = useState<StrategyId | null>(null);
  const [data, setData] = useState<Data>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);

  const skipNextSave = useRef(true);

  // Load
  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: row, error } = await supabase
        .from("briefings").select("*").eq("id", id).maybeSingle();
      if (error || !row) { toast.error("Briefing não encontrado"); navigate("/dashboard"); return; }
      setTitle(row.title);
      setStrategyId((row.strategy as StrategyId) ?? null);
      setData((row.data as Data) ?? {});
      setLoading(false);
    })();
  }, [id, user, navigate]);

  const strat = getStrategy(strategyId);
  const sections: Section[] = useMemo(
    () => (strat ? [...FIXED_SECTIONS, ...strat.sections] : FIXED_SECTIONS),
    [strat],
  );

  // Clamp index when sections list shrinks
  useEffect(() => {
    if (currentIndex >= sections.length) setCurrentIndex(sections.length - 1);
  }, [sections.length, currentIndex]);

  // Mark current as visited
  useEffect(() => {
    if (loading) return;
    const sec = sections[currentIndex];
    if (!sec) return;
    setVisited((prev) => prev.has(sec.id) ? prev : new Set(prev).add(sec.id));
  }, [currentIndex, sections, loading]);

  // Auto-save (debounced)
  useEffect(() => {
    if (loading || !id) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    const t = setTimeout(async () => {
      setSaving(true);
      const computedTitle = (data.nomeProduto || title || "Novo briefing").slice(0, 120);
      await supabase.from("briefings").update({
        title: computedTitle,
        strategy: strategyId,
        data,
      }).eq("id", id);
      setTitle(computedTitle);
      setSaving(false);
    }, 800);
    return () => clearTimeout(t);
  }, [data, strategyId, id, loading]); // eslint-disable-line

  const updateField = (fid: string, value: string) =>
    setData((d) => ({ ...d, [fid]: value }));

  const section = sections[currentIndex];
  const isLast = currentIndex === sections.length - 1;
  const isFirst = currentIndex === 0;

  const [exporting, setExporting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  const handleExport = (format: ExportFormat = "md") => {
    setExporting(true);
    try {
      const filename = exportBriefing(format, data, strategyId);
      toast.success(`Briefing exportado: ${filename}`);
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleFinalize = async () => {
    if (!id) return;
    await supabase.from("briefings").update({ is_complete: true }).eq("id", id);
    handleExport("pdf");
  };

  const handleReset = async () => {
    if (!confirm("Reiniciar este briefing? Todos os campos serão limpos.")) return;
    setData({});
    setStrategyId(null);
    setCurrentIndex(0);
    setVisited(new Set());
    toast.success("Formulário reiniciado.");
  };

  const handleReverseEngineerApply = (incoming: Record<string, string>) => {
    setData({ ...incoming });
    setCurrentIndex(0);
    setVisited(new Set());
  };

  const handleSuggestICP = async () => {
    if (!data.nomeProduto && !data.nicho && !data.transformacaoPrincipal) {
      toast.error("Preencha pelo menos nome, nicho ou transformação antes de pedir o ICP.");
      return;
    }
    setSuggesting(true);
    const { data: res, error } = await supabase.functions.invoke("suggest-icp", {
      body: { briefing: data },
    });
    setSuggesting(false);
    if (error || res?.error) {
      toast.error(res?.error ?? (error as { message?: string })?.message ?? "Falha ao sugerir ICP.");
      return;
    }
    if (!res?.data || Object.keys(res.data).length === 0) {
      toast.error("A IA não retornou dados de ICP.");
      return;
    }
    setData((prev) => ({ ...prev, ...(res.data as Record<string, string>) }));
    toast.success("Cliente Ideal sugerido — campos do Avatar e Mapa da Empatia preenchidos.");
    const idx = sections.findIndex((s) => s.id === "avatar");
    if (idx >= 0) setCurrentIndex(idx);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const SectionIcon = section.icon;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="hidden items-center gap-2 md:flex">
          <ReverseEngineerDialog onApply={handleReverseEngineerApply} />
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                <Download className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("pdf")}>
                <FileType className="mr-2 h-4 w-4" /> PDF (.pdf)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("doc")}>
                <FileText className="mr-2 h-4 w-4" /> Word (.doc)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("md")}>
                <FileText className="mr-2 h-4 w-4" /> Markdown (.md)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </AppHeader>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6">
        {/* Mobile sidebar trigger */}
        <div className="flex items-center justify-between md:hidden">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
          </Button>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"><Menu className="mr-2 h-4 w-4" />Seções</Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80">
              <div className="mt-6">
                <BriefingSidebar
                  strategyId={strategyId} data={data} visited={visited}
                  currentIndex={currentIndex}
                  onJump={(i) => { setCurrentIndex(i); setSheetOpen(false); }}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden md:block md:w-72 md:shrink-0">
          <div className="sticky top-20 space-y-4">
            <Button variant="ghost" size="sm" asChild className="w-full justify-start -ml-2">
              <Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Meus briefings</Link>
            </Button>
            <Card>
              <CardContent className="pt-5">
                <BriefingSidebar
                  strategyId={strategyId} data={data} visited={visited}
                  currentIndex={currentIndex} onJump={setCurrentIndex}
                />
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 space-y-4">
          {/* Title bar */}
          <div className="flex items-center gap-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={async () => {
                if (!id) return;
                await supabase.from("briefings").update({ title: title.slice(0, 120) }).eq("id", id);
              }}
              className="h-9 max-w-md text-base font-semibold"
              placeholder="Título do briefing"
            />
            <span className="text-xs text-muted-foreground">
              {saving ? <span className="flex items-center gap-1"><Save className="h-3 w-3 animate-pulse" /> Salvando...</span> : "Salvo"}
            </span>
          </div>

          <Card key={section.id} className="animate-fade-in shadow-card">
            <CardHeader className="space-y-3 border-b">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-elevated">
                  <SectionIcon className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Seção {currentIndex + 1} de {sections.length}
                  </p>
                  <h2 className="mt-1 text-xl font-bold md:text-2xl">{section.title}</h2>
                </div>
                {strat && currentIndex >= FIXED_SECTIONS.length && (
                  <Badge variant="secondary">{strat.emoji} {strat.name}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              {/* Strategy picker injected at the top of section "estrategia" */}
              {section.id === "estrategia" && (
                <>
                  <StrategyPicker
                    selected={strategyId}
                    onSelect={(s) => {
                      setStrategyId(s);
                      toast.success("Estratégia selecionada — novas seções adicionadas.");
                    }}
                  />
                  <div className="border-t" />
                </>
              )}

              {section.groups.map((g, gi) => (
                <div key={gi} className="space-y-4">
                  {g.label && (
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        {g.label}
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    {g.fields?.map((f) => {
                      const fullWidth = f.type === "textarea" || f.type === "radio";
                      return (
                        <div key={f.id} className={fullWidth ? "md:col-span-2" : undefined}>
                          <FieldRenderer
                            field={f}
                            value={data[f.id] ?? ""}
                            onChange={(v) => updateField(f.id, v)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between gap-3">
            <Button variant="outline" disabled={isFirst}
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
            </Button>
            {isLast ? (
              <Button className="bg-success text-success-foreground hover:bg-success/90"
                onClick={handleFinalize}>
                <Download className="mr-2 h-4 w-4" /> Finalizar e Exportar
              </Button>
            ) : (
              <Button onClick={() => setCurrentIndex((i) => Math.min(sections.length - 1, i + 1))}>
                Próxima <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>

          <Card className="border-primary/20 bg-primary-soft/40">
            <CardContent className="flex items-start gap-3 py-4">
              <Rocket className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm text-foreground/80">
                Dica: o briefing é salvo automaticamente. Você pode voltar a qualquer momento e continuar de onde parou.
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-wrap gap-2 md:hidden">
            <ReverseEngineerDialog
              onApply={handleReverseEngineerApply}
              trigger={
                <Button size="sm" className="gap-2">
                  <Wand2 className="h-4 w-4" /> Engenharia Reversa
                </Button>
              }
            />
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
              <Download className="mr-2 h-4 w-4" /> Exportar
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default BriefingEditor;
