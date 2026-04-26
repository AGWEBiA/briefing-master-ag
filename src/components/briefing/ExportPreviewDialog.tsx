import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Download, FileText, FileType, Loader2, Eye, Monitor, FileStack } from "lucide-react";
import {
  exportBriefingMarkdown,
  exportBriefingDocx,
  exportBriefingPdf,
  buildBriefingHtml,
  downloadMarkdown,
  type ExportFormat,
} from "@/lib/exportBriefing";

type DocLayout = "a4" | "responsive";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: Record<string, string>;
  strategyId?: string | null;
  initialFormat?: ExportFormat;
};

function triggerDownloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportPreviewDialog({
  open, onOpenChange, data, strategyId, initialFormat = "pdf",
}: Props) {
  const [tab, setTab] = useState<ExportFormat>(initialFormat);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docHtml, setDocHtml] = useState<string>("");
  const [mdContent, setMdContent] = useState<string>("");
  const [docLayout, setDocLayout] = useState<DocLayout>("a4");
  const [docHeight, setDocHeight] = useState<number>(1200);
  const docIframeRef = useRef<HTMLIFrameElement>(null);

  // Reset on open / data change
  useEffect(() => {
    if (!open) return;
    setTab(initialFormat);
  }, [open, initialFormat]);

  // Generate previews when dialog opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    setPdfLoading(true);
    try {
      // PDF blob (jspdf é síncrono mas pode ser pesado)
      const { blob } = exportBriefingPdf(data, strategyId);
      const url = URL.createObjectURL(blob);
      createdUrl = url;
      if (!cancelled) setPdfUrl(url);

      // DOC HTML para preview visual
      setDocHtml(buildBriefingHtml(data, strategyId));

      // Markdown
      const { content } = exportBriefingMarkdown(data, strategyId);
      setMdContent(content);
    } finally {
      if (!cancelled) setPdfLoading(false);
    }

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
      setPdfUrl(null);
    };
  }, [open, data, strategyId]);

  const handleDownload = () => {
    if (tab === "pdf") {
      const { filename, blob } = exportBriefingPdf(data, strategyId);
      triggerDownloadBlob(filename, blob);
    } else if (tab === "doc") {
      const { filename, blob } = exportBriefingDocx(data, strategyId);
      triggerDownloadBlob(filename, blob);
    } else {
      const { filename, content } = exportBriefingMarkdown(data, strategyId);
      downloadMarkdown(filename, content);
    }
  };

  // Renderiza markdown como HTML simples (cabeçalhos, listas, tabelas, blockquote)
  const mdAsHtml = useMemo(() => renderMarkdownLite(mdContent), [mdContent]);

  // Injeta CSS adicional no HTML do Word para a pré-visualização (modo A4 vs responsivo)
  const docPreviewSrc = useMemo(() => {
    if (!docHtml) return "";
    const extra = docLayout === "a4"
      ? `
        <style>
          html, body { background: #f3f4f6; }
          body { margin: 0; padding: 0; }
          /* Cada elemento marcado como page-break vira "fim de página" visual */
          .cover, .toc { box-shadow: 0 2px 8px rgba(0,0,0,0.08); margin: 0 auto 20px; background: #fff; padding: 40pt 36pt; max-width: 21cm; min-height: 29.7cm; box-sizing: border-box; position: relative; }
          .cover::after, .toc::after {
            content: "— quebra de página —"; position: absolute; bottom: -18px; left: 0; right: 0;
            text-align: center; font-size: 10px; color: #9ca3af; letter-spacing: 2px; text-transform: uppercase;
          }
          .block {
            background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            margin: 0 auto 20px; padding: 36pt 36pt 40pt; max-width: 21cm;
            box-sizing: border-box; page-break-inside: avoid;
          }
        </style>
      `
      : `
        <style>
          html, body { background: #fff; }
          body { margin: 0; padding: 16px 20px; }
          .cover, .toc, .block { max-width: 100%; padding: 16px 0; }
          .cover { page-break-after: auto !important; border-bottom: 2px dashed #e5e7eb; padding-bottom: 28px; margin-bottom: 28px; }
          .toc { border-bottom: 1px dashed #e5e7eb; padding-bottom: 16px; margin-bottom: 16px; }
        </style>
      `;
    return docHtml.replace("</head>", `${extra}</head>`);
  }, [docHtml, docLayout]);

  // Auto-ajusta a altura do iframe ao conteúdo
  const handleIframeLoad = () => {
    const iframe = docIframeRef.current;
    if (!iframe || !iframe.contentDocument) return;
    const h = iframe.contentDocument.documentElement.scrollHeight;
    setDocHeight(Math.max(800, h + 40));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl p-0 gap-0 h-[90vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Pré-visualização do briefing exportado
          </DialogTitle>
          <DialogDescription>
            Veja exatamente como o arquivo ficará — com as mesmas quebras de página e estilos — antes de baixar.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as ExportFormat)} className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-6 pt-4 pb-2 gap-3 flex-wrap">
            <TabsList>
              <TabsTrigger value="pdf"><FileType className="mr-2 h-4 w-4" />PDF</TabsTrigger>
              <TabsTrigger value="doc"><FileText className="mr-2 h-4 w-4" />Word</TabsTrigger>
              <TabsTrigger value="md"><FileText className="mr-2 h-4 w-4" />Markdown</TabsTrigger>
            </TabsList>
            <Button onClick={handleDownload} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Baixar {tab.toUpperCase()}
            </Button>
          </div>

          <div className="flex-1 min-h-0 bg-muted/40">
            {/* PDF */}
            <TabsContent value="pdf" className="h-full m-0 data-[state=inactive]:hidden">
              {pdfLoading || !pdfUrl ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Renderizando PDF...
                </div>
              ) : (
                <iframe
                  src={pdfUrl}
                  title="Pré-visualização PDF"
                  className="w-full h-full border-0"
                />
              )}
            </TabsContent>

            {/* DOC — renderiza o HTML em uma "página A4" simulada */}
            <TabsContent value="doc" className="h-full m-0 data-[state=inactive]:hidden">
              <ScrollArea className="h-full">
                <div className="mx-auto my-6 max-w-[820px] px-4">
                  <div className="bg-white text-foreground shadow-elevated rounded-md overflow-hidden">
                    {/* Aplicamos o HTML completo do export — o iframe isolado evita conflito de CSS */}
                    <iframe
                      title="Pré-visualização Word"
                      srcDoc={docHtml}
                      className="w-full border-0"
                      style={{ height: "1200px" }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    O arquivo .doc abre no Word/Google Docs respeitando as mesmas quebras de página exibidas acima.
                  </p>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Markdown — preview renderizado + código fonte lado a lado */}
            <TabsContent value="md" className="h-full m-0 data-[state=inactive]:hidden">
              <div className="grid h-full grid-cols-1 lg:grid-cols-2 gap-0">
                <div className="border-r bg-background">
                  <div className="px-4 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Pré-visualização
                  </div>
                  <ScrollArea className="h-[calc(100%-37px)]">
                    <div
                      className="prose prose-sm max-w-none px-6 py-5 markdown-preview"
                      dangerouslySetInnerHTML={{ __html: mdAsHtml }}
                    />
                  </ScrollArea>
                </div>
                <div className="bg-muted/30">
                  <div className="px-4 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Código fonte (.md)
                  </div>
                  <ScrollArea className="h-[calc(100%-37px)]">
                    <pre className="px-4 py-3 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                      {mdContent}
                    </pre>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────
