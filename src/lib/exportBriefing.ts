import { jsPDF } from "jspdf";
import { FIXED_SECTIONS, getStrategy, type Section } from "./briefingSchema";

// ============================================================
// DESIGN TOKENS (consistentes em PDF / DOC / MD)
// ============================================================
const PALETTE = {
  ink: [17, 24, 39] as [number, number, number],          // #111827
  body: [55, 65, 81] as [number, number, number],         // #374151
  muted: [107, 114, 128] as [number, number, number],     // #6B7280
  faint: [156, 163, 175] as [number, number, number],     // #9CA3AF
  rule: [229, 231, 235] as [number, number, number],      // #E5E7EB
  cardBg: [249, 250, 251] as [number, number, number],    // #F9FAFB
  cardBorder: [229, 231, 235] as [number, number, number],
  brand: [37, 99, 235] as [number, number, number],       // #2563EB
  brandSoft: [219, 234, 254] as [number, number, number], // #DBEAFE
  warn: [217, 119, 6] as [number, number, number],        // #D97706
  ok: [22, 163, 74] as [number, number, number],          // #16A34A
};

const NA = "_Não preenchido_";
const v = (data: Record<string, string>, id: string) => {
  const val = (data[id] ?? "").trim();
  return val.length ? val : NA;
};

