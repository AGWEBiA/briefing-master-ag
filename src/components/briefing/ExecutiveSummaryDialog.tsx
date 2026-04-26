import { useMemo, useState } from "react";
import { Check, Copy, Download, FileText, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { buildExecutiveSummary } from "@/lib/executiveSummary";
import { downloadMarkdown } from "@/lib/exportBriefing";
import type { StrategyId } from "@/lib/briefingSchema";

interface Props {
  data: Record<string, string>;
  strategyId: StrategyId | null;
  trigger?: React.ReactNode;
}

// Render mínimo de Markdown -> HTML para a aba "Pré-visualização"
const renderMarkdown = (md: string): string => {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const inline = (s: string) =>
    escape(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
      .replace(/_([^_\n]+)_/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");

  const lines = md.split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => {
    if (inList) { out.push("</ul>"); inList = false; }
  };

  lines.forEach((raw) => {
    const l = raw.trimEnd();
    if (l.startsWith("# ")) { closeList(); out.push(`<h2 class="text-xl font-bold mt-4 mb-2">${inline(l.slice(2))}</h2>`); return; }
    if (l.startsWith("## ")) { closeList(); out.push(`<h3 class="text-lg font-semibold mt-4 mb-1.5 text-primary">${inline(l.slice(3))}</h3>`); return; }
    if (l.startsWith("### ")) { closeList(); out.push(`<h4 class="text-sm font-semibold uppercase tracking-wide mt-3 mb-1 text-foreground/70">${inline(l.slice(4))}</h4>`); return; }
    if (l.startsWith("> ")) { closeList(); out.push(`<blockquote class="border-l-4 border-primary/40 bg-primary-soft/30 px-3 py-2 my-2 italic">${inline(l.slice(2))}</blockquote>`); return; }
    if (l.startsWith("- ")) {
      if (!inList) { out.push(`<ul class="list-disc pl-6 space-y-1 my-1">`); inList = true; }
      out.push(`<li>${inline(l.slice(2))}</li>`);
      return;
    }
    if (l === "---") { closeList(); out.push(`<hr class="my-3 border-border" />`); return; }
    if (l === "") { closeList(); out.push(""); return; }
    closeList();
    out.push(`<p class="my-1 leading-relaxed">${inline(l)}</p>`);
  });
  closeList();
  return out.join("\n");
};

export const ExecutiveSummaryDialog = ({ data, strategyId, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const summary = useMemo(
    () => buildExecutiveSummary(data, { strategyId }),
    [data, strategyId],
  );

  const html = useMemo(() => renderMarkdown(summary), [summary]);

  const productSlug = (data.nomeProduto || "produto")
    .toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "produto";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success("Resumo copiado para a área de transferência.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar — selecione e copie manualmente.");
    }
  };

  const handleDownload = () => {
    downloadMarkdown(`resumo-executivo-${productSlug}.md`, summary);
    toast.success("Resumo baixado em Markdown.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" /> Resumo executivo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Resumo Executivo do Briefing
          </DialogTitle>
          <DialogDescription>
            Síntese pronta para copiar/colar em apresentações, Notion, Slack ou e-mail. Inclui Big Idea, Tom de Voz, Anti-comunicação e Mapa de Riscos.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList>
            <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
            <TabsTrigger value="markdown">Markdown</TabsTrigger>
          </TabsList>

          <TabsContent value="preview">
            <div
              className="max-h-[55vh] overflow-y-auto rounded-md border bg-card p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </TabsContent>

          <TabsContent value="markdown">
            <Textarea
              readOnly
              value={summary}
              className="max-h-[55vh] min-h-[300px] font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleDownload}>
            <Download className="mr-2 h-4 w-4" /> Baixar .md
          </Button>
          <Button onClick={handleCopy}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copiado!" : "Copiar resumo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExecutiveSummaryDialog;