// Renderizador de Markdown leve (sem dependência externa)
// Suporta: H1-H4, blockquote, listas, tabelas, **bold**, *italic*, `code`, ---
// ────────────────────────────────────────────────
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inline(s: string) {
  // primeiro escapamos tags HTML que NÃO sejam o <div align="center"> usado nas capas
  // mantemos tags simples passando direto se forem do nosso template
  return s
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
}

function renderMarkdownLite(md: string): string {
  if (!md) return "";
  const lines = md.split("\n");
  const out: string[] = [];
  let i = 0;
  let inList = false;
  let inOrdered = false;

  const closeLists = () => {
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOrdered) { out.push("</ol>"); inOrdered = false; }
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Bloco HTML cru (capa centralizada do export)
    if (line.startsWith("<div") || line.startsWith("</div>")) {
      closeLists();
      out.push(line);
      i++;
      continue;
    }

    if (line.trim() === "") { closeLists(); out.push(""); i++; continue; }
    if (line.trim() === "---") { closeLists(); out.push('<hr class="my-6 border-border" />'); i++; continue; }

    // Headings
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeLists();
      const lvl = h[1].length;
      const sizes = ["text-3xl", "text-2xl", "text-xl", "text-lg", "text-base", "text-sm"];
      out.push(`<h${lvl} class="font-bold ${sizes[lvl - 1]} mt-4 mb-2">${inline(escapeHtml(h[2]))}</h${lvl}>`);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      closeLists();
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote class="border-l-4 border-primary bg-primary/5 px-4 py-2 my-3 italic">${inline(escapeHtml(buf.join("\n"))).replace(/\n/g, "<br/>")}</blockquote>`);
      continue;
    }

    // Tabela
    if (line.startsWith("|") && i + 1 < lines.length && /^\|[\s\-:|]+\|/.test(lines[i + 1])) {
      closeLists();
      const header = line.split("|").slice(1, -1).map((c) => c.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        rows.push(lines[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      out.push(`<div class="my-3 overflow-x-auto"><table class="w-full text-sm border-collapse"><thead><tr>${header.map((c) => `<th class="border border-border bg-muted px-3 py-2 text-left font-semibold">${inline(escapeHtml(c))}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td class="border border-border px-3 py-2 align-top">${inline(escapeHtml(c))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }

    // Lista ordenada
    if (/^\d+\.\s+/.test(line)) {
      if (!inOrdered) { closeLists(); out.push('<ol class="list-decimal pl-6 space-y-1 my-2">'); inOrdered = true; }
      out.push(`<li>${inline(escapeHtml(line.replace(/^\d+\.\s+/, "")))}</li>`);
      i++; continue;
    }

    // Lista não-ordenada
    if (/^[-*]\s+/.test(line)) {
      if (!inList) { closeLists(); out.push('<ul class="list-disc pl-6 space-y-1 my-2">'); inList = true; }
      out.push(`<li>${inline(escapeHtml(line.replace(/^[-*]\s+/, "")))}</li>`);
      i++; continue;
    }

    // Parágrafo padrão
    closeLists();
    out.push(`<p class="my-2 leading-relaxed">${inline(escapeHtml(line))}</p>`);
    i++;
  }
  closeLists();
  return out.join("\n");
}
