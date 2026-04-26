import { jsPDF } from "jspdf";
import { FIXED_SECTIONS, getStrategy, type Section } from "./briefingSchema";

const NA = "_Não preenchido_";
const v = (data: Record<string, string>, id: string) => {
  const val = (data[id] ?? "").trim();
  return val.length ? val : NA;
};

const tableRows = (data: Record<string, string>, ids: [string, string][]) =>
  ids.map(([id, label]) => `| ${label} | ${v(data, id)} |`).join("\n");

const sectionTable = (data: Record<string, string>, section: Section) => {
  const fields = section.groups.flatMap((g) => g.fields ?? []);
  const rows = fields.map((f) => [f.id, f.label] as [string, string]);
  return `| Campo | Valor |\n|---|---|\n${tableRows(data, rows)}`;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const baseFilename = (data: Record<string, string>, strategyId?: string | null) => {
  const nome = (data.nomeProduto || "sem-nome").trim();
  const stratSlug = (strategyId ?? "sem-estrategia");
  const slug = slugify(nome);
  return `briefing-${slug || "produto"}-${stratSlug}`;
};

// ============================================================
// MARKDOWN
// ============================================================
export function exportBriefingMarkdown(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; content: string } {
  const strat = getStrategy(strategyId);
  const filename = `${baseFilename(data, strategyId)}.md`;
  const now = new Date().toLocaleString("pt-BR");

  const blocks: string[] = [];
  blocks.push(`# Briefing Universal de Produto — ${data.nomeProduto || "(sem nome)"}`);
  blocks.push(
    `**Estratégia:** ${strat ? `${strat.emoji} ${strat.name}` : "_Não selecionada_"}  \n` +
    `**Gerado em:** ${now}`,
  );

  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  FIXED_SECTIONS.forEach((s, i) => {
    blocks.push(`## BLOCO ${blockLetters[i] ?? `${i + 1}`} — ${s.title}`);
    if (s.id === "avatar") {
      blocks.push(`**Descrição do Avatar:**\n\n${v(data, "descricaoAvatar")}`);
      blocks.push(`**Dores:**\n1. ${v(data, "dor1")}\n2. ${v(data, "dor2")}\n3. ${v(data, "dor3")}`);
      blocks.push(`**Desejos:**\n1. ${v(data, "desejo1")}\n2. ${v(data, "desejo2")}\n3. ${v(data, "desejo3")}`);
      blocks.push(`**Objeções:**\n1. ${v(data, "objecao1")}\n2. ${v(data, "objecao2")}\n3. ${v(data, "objecao3")}`);
      blocks.push(
        `| Campo | Valor |\n|---|---|\n` +
        `| Nível de Consciência | ${v(data, "nivelConsciencia")} |\n` +
        `| Canais Online | ${v(data, "canaisOnline")} |\n` +
        `| Resumo do Mapa da Empatia | ${v(data, "empatiaResumo")} |`,
      );
    } else if (s.id === "mapaEmpatia") {
      blocks.push(
        `| Quadrante | Conteúdo |\n|---|---|\n` +
        `| 🧠 O que pensa e sente | ${v(data, "me_pensaSente")} |\n` +
        `| 👀 O que vê | ${v(data, "me_ve")} |\n` +
        `| 👂 O que ouve | ${v(data, "me_ouve")} |\n` +
        `| 💬 O que fala e faz | ${v(data, "me_falaFaz")} |\n` +
        `| 😣 Dores | ${v(data, "me_dores")} |\n` +
        `| 🏆 Ganhos | ${v(data, "me_ganhos")} |`,
      );
    } else {
      blocks.push(sectionTable(data, s));
    }
  });

  if (strat) {
    blocks.push(`## ${strat.emoji} ${strat.name.toUpperCase()} — Detalhamento`);
    strat.sections.forEach((s) => {
      blocks.push(`### ${s.title}`);
      blocks.push(sectionTable(data, s));
    });
  }

  return { filename, content: blocks.join("\n\n") + "\n" };
}

// ============================================================
// HTML (base para DOCX e PDF)
// ============================================================
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fieldRowsHtml = (data: Record<string, string>, rows: [string, string][]) =>
  rows
    .map(
      ([id, label]) => {
        const val = (data[id] ?? "").trim();
        const display = val ? escapeHtml(val).replace(/\n/g, "<br>") : `<em style="color:#888">Não preenchido</em>`;
        return `<tr><th>${escapeHtml(label)}</th><td>${display}</td></tr>`;
      },
    )
    .join("");

const sectionTableHtml = (data: Record<string, string>, section: Section) => {
  const fields = section.groups.flatMap((g) => g.fields ?? []);
  const rows = fields.map((f) => [f.id, f.label] as [string, string]);
  return `<table>${fieldRowsHtml(data, rows)}</table>`;
};

function buildBriefingHtml(
  data: Record<string, string>,
  strategyId?: string | null,
): string {
  const strat = getStrategy(strategyId);
  const now = new Date().toLocaleString("pt-BR");
  const title = data.nomeProduto || "(sem nome)";

  const styles = `
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; line-height: 1.5; }
    h1 { font-size: 22pt; margin: 0 0 4pt; color: #1f2937; }
    h2 { font-size: 14pt; margin: 18pt 0 6pt; color: #1f2937; border-bottom: 1.5pt solid #e5e7eb; padding-bottom: 3pt; }
    h3 { font-size: 12pt; margin: 12pt 0 4pt; color: #374151; }
    .meta { color: #6b7280; font-size: 10pt; margin-bottom: 14pt; }
    table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 10pt; }
    th, td { border: 0.5pt solid #d1d5db; padding: 5pt 8pt; vertical-align: top; text-align: left; }
    th { background: #f3f4f6; width: 28%; font-weight: 600; }
    .quad { display: table; width: 100%; }
    .quad th { background: #eef2ff; }
    ol { margin: 4pt 0 8pt 18pt; padding: 0; }
    p { margin: 4pt 0; }
  `;

  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  const blocks: string[] = [];

  FIXED_SECTIONS.forEach((s, i) => {
    blocks.push(`<h2>BLOCO ${blockLetters[i] ?? `${i + 1}`} — ${escapeHtml(s.title)}</h2>`);
    if (s.id === "avatar") {
      const desc = (data.descricaoAvatar ?? "").trim();
      blocks.push(`<p><strong>Descrição do Avatar:</strong><br>${desc ? escapeHtml(desc).replace(/\n/g, "<br>") : "<em>Não preenchido</em>"}</p>`);
      const list = (label: string, ids: string[]) =>
        `<p><strong>${label}:</strong></p><ol>${ids.map((id) => `<li>${escapeHtml((data[id] ?? "").trim() || "—")}</li>`).join("")}</ol>`;
      blocks.push(list("Dores", ["dor1", "dor2", "dor3"]));
      blocks.push(list("Desejos", ["desejo1", "desejo2", "desejo3"]));
      blocks.push(list("Objeções", ["objecao1", "objecao2", "objecao3"]));
      blocks.push(
        `<table>${fieldRowsHtml(data, [
          ["nivelConsciencia", "Nível de Consciência"],
          ["canaisOnline", "Canais Online"],
          ["empatiaResumo", "Resumo do Mapa da Empatia"],
        ])}</table>`,
      );
    } else if (s.id === "mapaEmpatia") {
      blocks.push(
        `<table class="quad">${fieldRowsHtml(data, [
          ["me_pensaSente", "🧠 O que pensa e sente"],
          ["me_ve", "👀 O que vê"],
          ["me_ouve", "👂 O que ouve"],
          ["me_falaFaz", "💬 O que fala e faz"],
          ["me_dores", "😣 Dores"],
          ["me_ganhos", "🏆 Ganhos"],
        ])}</table>`,
      );
    } else {
      blocks.push(sectionTableHtml(data, s));
    }
  });

  if (strat) {
    blocks.push(`<h2>${escapeHtml(strat.emoji)} ${escapeHtml(strat.name.toUpperCase())} — Detalhamento</h2>`);
    strat.sections.forEach((sec) => {
      blocks.push(`<h3>${escapeHtml(sec.title)}</h3>`);
      blocks.push(sectionTableHtml(data, sec));
    });
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Briefing — ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>
  <h1>Briefing Universal de Produto — ${escapeHtml(title)}</h1>
  <div class="meta">
    <strong>Estratégia:</strong> ${strat ? `${escapeHtml(strat.emoji)} ${escapeHtml(strat.name)}` : "<em>Não selecionada</em>"}<br>
    <strong>Gerado em:</strong> ${escapeHtml(now)}
  </div>
  ${blocks.join("\n")}
</body>
</html>`;
}

// ============================================================
// DOCX (Word-compatible HTML — abre nativamente no Word, Google Docs, Pages)
// ============================================================
export function exportBriefingDocx(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; blob: Blob } {
  const html = buildBriefingHtml(data, strategyId);
  // Truque consagrado: Word abre HTML enviado como application/msword e respeita os estilos inline.
  const docHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    html +
    `</html>`;
  const blob = new Blob(["\ufeff", docHtml], { type: "application/msword" });
  return { filename: `${baseFilename(data, strategyId)}.doc`, blob };
}

// ============================================================
// PDF (jsPDF com texto puro — tipografia limpa, sem dependências pesadas)
// ============================================================
export function exportBriefingPdf(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; blob: Blob } {
  const strat = getStrategy(strategyId);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, fontSize: number, opts: { bold?: boolean; color?: [number, number, number]; lineGap?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(...(opts.color ?? [26, 26, 26]));
    const lines = doc.splitTextToSize(text, contentW);
    const lineHeight = fontSize * 1.25;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, margin, y);
      y += lineHeight;
    }
    y += opts.lineGap ?? 0;
  };

  const writeKV = (label: string, value: string) => {
    const v = value.trim() || "Não preenchido";
    ensureSpace(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(75, 85, 99);
    doc.text(label.toUpperCase(), margin, y);
    y += 11;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(value.trim() ? 26 : 156, value.trim() ? 26 : 163, value.trim() ? 26 : 175);
    const lines = doc.splitTextToSize(v, contentW);
    const lh = 12.5;
    for (const line of lines) { ensureSpace(lh); doc.text(line, margin, y); y += lh; }
    y += 6;
  };

  const writeSectionHeader = (text: string) => {
    ensureSpace(28);
    y += 6;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
    writeWrapped(text, 13, { bold: true, color: [31, 41, 55], lineGap: 4 });
  };

  // Cabeçalho
  writeWrapped(`Briefing Universal de Produto`, 18, { bold: true, color: [31, 41, 55], lineGap: 2 });
  writeWrapped(data.nomeProduto || "(sem nome)", 14, { bold: true, color: [55, 65, 81], lineGap: 6 });
  writeWrapped(
    `Estratégia: ${strat ? `${strat.emoji} ${strat.name}` : "Não selecionada"}  •  Gerado em ${new Date().toLocaleString("pt-BR")}`,
    9, { color: [107, 114, 128], lineGap: 6 },
  );

  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  FIXED_SECTIONS.forEach((s, i) => {
    writeSectionHeader(`BLOCO ${blockLetters[i] ?? i + 1} — ${s.title}`);
    if (s.id === "avatar") {
      writeKV("Descrição do Avatar", data.descricaoAvatar ?? "");
      ["dor1", "dor2", "dor3"].forEach((id, idx) => writeKV(`Dor #${idx + 1}`, data[id] ?? ""));
      ["desejo1", "desejo2", "desejo3"].forEach((id, idx) => writeKV(`Desejo #${idx + 1}`, data[id] ?? ""));
      ["objecao1", "objecao2", "objecao3"].forEach((id, idx) => writeKV(`Objeção #${idx + 1}`, data[id] ?? ""));
      writeKV("Nível de Consciência", data.nivelConsciencia ?? "");
      writeKV("Canais Online", data.canaisOnline ?? "");
      writeKV("Resumo do Mapa da Empatia", data.empatiaResumo ?? "");
    } else if (s.id === "mapaEmpatia") {
      writeKV("🧠 O que pensa e sente", data.me_pensaSente ?? "");
      writeKV("👀 O que vê", data.me_ve ?? "");
      writeKV("👂 O que ouve", data.me_ouve ?? "");
      writeKV("💬 O que fala e faz", data.me_falaFaz ?? "");
      writeKV("😣 Dores", data.me_dores ?? "");
      writeKV("🏆 Ganhos", data.me_ganhos ?? "");
    } else {
      const fields = s.groups.flatMap((g) => g.fields ?? []);
      fields.forEach((f) => writeKV(f.label, data[f.id] ?? ""));
    }
  });

  if (strat) {
    writeSectionHeader(`${strat.emoji} ${strat.name.toUpperCase()} — Detalhamento`);
    strat.sections.forEach((sec) => {
      writeWrapped(sec.title, 11, { bold: true, color: [55, 65, 81], lineGap: 4 });
      const fields = sec.groups.flatMap((g) => g.fields ?? []);
      fields.forEach((f) => writeKV(f.label, data[f.id] ?? ""));
    });
  }

  const blob = doc.output("blob");
  return { filename: `${baseFilename(data, strategyId)}.pdf`, blob };
}

// ============================================================
// Download helpers
// ============================================================
function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadMarkdown(filename: string, content: string) {
  triggerDownload(filename, new Blob([content], { type: "text/markdown;charset=utf-8" }));
}

export type ExportFormat = "md" | "doc" | "pdf";

export function exportBriefing(
  format: ExportFormat,
  data: Record<string, string>,
  strategyId?: string | null,
) {
  if (format === "md") {
    const { filename, content } = exportBriefingMarkdown(data, strategyId);
    downloadMarkdown(filename, content);
    return filename;
  }
  if (format === "doc") {
    const { filename, blob } = exportBriefingDocx(data, strategyId);
    triggerDownload(filename, blob);
    return filename;
  }
  const { filename, blob } = exportBriefingPdf(data, strategyId);
  triggerDownload(filename, blob);
  return filename;
}
