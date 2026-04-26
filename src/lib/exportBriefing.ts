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

export function exportBriefingMarkdown(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; content: string } {
  const strat = getStrategy(strategyId);
  const nome = (data.nomeProduto || "sem-nome").trim();
  const stratSlug = strat?.id ?? "sem-estrategia";
  const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const filename = `briefing-${slug || "produto"}-${stratSlug}.md`;
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

export function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
