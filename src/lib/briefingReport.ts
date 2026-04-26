import { FIXED_SECTIONS, getStrategy, type Section, type Field } from "./briefingSchema";

const collectFields = (section: Section): Field[] =>
  section.groups.flatMap((g) => g.fields ?? []);

const isFilled = (v: string | undefined) => (v ?? "").trim().length > 0;

const countItems = (v: string | undefined) =>
  (v ?? "")
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3).length;

const EMPATHY_FIELDS: { id: string; label: string; min: number }[] = [
  { id: "me_ve", label: "👀 O que VÊ", min: 3 },
  { id: "me_ouve", label: "👂 O que OUVE", min: 3 },
  { id: "me_pensaSente", label: "🧠 O que PENSA e SENTE", min: 3 },
  { id: "me_falaFaz", label: "💬 O que FALA e FAZ", min: 3 },
  { id: "me_dores", label: "😣 DORES", min: 4 },
  { id: "me_ganhos", label: "🏆 GANHOS / NECESSIDADES", min: 4 },
];

export interface QualityIssue {
  sectionTitle: string;
  fieldLabel: string;
  type: "missing" | "thin";
  recommendation: string;
}

export interface QualityReport {
  totalFields: number;
  filledFields: number;
  scorePct: number;
  requiredMissing: number;
  empathyOk: boolean;
  issues: QualityIssue[];
  suggestions: string[];
}

export function computeQualityReport(
  data: Record<string, string>,
  strategyId?: string | null,
): QualityReport {
  const strat = getStrategy(strategyId);
  const allSections = strat ? [...FIXED_SECTIONS, ...strat.sections] : FIXED_SECTIONS;

  const issues: QualityIssue[] = [];
  let total = 0;
  let filled = 0;
  let requiredMissing = 0;

  allSections.forEach((sec) => {
    collectFields(sec).forEach((f) => {
      total += 1;
      const v = (data[f.id] ?? "").trim();
      if (v.length > 0) filled += 1;

      if (f.required && !isFilled(v)) {
        requiredMissing += 1;
        issues.push({
          sectionTitle: sec.title,
          fieldLabel: f.label,
          type: "missing",
          recommendation: `Campo obrigatório vazio — preencha "${f.label}" para liberar o briefing.`,
        });
      } else if (f.type === "textarea" && isFilled(v) && v.length < 60) {
        issues.push({
          sectionTitle: sec.title,
          fieldLabel: f.label,
          type: "thin",
          recommendation: `"${f.label}" tem menos de 60 caracteres — adicione exemplos concretos.`,
        });
      }
    });
  });

  // Empathy minimums
  let empathyOk = true;
  EMPATHY_FIELDS.forEach(({ id, label, min }) => {
    const items = countItems(data[id]);
    if (items < min) {
      empathyOk = false;
      issues.push({
        sectionTitle: "Mapa da Empatia",
        fieldLabel: label,
        type: "thin",
        recommendation: `Adicione pelo menos ${min} itens em "${label}" (atual: ${items}). Separe por vírgula ou nova linha.`,
      });
    }
  });

  const suggestions: string[] = [];
  if (!isFilled(data.descricaoAvatar)) {
    suggestions.push("Use o botão **Sugerir Cliente Ideal** na seção Avatar para acelerar o ICP.");
  }
  if (!strat) {
    suggestions.push("Selecione uma estratégia para desbloquear seções específicas (LP, FL, Semente, etc.).");
  }
  if (!empathyOk) {
    suggestions.push("Detalhe o Mapa da Empatia seguindo o método Xplane (Dave Gray): no mínimo 3-4 itens concretos por quadrante.");
  }
  if (requiredMissing > 0) {
    suggestions.push(`Existem ${requiredMissing} campo(s) obrigatório(s) em branco. Resolva antes de finalizar.`);
  }

  const scorePct = total === 0 ? 0 : Math.round((filled / total) * 100);

  return { totalFields: total, filledFields: filled, scorePct, requiredMissing, empathyOk, issues, suggestions };
}

export function buildReportMarkdown(
  data: Record<string, string>,
  strategyId?: string | null,
): { filename: string; content: string } {
  const r = computeQualityReport(data, strategyId);
  const strat = getStrategy(strategyId);
  const now = new Date().toLocaleString("pt-BR");
  const productName = (data.nomeProduto || "(sem nome)").trim();

  const slug = productName.toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "produto";

  const lines: string[] = [];
  lines.push(`# Relatório de Qualidade do Briefing — ${productName}`);
  lines.push(`**Gerado em:** ${now}  `);
  lines.push(`**Estratégia:** ${strat ? `${strat.emoji} ${strat.name}` : "_Não selecionada_"}`);
  lines.push("");
  lines.push(`## 📊 Resumo`);
  lines.push(`- **Preenchimento:** ${r.filledFields}/${r.totalFields} campos (**${r.scorePct}%**)`);
  lines.push(`- **Obrigatórios em branco:** ${r.requiredMissing}`);
  lines.push(`- **Mapa da Empatia:** ${r.empathyOk ? "✅ OK" : "⚠️ Incompleto"}`);
  lines.push("");

  lines.push(`## ✅ Checklist de Qualidade`);
  const checklist = [
    { ok: r.requiredMissing === 0, label: "Todos os campos obrigatórios preenchidos" },
    { ok: !!strat, label: "Estratégia selecionada" },
    { ok: r.empathyOk, label: "Mapa da Empatia com mínimo de itens por quadrante" },
    { ok: (data.descricaoAvatar ?? "").trim().length >= 60, label: "Descrição do Avatar com profundidade (60+ caracteres)" },
    { ok: !!data.transformacaoPrincipal, label: "Transformação principal definida" },
    { ok: !!data.precoProduto, label: "Preço do produto definido" },
    { ok: r.scorePct >= 70, label: "Cobertura geral ≥ 70%" },
  ];
  checklist.forEach((c) => lines.push(`- [${c.ok ? "x" : " "}] ${c.label}`));
  lines.push("");

  if (r.issues.length > 0) {
    lines.push(`## ⚠️ Issues encontradas (${r.issues.length})`);
    const grouped = r.issues.reduce<Record<string, QualityIssue[]>>((acc, i) => {
      (acc[i.sectionTitle] ??= []).push(i);
      return acc;
    }, {});
    Object.entries(grouped).forEach(([sec, items]) => {
      lines.push(`### ${sec}`);
      items.forEach((i) => {
        const tag = i.type === "missing" ? "🔴 Vazio" : "🟡 Raso";
        lines.push(`- ${tag} — ${i.recommendation}`);
      });
      lines.push("");
    });
  }

  if (r.suggestions.length > 0) {
    lines.push(`## 💡 Recomendações de melhoria`);
    r.suggestions.forEach((s) => lines.push(`- ${s}`));
    lines.push("");
  }

  return { filename: `relatorio-${slug}.md`, content: lines.join("\n") };
}

// Validação isolada do Mapa da Empatia para uso em UI (ex.: bloquear envio à IA)
export function validateEmpathyMap(data: Record<string, string>): {
  ok: boolean;
  errors: { field: string; label: string; current: number; min: number }[];
} {
  const errors = EMPATHY_FIELDS
    .map((f) => ({ field: f.id, label: f.label, current: countItems(data[f.id]), min: f.min }))
    .filter((e) => e.current < e.min);
  return { ok: errors.length === 0, errors };
}
