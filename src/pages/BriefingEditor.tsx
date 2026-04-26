import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ChevronLeft, ChevronRight, Download, FileText, FileType, Loader2,
  RefreshCw, Rocket, Save, Sparkles, Wand2, ClipboardCheck, AlertTriangle,
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
import { EmpathyMapPreview } from "@/components/briefing/EmpathyMapPreview";
import {
  FIXED_SECTIONS, getStrategy, type Section, type StrategyId,
} from "@/lib/briefingSchema";
import { exportBriefing, downloadMarkdown, type ExportFormat } from "@/lib/exportBriefing";
import { buildReportMarkdown, validateEmpathyMap } from "@/lib/briefingReport";

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
  const [exporting, setExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | "report" | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [highlightFields, setHighlightFields] = useState<Set<string>>(new Set());
  const [showEmpathyErrors, setShowEmpathyErrors] = useState(false);

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

  useEffect(() => {
    if (currentIndex >= sections.length) setCurrentIndex(sections.length - 1);
  }, [sections.length, currentIndex]);

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

  const updateField = (fid: string, value: string) => {
    setData((d) => ({ ...d, [fid]: value }));
    if (highlightFields.has(fid)) {
      setHighlightFields((prev) => {
        const next = new Set(prev);
        next.delete(fid);
        return next;
      });
    }
  };

  const section = sections[currentIndex];
  const isLast = currentIndex === sections.length - 1;
  const isFirst = currentIndex === 0;

  const empathyValidation = useMemo(() => validateEmpathyMap(data), [data]);
  const empathyErrorMap = useMemo(() => {
    if (!showEmpathyErrors) return {} as Record<string, string>;
    return empathyValidation.errors.reduce<Record<string, string>>((acc, e) => {
      acc[e.field] = `Mínimo ${e.min} itens (atual: ${e.current}). Separe por vírgula ou nova linha.`;
      return acc;
    }, {});
  }, [empathyValidation, showEmpathyErrors]);

  const handleExport = async (format: ExportFormat = "md") => {
    setExporting(true);
    setExportingFormat(format);
    try {
      // Pequeno delay para o spinner aparecer mesmo em export muito rápido
      await new Promise((r) => setTimeout(r, 50));
      const filename = exportBriefing(format, data, strategyId);
      toast.success(`Briefing exportado: ${filename}`);
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`);
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  const handleGenerateReport = async () => {
    setExporting(true);
    setExportingFormat("report");
    try {
      await new Promise((r) => setTimeout(r, 50));
      const { filename, content } = buildReportMarkdown(data, strategyId);
      downloadMarkdown(filename, content);
      toast.success(`Relatório gerado: ${filename}`);
    } catch (e) {
      toast.error(`Falha ao gerar relatório: ${(e as Error).message}`);
    } finally {
      setExporting(false);
      setExportingFormat(null);
    }
  };

  const handleFinalize = async () => {
    if (!id) return;
    if (!empathyValidation.ok) {
      setShowEmpathyErrors(true);
      const idx = sections.findIndex((s) => s.id === "mapaEmpatia");
      if (idx >= 0) setCurrentIndex(idx);
      toast.error(`Mapa da Empatia incompleto: ${empathyValidation.errors.length} quadrante(s) abaixo do mínimo.`);
      return;
    }
    await supabase.from("briefings").update({ is_complete: true }).eq("id", id);
    await handleExport("pdf");
  };

  const handleReset = async () => {
    if (!confirm("Reiniciar este briefing? Todos os campos serão limpos.")) return;
    setData({});
    setStrategyId(null);
    setCurrentIndex(0);
    setVisited(new Set());
    setHighlightFields(new Set());
    setShowEmpathyErrors(false);
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
    const incoming = res.data as Record<string, string>;
    // marca como sobrescrito apenas o que veio com valor não-vazio
    const overwritten = new Set<string>();
    Object.entries(incoming).forEach(([k, v]) => {
      if ((v ?? "").trim().length > 0) overwritten.add(k);
    });
    setData((prev) => ({ ...prev, ...incoming }));
    setHighlightFields(overwritten);
    toast.success(`Cliente Ideal sugerido — ${overwritten.size} campo(s) preenchido(s)/sobrescrito(s).`);
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

  const ExportDropdown = ({ size = "sm" as const, variant = "outline" as const, fullWidth = false }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={exporting} className={fullWidth ? "flex-1" : undefined}>
          {exporting && exportingFormat !== "report" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {exporting && exportingFormat !== "report"
            ? `Exportando ${exportingFormat?.toUpperCase()}...`
            : "Exportar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")} disabled={exporting}>
          <FileType className="mr-2 h-4 w-4" /> PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("doc")} disabled={exporting}>
          <FileText className="mr-2 h-4 w-4" /> Word (.doc)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("md")} disabled={exporting}>
          <FileText className="mr-2 h-4 w-4" /> Markdown (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const ReportButton = ({ size = "sm" as const, variant = "outline" as const }) => (
    <Button variant={variant} size={size} onClick={handleGenerateReport} disabled={exporting}>
      {exporting && exportingFormat === "report" ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <ClipboardCheck className="mr-2 h-4 w-4" />
      )}
      Gerar relatório
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader>
        <div className="hidden items-center gap-2 md:flex">
          <ReverseEngineerDialog onApply={handleReverseEngineerApply} />
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
          </Button>
          <ReportButton />
          <ExportDropdown />
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

              {/* CTA contextual no Avatar */}
              {section.id === "avatar" && (
                <div className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-primary-soft/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-sm">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span>
                      Use a IA para sugerir um Cliente Ideal a partir do Produto, Nicho e Transformação já preenchidos.
                      Os campos sobrescritos ficarão destacados.
                    </span>
                  </div>
                  <Button size="sm" onClick={handleSuggestICP} disabled={suggesting} className="shrink-0">
                    {suggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Sugerir Cliente Ideal
                  </Button>
                </div>
              )}

              {/* Status do Mapa da Empatia */}
              {section.id === "mapaEmpatia" && !empathyValidation.ok && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <div>
                    <p className="font-medium">
                      Mapa da Empatia incompleto — {empathyValidation.errors.length} quadrante(s) abaixo do mínimo.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Cada quadrante exige itens concretos (separe por vírgula ou nova linha). Mínimo: VÊ/OUVE/PENSA-SENTE/FALA-FAZ ≥ 3, DORES/GANHOS ≥ 4.
                    </p>
                  </div>
                </div>
              )}
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
                            allData={data}
                            highlighted={highlightFields.has(f.id)}
                            error={empathyErrorMap[f.id]}
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
                onClick={handleFinalize} disabled={exporting}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Finalizar e Exportar
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
            <ReportButton />
            <ExportDropdown />
          </div>
        </main>
      </div>
    </div>
  );
};

export default BriefingEditor;
