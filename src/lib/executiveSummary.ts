import { getStrategy, type StrategyId } from "./briefingSchema";

const v = (s?: string) => (s ?? "").trim();
const has = (s?: string) => v(s).length > 0;

const line = (label: string, value?: string, fallback = "_não informado_") =>
  `**${label}:** ${has(value) ? v(value) : fallback}`;

const bullet = (value?: string, fallback = "_não informado_") =>
  `- ${has(value) ? v(value) : fallback}`;

const listFrom = (value?: string): string[] => {
  if (!has(value)) return [];
  return v(value)
    .split(/[\n;]+|,\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
};

const joinList = (items: string[], fallback = "_não informado_") =>
  items.length === 0 ? fallback : items.map((i) => `- ${i}`).join("\n");

export interface ExecutiveSummaryOptions {
  strategyId?: StrategyId | null;
}

/**
 * Gera um resumo executivo em Markdown pronto para copiar/colar.
 * Inclui Big Idea, Tom de Voz, Anti-comunicação e Mapa de Riscos.
 */
export function buildExecutiveSummary(
  data: Record<string, string>,
  { strategyId }: ExecutiveSummaryOptions = {},
): string {
  const strat = getStrategy(strategyId ?? null);
  const now = new Date().toLocaleString("pt-BR");
  const productName = v(data.nomeProduto) || "(produto sem nome)";
  const expert = v(data.nomeExpert) || "_expert não informado_";

  const dores = [data.dor1, data.dor2, data.dor3].filter(has);
  const desejos = [data.desejo1, data.desejo2, data.desejo3].filter(has);
  const objecoes = [data.objecao1, data.objecao2, data.objecao3].filter(has);

  const riscos = listFrom(data.riscosPrincipais);
  const mitigacoes = listFrom(data.planoMitigacao);
  const naoComunicar = listFrom(data.naoComunicar);
  const tomDeVoz = listFrom(data.tomDeVoz);

  const out: string[] = [];

  out.push(`# 📋 Resumo Executivo — ${productName}`);
  out.push(`_Gerado em ${now}_`);
  out.push("");

  // 1. Visão Geral
  out.push(`## 1. Visão Geral`);
  out.push(line("Produto", data.nomeProduto));
  out.push(line("Expert", data.nomeExpert));
  out.push(line("Nicho", data.nicho));
  out.push(line("Categoria", data.categoriaProduto));
  out.push(line("Formato", data.formatoEntrega));
  out.push(line("Estratégia", strat ? `${strat.emoji} ${strat.name}` : undefined, "_não selecionada_"));
  out.push(line("Transformação principal", data.transformacaoPrincipal));
  out.push("");

  // 2. Oferta
  out.push(`## 2. Oferta e Metas`);
  out.push(line("Preço principal", data.precoProduto));
  out.push(line("Preço de ancoragem", data.precoAncoragem));
  out.push(line("Garantia", data.garantia));
  out.push(line("Carga horária", data.cargaHoraria));
  out.push(line("Upsell", data.upsellBase));
  out.push(line("Downsell", data.downsellBase));
  out.push(line("Meta 30 dias", data.metaVendas30d));
  out.push(line("Meta de faturamento", data.metaFaturamento));
  out.push(line("Orçamento de tráfego", data.orcamentoTrafego));
  out.push("");

  // 3. Avatar
  out.push(`## 3. Avatar (Cliente Ideal)`);
  out.push(has(data.descricaoAvatar) ? v(data.descricaoAvatar) : "_não informado_");
  out.push("");
  out.push(`**Top 3 Dores:**`);
  out.push(joinList(dores));
  out.push("");
  out.push(`**Top 3 Desejos:**`);
  out.push(joinList(desejos));
  out.push("");
  out.push(`**Top 3 Objeções:**`);
  out.push(joinList(objecoes));
  out.push("");
  out.push(line("Nível de consciência", data.nivelConsciencia));
  out.push(line("Canais principais", data.canaisOnline));
  out.push("");

  // 4. Posicionamento
  out.push(`## 4. Posicionamento e Mensagem`);
  out.push(`### 💡 Big Idea`);
  out.push(has(data.bigIdea) ? `> ${v(data.bigIdea).replace(/\n/g, "\n> ")}` : "_não definida_");
  out.push("");
  out.push(`### 🎙️ Tom de Voz`);
  out.push(joinList(tomDeVoz, "_não definido_"));
  out.push("");
  out.push(`### 🚫 Anti-comunicação (o que NÃO comunicar)`);
  out.push(joinList(naoComunicar, "_não definido_"));
  out.push("");
  out.push(`### 🏆 Diferenciais`);
  out.push(has(data.diferenciais) ? v(data.diferenciais) : "_não informados_");
  out.push("");
  out.push(`### 🤝 Provas Sociais`);
  out.push(has(data.provasSociais) ? v(data.provasSociais) : "_não informadas_");
  out.push("");

  // 5. Autoridade do Expert
  out.push(`## 5. Autoridade do Expert`);
  out.push(line("Nome", data.nomeExpert));
  out.push(line("Audiência", data.audienciaAtual));
  out.push(line("Formação", data.formacaoExpert));
  out.push(line("Certificações", data.certificacoesExpert));
  out.push(line("Mecanismo único", data.mecanismoUnicoExpert));
  out.push(line("Cases reais", data.expertCasesReais));
  out.push(line("Depoimentos", data.expertDepoimentos));
  out.push(line("Já ensinou esse público", data.expertJaEnsinou));
  out.push(line("Autoridade no nicho", data.expertAutoridadeNicho));
  out.push("");

  // 6. Riscos
  out.push(`## 6. ⚠️ Mapa de Riscos & Viabilidade`);
  out.push(`### Principais Riscos`);
  out.push(joinList(riscos, "_não mapeados_"));
  out.push("");
  out.push(`### Plano de Mitigação`);
  out.push(joinList(mitigacoes, "_não definido_"));
  out.push("");
  out.push(`### Pontos Fortes`);
  out.push(has(data.pontosFortes) ? v(data.pontosFortes) : "_não informados_");
  out.push("");
  out.push(`### Desafios Críticos`);
  out.push(has(data.desafiosProjeto) ? v(data.desafiosProjeto) : "_não informados_");
  out.push("");
  out.push(`**Validação:** Produto ${v(data.checkProdutoValidado) || "?"} · Oferta ${v(data.checkOfertaValidada) || "?"} · Estratégia ${v(data.checkEstrategiaDefinida) || "?"}`);
  out.push("");

  // 7. Estratégia ativa (se houver)
  if (strat) {
    out.push(`## 7. Estratégia Ativa: ${strat.emoji} ${strat.name}`);
    out.push(`_${strat.description}_`);
    const stratFields = strat.sections.flatMap((s) =>
      s.groups.flatMap((g) => g.fields ?? []),
    );
    const filled = stratFields.filter((f) => has(data[f.id]));
    if (filled.length > 0) {
      out.push("");
      out.push(`**Campos preenchidos da estratégia:**`);
      filled.slice(0, 8).forEach((f) => {
        const text = v(data[f.id]);
        const short = text.length > 200 ? text.slice(0, 200) + "…" : text;
        out.push(`- **${f.label}:** ${short}`);
      });
      if (filled.length > 8) {
        out.push(`- _+ ${filled.length - 8} outro(s) campo(s) preenchido(s)._`);
      }
    } else {
      out.push("");
      out.push("_Nenhum campo da estratégia preenchido ainda._");
    }
    out.push("");
  }

  out.push(`---`);
  out.push(`_Resumo gerado automaticamente — pronto para copiar/colar em apresentações, Notion, Slack ou e-mail._`);

  return out.join("\n");
}