// Remove emojis e símbolos fora do BMP que o Helvetica do jsPDF não suporta
// (renderiza como "Ø=ÜÑ", "&j", etc). Mantemos texto puro para o PDF.
const stripEmojis = (s: string): string => {
  if (!s) return s;
  return s
    // Remove sequências de emoji (Extended_Pictographic + variation selectors + ZWJ)
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
    .replace(/[\u{2600}-\u{27BF}]/gu, "")
    .replace(/[\u{FE00}-\u{FE0F}]/gu, "") // variation selectors
    .replace(/[\u{200D}]/gu, "")           // ZWJ
    .replace(/\s{2,}/g, " ")
    .trim();
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

// Conta itens preenchidos para exibir nível de completude
function computeCompleteness(data: Record<string, string>, strat: ReturnType<typeof getStrategy>) {
  const allSections: Section[] = [
    ...FIXED_SECTIONS,
    ...(strat?.sections ?? []),
  ];
  const fields = allSections.flatMap((s) => s.groups.flatMap((g) => g.fields ?? []));
  const filled = fields.filter((f) => (data[f.id] ?? "").trim().length > 0).length;
  return { filled, total: fields.length, pct: fields.length ? Math.round((filled / fields.length) * 100) : 0 };
}

function listItems(value: string): string[] {
  return (value ?? "")
    .split(/\n|,(?![^()]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ============================================================
// MARKDOWN — capa, sumário, blocos com hierarquia clara
// ============================================================
const tableRows = (data: Record<string, string>, ids: [string, string][]) =>
  ids.map(([id, label]) => `| **${label}** | ${v(data, id)} |`).join("\n");

const sectionTable = (data: Record<string, string>, section: Section) => {
  const fields = section.groups.flatMap((g) => g.fields ?? []);
  const rows = fields.map((f) => [f.id, f.label] as [string, string]);
  return `| Campo | Valor |\n|---|---|\n${tableRows(data, rows)}`;
};

export function exportBriefingMarkdown(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; content: string } {
  const strat = getStrategy(strategyId);
  const filename = `${baseFilename(data, strategyId)}.md`;
  const now = new Date().toLocaleString("pt-BR");
  const completeness = computeCompleteness(data, strat);

  const out: string[] = [];

  // ── Capa
  out.push(
    `<div align="center">\n\n` +
    `# 📘 Briefing Universal de Produto\n\n` +
    `### ${data.nomeProduto || "(sem nome)"}\n\n` +
    `${strat ? `**Estratégia:** ${strat.emoji} ${strat.name}` : "_Estratégia não selecionada_"}\n\n` +
    `\`Gerado em ${now}\` · \`Completude ${completeness.pct}% (${completeness.filled}/${completeness.total})\`\n\n` +
    `</div>\n\n---`,
  );

  // ── Sumário
  out.push(`## 📑 Sumário\n`);
  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  FIXED_SECTIONS.forEach((s, i) => {
    out.push(`- **Bloco ${blockLetters[i] ?? i + 1}** — [${s.title}](#bloco-${blockLetters[i].toLowerCase()}-${slugify(s.title)})`);
  });
  if (strat) {
    out.push(`- **Estratégia ${strat.emoji}** — [${strat.name}](#${slugify(strat.name)}-detalhamento)`);
  }
  out.push(`\n---`);

  // ── Resumo Executivo
  const resumo: string[] = [];
  if (data.nicho) resumo.push(`- **Nicho:** ${data.nicho}`);
  if (data.transformacaoPrincipal) resumo.push(`- **Transformação prometida:** ${data.transformacaoPrincipal}`);
  if (data.precoProduto) resumo.push(`- **Preço:** ${data.precoProduto}`);
  if (data.descricaoAvatar) resumo.push(`- **Avatar:** ${data.descricaoAvatar.split("\n")[0]}`);
  if (resumo.length) {
    out.push(`## ⭐ Resumo Executivo\n\n${resumo.join("\n")}\n\n---`);
  }

  // ── Blocos fixos
  FIXED_SECTIONS.forEach((s, i) => {
    const letter = blockLetters[i] ?? `${i + 1}`;
    out.push(`## Bloco ${letter} — ${s.title}`);

    if (s.id === "avatar") {
      out.push(`> **Descrição do Avatar**\n>\n> ${(data.descricaoAvatar ?? "").trim() || "_Não preenchido_"}`);
      const numbered = (label: string, ids: string[]) =>
        `**${label}**\n\n` + ids.map((id, idx) => `${idx + 1}. ${v(data, id)}`).join("\n");
      out.push(numbered("😣 Dores", ["dor1", "dor2", "dor3"]));
      out.push(numbered("🎯 Desejos", ["desejo1", "desejo2", "desejo3"]));
      out.push(numbered("🛡 Objeções", ["objecao1", "objecao2", "objecao3"]));
      out.push(
        `| Campo | Valor |\n|---|---|\n` +
        `| **Nível de Consciência** | ${v(data, "nivelConsciencia")} |\n` +
        `| **Canais Online** | ${v(data, "canaisOnline")} |\n` +
        `| **Resumo do Mapa da Empatia** | ${v(data, "empatiaResumo")} |`,
      );
    } else if (s.id === "mapaEmpatia") {
      // Grade 3x2 em markdown
      out.push(
        `| 🧠 Pensa & Sente | 👀 Vê | 👂 Ouve |\n|---|---|---|\n` +
        `| ${v(data, "me_pensaSente")} | ${v(data, "me_ve")} | ${v(data, "me_ouve")} |\n\n` +
        `| 💬 Fala & Faz | 😣 Dores | 🏆 Ganhos |\n|---|---|---|\n` +
        `| ${v(data, "me_falaFaz")} | ${v(data, "me_dores")} | ${v(data, "me_ganhos")} |`,
      );
    } else {
      out.push(sectionTable(data, s));
    }
    out.push(`---`);
  });

  // ── Estratégia
  if (strat) {
    out.push(`## ${strat.emoji} ${strat.name} — Detalhamento`);
    strat.sections.forEach((sec) => {
      out.push(`### ${sec.title}`);
      out.push(sectionTable(data, sec));
    });
    out.push(`---`);
  }

  out.push(
    `<div align="center">\n\n` +
    `_Documento gerado automaticamente pelo **Briefing Master AG**._\n\n` +
    `</div>\n`,
  );

  return { filename, content: out.join("\n\n") };
}

// ============================================================
// HTML para DOCX (estilos inline + Word-friendly)
// ============================================================
const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const filledOrEmpty = (raw: string) => {
  const val = (raw ?? "").trim();
  return val
    ? escapeHtml(val).replace(/\n/g, "<br>")
    : `<em style="color:#9CA3AF">Não preenchido</em>`;
};

const fieldRowsHtml = (data: Record<string, string>, rows: [string, string][]) =>
  rows
    .map(([id, label]) =>
      `<tr><th>${escapeHtml(label)}</th><td>${filledOrEmpty(data[id] ?? "")}</td></tr>`,
    )
    .join("");

const sectionTableHtml = (data: Record<string, string>, section: Section) => {
  const fields = section.groups.flatMap((g) => g.fields ?? []);
  const rows = fields.map((f) => [f.id, f.label] as [string, string]);
  return `<table class="kv">${fieldRowsHtml(data, rows)}</table>`;
};

export function buildBriefingHtml(
  data: Record<string, string>,
  strategyId?: string | null,
): string {
  const strat = getStrategy(strategyId);
  const now = new Date().toLocaleString("pt-BR");
  const title = data.nomeProduto || "(sem nome)";
  const completeness = computeCompleteness(data, strat);

  const styles = `
    @page { size: A4; margin: 2cm 1.8cm; }
    body { font-family: 'Segoe UI', -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #111827; line-height: 1.55; font-size: 10.5pt; }

    /* Capa */
    .cover { text-align: center; padding: 60pt 0 80pt; page-break-after: always; }
    .cover .eyebrow { color: #2563EB; font-size: 9pt; letter-spacing: 4pt; text-transform: uppercase; font-weight: 700; }
    .cover h1 { font-size: 32pt; margin: 18pt 0 6pt; color: #111827; letter-spacing: -0.5pt; }
    .cover .subtitle { font-size: 16pt; color: #374151; font-weight: 400; margin-bottom: 26pt; }
    .cover .strategy-pill {
      display: inline-block; background: #DBEAFE; color: #1E40AF; padding: 6pt 14pt;
      border-radius: 999pt; font-size: 11pt; font-weight: 600;
    }
    .cover .meta {
      margin-top: 32pt; color: #6B7280; font-size: 9.5pt;
      border-top: 0.5pt solid #E5E7EB; padding-top: 14pt; display: inline-block;
    }
    .cover .pct {
      margin-top: 18pt; font-size: 11pt; color: #111827;
    }
    .cover .bar {
      width: 220pt; height: 6pt; background: #E5E7EB; border-radius: 999pt; margin: 6pt auto 0;
    }
    .cover .bar > span {
      display: block; height: 6pt; background: #2563EB; border-radius: 999pt;
    }

    /* Sumário */
    .toc { page-break-after: always; }
    .toc h2 { font-size: 14pt; color: #111827; border-bottom: 1pt solid #E5E7EB; padding-bottom: 4pt; }
    .toc ol { padding-left: 18pt; color: #374151; }
    .toc li { margin: 4pt 0; }

    /* Cabeçalhos de bloco */
    .block { page-break-inside: avoid; margin-top: 24pt; }
    .block-head {
      display: flex; align-items: baseline; gap: 10pt;
      border-bottom: 2pt solid #2563EB; padding-bottom: 6pt; margin-bottom: 12pt;
    }
    .block-letter {
      background: #2563EB; color: #fff; font-weight: 700; font-size: 10pt;
      padding: 3pt 8pt; border-radius: 4pt; letter-spacing: 1pt;
    }
    .block-title { font-size: 15pt; font-weight: 600; color: #111827; }

    /* Tabelas */
    table.kv { border-collapse: collapse; width: 100%; margin: 6pt 0 14pt; font-size: 10pt; }
    table.kv th, table.kv td { border: 0.5pt solid #E5E7EB; padding: 7pt 10pt; vertical-align: top; text-align: left; }
    table.kv th { background: #F9FAFB; width: 30%; font-weight: 600; color: #374151; }
    table.kv td { color: #111827; }

    /* Mapa da Empatia 3x2 */
    table.empathy { border-collapse: separate; border-spacing: 6pt; width: 100%; margin: 6pt 0 14pt; }
    table.empathy td {
      width: 33.33%; vertical-align: top; padding: 10pt; border-radius: 6pt;
      font-size: 9.5pt; line-height: 1.45;
    }
    .em-quad-title { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5pt; margin-bottom: 4pt; }
    .em-pensa { background: #EEF2FF; border: 0.5pt solid #C7D2FE; }   .em-pensa  .em-quad-title { color: #4338CA; }
    .em-ve    { background: #ECFDF5; border: 0.5pt solid #A7F3D0; }   .em-ve     .em-quad-title { color: #047857; }
    .em-ouve  { background: #FFF7ED; border: 0.5pt solid #FED7AA; }   .em-ouve   .em-quad-title { color: #C2410C; }
    .em-fala  { background: #F3F4F6; border: 0.5pt solid #D1D5DB; }   .em-fala   .em-quad-title { color: #374151; }
    .em-dores { background: #FEF2F2; border: 0.5pt solid #FECACA; }   .em-dores  .em-quad-title { color: #B91C1C; }
    .em-ganhos{ background: #EFF6FF; border: 0.5pt solid #BFDBFE; }   .em-ganhos .em-quad-title { color: #1D4ED8; }

    /* Caixa de descrição */
    .callout {
      background: #F9FAFB; border-left: 3pt solid #2563EB; padding: 10pt 14pt;
      margin: 8pt 0 14pt; font-size: 10.5pt; color: #111827;
    }
    .callout .label { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1pt; color: #2563EB; font-weight: 700; margin-bottom: 4pt; }

    ol.numbered { margin: 6pt 0 14pt 0; padding-left: 22pt; }
    ol.numbered li { margin: 3pt 0; padding-left: 4pt; }

    h3.subhead { font-size: 11.5pt; color: #1E40AF; margin: 18pt 0 6pt; font-weight: 600; }

    /* Estratégia */
    .strategy-section { margin-top: 32pt; }
    .strategy-section .block-letter { background: #16A34A; }
    .strategy-section .block-head { border-bottom-color: #16A34A; }
  `;

  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  const blocks: string[] = [];

  // Resumo executivo (se houver dados)
  const resumo: string[] = [];
  if (data.nicho) resumo.push(`<strong>Nicho:</strong> ${escapeHtml(data.nicho)}`);
  if (data.transformacaoPrincipal) resumo.push(`<strong>Transformação:</strong> ${escapeHtml(data.transformacaoPrincipal)}`);
  if (data.precoProduto) resumo.push(`<strong>Preço:</strong> ${escapeHtml(data.precoProduto)}`);
  if (resumo.length) {
    blocks.push(
      `<div class="callout"><div class="label">Resumo executivo</div>${resumo.join(" · ")}</div>`,
    );
  }

  FIXED_SECTIONS.forEach((s, i) => {
    const letter = blockLetters[i] ?? `${i + 1}`;
    blocks.push(`<section class="block">`);
    blocks.push(
      `<div class="block-head"><span class="block-letter">BLOCO ${letter}</span>` +
      `<span class="block-title">${escapeHtml(s.title)}</span></div>`,
    );

    if (s.id === "avatar") {
      const desc = (data.descricaoAvatar ?? "").trim();
      blocks.push(
        `<div class="callout"><div class="label">Descrição do Avatar</div>` +
        `${desc ? escapeHtml(desc).replace(/\n/g, "<br>") : "<em style='color:#9CA3AF'>Não preenchido</em>"}` +
        `</div>`,
      );
      const list = (label: string, ids: string[]) =>
        `<h3 class="subhead">${label}</h3><ol class="numbered">${ids
          .map((id) => `<li>${filledOrEmpty(data[id] ?? "")}</li>`)
          .join("")}</ol>`;
      blocks.push(list("😣 Dores", ["dor1", "dor2", "dor3"]));
      blocks.push(list("🎯 Desejos", ["desejo1", "desejo2", "desejo3"]));
      blocks.push(list("🛡 Objeções", ["objecao1", "objecao2", "objecao3"]));
      blocks.push(
        `<table class="kv">${fieldRowsHtml(data, [
          ["nivelConsciencia", "Nível de Consciência"],
          ["canaisOnline", "Canais Online"],
          ["empatiaResumo", "Resumo do Mapa da Empatia"],
        ])}</table>`,
      );
    } else if (s.id === "mapaEmpatia") {
      const cell = (cls: string, emoji: string, label: string, fid: string) =>
        `<td class="${cls}"><div class="em-quad-title">${emoji} ${label}</div>${filledOrEmpty(data[fid] ?? "")}</td>`;
      blocks.push(
        `<table class="empathy"><tr>` +
        cell("em-pensa", "🧠", "Pensa &amp; Sente", "me_pensaSente") +
        cell("em-ve", "👀", "Vê", "me_ve") +
        cell("em-ouve", "👂", "Ouve", "me_ouve") +
        `</tr><tr>` +
        cell("em-fala", "💬", "Fala &amp; Faz", "me_falaFaz") +
        cell("em-dores", "😣", "Dores", "me_dores") +
        cell("em-ganhos", "🏆", "Ganhos", "me_ganhos") +
        `</tr></table>`,
      );
    } else {
      blocks.push(sectionTableHtml(data, s));
    }

    blocks.push(`</section>`);
  });

  if (strat) {
    blocks.push(`<section class="block strategy-section">`);
    blocks.push(
      `<div class="block-head"><span class="block-letter">${escapeHtml(strat.emoji)} ESTRATÉGIA</span>` +
      `<span class="block-title">${escapeHtml(strat.name)} — Detalhamento</span></div>`,
    );
    strat.sections.forEach((sec) => {
      blocks.push(`<h3 class="subhead">${escapeHtml(sec.title)}</h3>`);
      blocks.push(sectionTableHtml(data, sec));
    });
    blocks.push(`</section>`);
  }

  // Sumário
  const tocItems: string[] = [];
  FIXED_SECTIONS.forEach((s, i) => {
    tocItems.push(`<li><strong>Bloco ${blockLetters[i] ?? i + 1}</strong> — ${escapeHtml(s.title)}</li>`);
  });
  if (strat) {
    tocItems.push(`<li><strong>Estratégia</strong> — ${escapeHtml(strat.emoji)} ${escapeHtml(strat.name)}</li>`);
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Briefing — ${escapeHtml(title)}</title>
<style>${styles}</style>
</head>
<body>

<div class="cover">
  <div class="eyebrow">Briefing Universal de Produto</div>
  <h1>${escapeHtml(title)}</h1>
  <div class="subtitle">${data.nicho ? escapeHtml(data.nicho) : "Infoproduto"}</div>
  <div class="strategy-pill">${strat ? `${escapeHtml(strat.emoji)} ${escapeHtml(strat.name)}` : "Estratégia não selecionada"}</div>
  <div class="pct">Completude: <strong>${completeness.pct}%</strong> (${completeness.filled}/${completeness.total} campos)</div>
  <div class="bar"><span style="width:${completeness.pct}%"></span></div>
  <div class="meta">Gerado em ${escapeHtml(now)} · Briefing Master AG</div>
</div>

<div class="toc">
  <h2>📑 Sumário</h2>
  <ol>${tocItems.join("")}</ol>
</div>

${blocks.join("\n")}

</body>
</html>`;
}

// ============================================================
// DOCX (HTML servido como Word — compatível com Word/Google Docs/Pages)
// ============================================================
export function exportBriefingDocx(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; blob: Blob } {
  const html = buildBriefingHtml(data, strategyId);
  const docHtml =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    html +
    `</html>`;
  const blob = new Blob(["\ufeff", docHtml], { type: "application/msword" });
  return { filename: `${baseFilename(data, strategyId)}.doc`, blob };
}

// ============================================================
// PDF — capa, sumário, hierarquia, mapa em grade, rodapé paginado
// ============================================================
export function exportBriefingPdf(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; blob: Blob } {
  const strat = getStrategy(strategyId);
  const completeness = computeCompleteness(data, strat);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 54;
  const contentW = pageW - margin * 2;
  let y = margin;

  // ── helpers de baixo nível
  const setText = (color: [number, number, number]) => doc.setTextColor(color[0], color[1], color[2]);
  const setFill = (color: [number, number, number]) => doc.setFillColor(color[0], color[1], color[2]);
  const setDraw = (color: [number, number, number]) => doc.setDrawColor(color[0], color[1], color[2]);

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin - 24) {
      doc.addPage();
      y = margin;
    }
  };

  const writeWrapped = (
    text: string,
    fontSize: number,
    opts: { bold?: boolean; color?: [number, number, number]; lineGap?: number; align?: "left" | "center"; x?: number; w?: number } = {},
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(fontSize);
    setText(opts.color ?? PALETTE.ink);
    const w = opts.w ?? contentW;
    const lines = doc.splitTextToSize(stripEmojis(text), w);
    const lineHeight = fontSize * 1.3;
    for (const line of lines) {
      ensureSpace(lineHeight);
      const x = opts.align === "center" ? pageW / 2 : (opts.x ?? margin);
      doc.text(line, x, y, { align: opts.align });
      y += lineHeight;
    }
    y += opts.lineGap ?? 0;
  };

  // ── CAPA
  const drawCover = () => {
    // faixa superior
    setFill(PALETTE.brand);
    doc.rect(0, 0, pageW, 8, "F");

    y = 130;
    setText(PALETTE.brand);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("BRIEFING UNIVERSAL DE PRODUTO", pageW / 2, y, { align: "center" });
    y += 26;

    // título
    writeWrapped(data.nomeProduto || "(sem nome)", 28, {
      bold: true, color: PALETTE.ink, align: "center", lineGap: 6,
    });

    // subtítulo
    if (data.nicho) {
      writeWrapped(data.nicho, 13, { color: PALETTE.body, align: "center", lineGap: 8 });
    }

    // pílula da estratégia (sem emoji — Helvetica não suporta)
    const stratLabel = strat ? strat.name.toUpperCase() : "ESTRATÉGIA NÃO SELECIONADA";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const tw = doc.getTextWidth(stratLabel);
    const padX = 16, pillW = tw + padX * 2, pillH = 24;
    const pillX = (pageW - pillW) / 2;
    setFill(strat ? PALETTE.brandSoft : [243, 244, 246]);
    doc.roundedRect(pillX, y, pillW, pillH, 12, 12, "F");
    setText(strat ? [30, 64, 175] : PALETTE.muted);
    doc.text(stratLabel, pageW / 2, y + 15.5, { align: "center" });
    y += pillH + 32;

    // barra de completude
    const barW = 240, barH = 8;
    const barX = (pageW - barW) / 2;
    setFill(PALETTE.rule);
    doc.roundedRect(barX, y, barW, barH, 4, 4, "F");
    setFill(PALETTE.brand);
    const fillW = Math.max(2, (barW * completeness.pct) / 100);
    doc.roundedRect(barX, y, fillW, barH, 4, 4, "F");
    y += barH + 14;

    setText(PALETTE.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Completude: ${completeness.pct}%`, pageW / 2, y, { align: "center" });
    y += 14;
    setText(PALETTE.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`${completeness.filled} de ${completeness.total} campos preenchidos`, pageW / 2, y, { align: "center" });

    // rodapé da capa
    setText(PALETTE.muted);
    doc.setFontSize(8.5);
    doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Briefing Master AG`, pageW / 2, pageH - 60, { align: "center" });

    // faixa inferior
    setFill(PALETTE.brand);
    doc.rect(0, pageH - 8, pageW, 8, "F");

    doc.addPage();
    y = margin;
  };

  // ── SUMÁRIO
  const drawToc = () => {
    writeWrapped("Sumário", 22, { bold: true, color: PALETTE.ink, lineGap: 4 });
    setDraw(PALETTE.brand);
    doc.setLineWidth(1.5);
    doc.line(margin, y, margin + 60, y);
    y += 22;

    const blockLetters = ["A", "B", "C", "D", "E", "F"];
    const drawTocLine = (tag: string, tagColor: [number, number, number], title: string) => {
      ensureSpace(22);
      // tag pill
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      const tw = doc.getTextWidth(tag);
      const padX = 6, tagW = tw + padX * 2, tagH = 14;
      setFill(tagColor);
      doc.roundedRect(margin, y - 10, tagW, tagH, 2, 2, "F");
      setText([255, 255, 255]);
      doc.text(tag, margin + padX, y);
      // título
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      setText(PALETTE.ink);
      doc.text(stripEmojis(title), margin + tagW + 10, y);
      y += 20;
    };

    FIXED_SECTIONS.forEach((s, i) => {
      drawTocLine(`BLOCO ${blockLetters[i] ?? i + 1}`, PALETTE.brand, s.title);
    });
    if (strat) {
      drawTocLine("ESTRATÉGIA", PALETTE.ok, strat.name);
    }
    doc.addPage();
    y = margin;
  };

  // ── Cabeçalho de bloco (faixa colorida + tag)
  // forceNewPage: força bloco a começar em nova página (evita títulos órfãos)
  const writeBlockHeader = (
    letter: string,
    title: string,
    color: [number, number, number] = PALETTE.brand,
    forceNewPage = false,
  ) => {
    if (forceNewPage && y > margin + 4) {
      doc.addPage();
      y = margin;
    } else {
      ensureSpace(56);
    }
    y += 4;

    // tag
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const tag = `BLOCO ${letter}`;
    const tw = doc.getTextWidth(tag);
    const padX = 7, tagW = tw + padX * 2, tagH = 16;
    setFill(color);
    doc.roundedRect(margin, y, tagW, tagH, 3, 3, "F");
    setText([255, 255, 255]);
    doc.text(tag, margin + padX, y + 11);

    // título
    setText(PALETTE.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(stripEmojis(title), margin + tagW + 10, y + 12);
    y += tagH + 8;

    // linha base
    setDraw(color);
    doc.setLineWidth(1.2);
    doc.line(margin, y, pageW - margin, y);
    y += 14;
  };

  // ── Sub-cabeçalho (para estratégia.sections) — mantém junto com o conteúdo seguinte
  const writeSubHeader = (text: string) => {
    // Garante espaço para o subtítulo + ao menos 2 linhas de conteúdo (≈ 60pt)
    ensureSpace(60);
    y += 6;
    setText([30, 64, 175]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(stripEmojis(text), margin, y);
    y += 10;
    setDraw(PALETTE.rule);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 12;
  };

  // ── Caixa de "Descrição"
  const drawCallout = (label: string, value: string) => {
    const text = stripEmojis((value ?? "").trim());
    const display = text || "Não preenchido";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(display, contentW - 24);
    const lineH = 13;
    const innerH = 18 + lines.length * lineH + 10;

    ensureSpace(innerH + 8);
    const boxX = margin, boxY = y, boxW = contentW;
    setFill(PALETTE.cardBg);
    doc.roundedRect(boxX, boxY, boxW, innerH, 4, 4, "F");
    setFill(PALETTE.brand);
    doc.rect(boxX, boxY, 3, innerH, "F");

    // label
    setText(PALETTE.brand);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), boxX + 12, boxY + 13);

    // texto
    setText(text ? PALETTE.ink : PALETTE.faint);
    doc.setFont("helvetica", text ? "normal" : "italic");
    doc.setFontSize(10.5);
    let ty = boxY + 28;
    for (const ln of lines) { doc.text(ln, boxX + 12, ty); ty += lineH; }

    y = boxY + innerH + 12;
  };

  // ── Linha "label / valor" (mantém label + ao menos 1 linha juntos)
  const writeKV = (label: string, value: string) => {
    const text = stripEmojis((value ?? "").trim());
    const display = text || "Não preenchido";
    // Reserva espaço mínimo: label (12pt) + 1 linha de texto (13pt) + spacing
    ensureSpace(34);
    setText(PALETTE.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(label.toUpperCase(), margin, y);
    y += 12;

    doc.setFont("helvetica", text ? "normal" : "italic");
    doc.setFontSize(10.5);
    setText(text ? PALETTE.ink : PALETTE.faint);
    const lines = doc.splitTextToSize(display, contentW);
    const lh = 13;
    for (const ln of lines) { ensureSpace(lh); doc.text(ln, margin, y); y += lh; }
    y += 10;
  };

  // ── Lista numerada (Dores/Desejos/Objeções) — usa marcador colorido em vez de emoji
  const writeNumberedList = (heading: string, ids: string[], accent: [number, number, number] = PALETTE.brand) => {
    ensureSpace(36);
    // marcador colorido + texto do heading
    setFill(accent);
    doc.roundedRect(margin, y - 8, 4, 12, 2, 2, "F");
    setText(PALETTE.ink);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(stripEmojis(heading), margin + 10, y);
    y += 16;

    ids.forEach((id, idx) => {
      const text = stripEmojis((data[id] ?? "").trim());
      const display = text || "Não preenchido";
      const num = `${idx + 1}.`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const numW = doc.getTextWidth(num) + 6;

      doc.setFont("helvetica", text ? "normal" : "italic");
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(display, contentW - numW);
      const lh = 13;
      ensureSpace(lh);
      // número
      setText(accent);
      doc.setFont("helvetica", "bold");
      doc.text(num, margin, y);
      // texto
      setText(text ? PALETTE.ink : PALETTE.faint);
      doc.setFont("helvetica", text ? "normal" : "italic");
      doc.text(lines[0], margin + numW, y);
      y += lh;
      for (let i = 1; i < lines.length; i++) {
        ensureSpace(lh);
        doc.text(lines[i], margin + numW, y); y += lh;
      }
      y += 2;
    });
    y += 8;
  };

  // ── Mapa da Empatia em grade 3x2 com cards coloridos
  const drawEmpathyGrid = () => {
    const quads: Array<{
      id: string; emoji: string; label: string; fill: [number, number, number]; border: [number, number, number]; titleColor: [number, number, number];
    }> = [
      { id: "me_pensaSente", emoji: "🧠", label: "Pensa & Sente", fill: [238, 242, 255], border: [199, 210, 254], titleColor: [67, 56, 202] },
      { id: "me_ve",         emoji: "👀", label: "Vê",            fill: [236, 253, 245], border: [167, 243, 208], titleColor: [4, 120, 87] },
      { id: "me_ouve",       emoji: "👂", label: "Ouve",          fill: [255, 247, 237], border: [254, 215, 170], titleColor: [194, 65, 12] },
      { id: "me_falaFaz",    emoji: "💬", label: "Fala & Faz",    fill: [243, 244, 246], border: [209, 213, 219], titleColor: [55, 65, 81] },
      { id: "me_dores",      emoji: "😣", label: "Dores",         fill: [254, 242, 242], border: [254, 202, 202], titleColor: [185, 28, 28] },
      { id: "me_ganhos",     emoji: "🏆", label: "Ganhos",        fill: [239, 246, 255], border: [191, 219, 254], titleColor: [29, 78, 216] },
    ];

    const gap = 8;
    const cardW = (contentW - gap * 2) / 3;
    const cardPad = 10;
    const titleH = 14;

    // Calcular alturas de cada card baseado no conteúdo
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const rowsHeights: number[] = [];
    for (let row = 0; row < 2; row++) {
      let maxH = 0;
      for (let col = 0; col < 3; col++) {
        const q = quads[row * 3 + col];
        const text = (data[q.id] ?? "").trim() || "Não preenchido";
        const lines = doc.splitTextToSize(text, cardW - cardPad * 2);
        const h = titleH + lines.length * 11 + cardPad * 2;
        if (h > maxH) maxH = h;
      }
      rowsHeights.push(Math.max(maxH, 70));
    }

    const totalH = rowsHeights[0] + rowsHeights[1] + gap;
    ensureSpace(totalH + 4);

    let cy = y;
    for (let row = 0; row < 2; row++) {
      const rowH = rowsHeights[row];
      for (let col = 0; col < 3; col++) {
        const q = quads[row * 3 + col];
        const cx = margin + col * (cardW + gap);
        const text = (data[q.id] ?? "").trim();
        const display = text || "Não preenchido";

        // card
        setFill(q.fill);
        setDraw(q.border);
        doc.setLineWidth(0.5);
        doc.roundedRect(cx, cy, cardW, rowH, 4, 4, "FD");

        // título
        setText(q.titleColor);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.text(`${q.emoji}  ${q.label.toUpperCase()}`, cx + cardPad, cy + cardPad + 6);

        // texto
        setText(text ? PALETTE.ink : PALETTE.faint);
        doc.setFont("helvetica", text ? "normal" : "italic");
        doc.setFontSize(9);
        const lines = doc.splitTextToSize(display, cardW - cardPad * 2);
        let ty = cy + cardPad + titleH + 6;
        for (const ln of lines) { doc.text(ln, cx + cardPad, ty); ty += 11; }
      }
      cy += rowH + gap;
    }
    y = cy + 6;
  };

  // ============================================================
  // CONSTRUÇÃO DO DOCUMENTO
  // ============================================================
  drawCover();
  drawToc();

  const blockLetters = ["A", "B", "C", "D", "E", "F"];
  FIXED_SECTIONS.forEach((s, i) => {
    writeBlockHeader(blockLetters[i] ?? `${i + 1}`, s.title, PALETTE.brand);

    if (s.id === "avatar") {
      drawCallout("Descrição do Avatar", data.descricaoAvatar ?? "");
      writeNumberedList("😣 Dores", ["dor1", "dor2", "dor3"]);
      writeNumberedList("🎯 Desejos", ["desejo1", "desejo2", "desejo3"]);
      writeNumberedList("🛡 Objeções", ["objecao1", "objecao2", "objecao3"]);
      writeKV("Nível de Consciência", data.nivelConsciencia ?? "");
      writeKV("Canais Online", data.canaisOnline ?? "");
      writeKV("Resumo do Mapa da Empatia", data.empatiaResumo ?? "");
    } else if (s.id === "mapaEmpatia") {
      drawEmpathyGrid();
    } else {
      const fields = s.groups.flatMap((g) => g.fields ?? []);
      fields.forEach((f) => writeKV(f.label, data[f.id] ?? ""));
    }
  });

  if (strat) {
    writeBlockHeader(strat.emoji, `${strat.name} — Detalhamento`, PALETTE.ok);
    strat.sections.forEach((sec) => {
      writeSubHeader(sec.title);
      const fields = sec.groups.flatMap((g) => g.fields ?? []);
      fields.forEach((f) => writeKV(f.label, data[f.id] ?? ""));
    });
  }

  // ── Rodapé com paginação em todas as páginas (exceto capa)
  const pageCount = doc.getNumberOfPages();
  for (let p = 2; p <= pageCount; p++) {
    doc.setPage(p);
    setDraw(PALETTE.rule);
    doc.setLineWidth(0.4);
    doc.line(margin, pageH - 32, pageW - margin, pageH - 32);

    setText(PALETTE.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const left = data.nomeProduto || "Briefing";
    doc.text(left, margin, pageH - 18);
    const right = `${p - 1} / ${pageCount - 1}`;
    doc.text(right, pageW - margin, pageH - 18, { align: "right" });
    doc.text("Briefing Master AG", pageW / 2, pageH - 18, { align: "center" });
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
