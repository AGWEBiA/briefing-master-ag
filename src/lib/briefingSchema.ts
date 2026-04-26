import {
  Package, Users, Trophy, ClipboardList, Target,
  Ticket, Megaphone, Sprout, Lock, Infinity as InfinityIcon, Handshake, Puzzle,
  HeartHandshake, Zap, ShoppingCart, ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export type FieldType = "text" | "textarea" | "select" | "date" | "radio";

export interface Field {
  id: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  rows?: number;
  options?: string[];
  // Permite trocar `options` em runtime com base nos valores atuais do briefing
  optionsFn?: (data: Record<string, string>) => string[];
}

export interface SectionGroup {
  label?: string;
  fields?: Field[];
}

export interface Section {
  id: string;
  title: string;
  icon: LucideIcon;
  groups: SectionGroup[];
}

export type StrategyId =
  | "lp" | "lo" | "ls" | "li" | "pe" | "af" | "cp" | "vd";

export interface Strategy {
  id: StrategyId;
  name: string;
  emoji: string;
  description: string;
  tags: string[];
  sections: Section[];
}

// ============ Fixed sections ============
export const FIXED_SECTIONS: Section[] = [
  {
    id: "identidade",
    title: "Identidade do Produto",
    icon: Package,
    groups: [{
      fields: [
        { id: "nomeProduto", label: "Nome do Produto", type: "text", required: true, placeholder: "Ex: Método Tráfego Avançado" },
        { id: "nicho", label: "Nicho de Mercado", type: "text", required: true, placeholder: "Ex: Marketing Digital, Emagrecimento..." },
        { id: "categoriaProduto", label: "Categoria do Produto", type: "select", options: ["Curso Online", "Mentoria", "Consultoria", "Evento/Workshop", "Assinatura/Comunidade", "E-book/Material Digital", "Software/Ferramenta"] },
        { id: "formatoEntrega", label: "Formato de Entrega", type: "select",
          options: ["Online ao Vivo", "Gravado/Assíncrono", "Híbrido", "Presencial"],
          hint: "As opções mudam automaticamente quando a categoria for Software/Ferramenta.",
          optionsFn: (d) => d.categoriaProduto === "Software/Ferramenta"
            ? ["SaaS (Web)", "App Mobile (iOS/Android)", "Aplicativo Desktop", "API / Backend", "Plugin / Extensão", "On-premise / Self-hosted", "Híbrido (Web + App)"]
            : ["Online ao Vivo", "Gravado/Assíncrono", "Híbrido", "Presencial"],
        },
        { id: "transformacaoPrincipal", label: "Transformação Principal", type: "textarea", rows: 3, required: true, hint: "Qual é o resultado final que o cliente alcança?" },
        { id: "tempoResultado", label: "Tempo para Ver o Resultado", type: "text", placeholder: "Ex: 30 dias, 3 meses..." },
        { id: "precoProduto", label: "Preço do Produto Principal", type: "text", required: true, placeholder: "R$ 1.997,00" },
        { id: "garantia", label: "Garantia Oferecida", type: "text", placeholder: "Ex: 7 dias incondicional..." },
      ],
    }],
  },
  {
    id: "avatar",
    title: "Público-Alvo (Avatar)",
    icon: Users,
    groups: [
      { fields: [{ id: "descricaoAvatar", label: "Descrição Detalhada do Cliente Ideal", type: "textarea", rows: 4, required: true, hint: "Idade, profissão, situação atual, comportamento..." }] },
      { label: "3 Maiores Dores", fields: [
        { id: "dor1", label: "Dor #1", type: "text", required: true },
        { id: "dor2", label: "Dor #2", type: "text" },
        { id: "dor3", label: "Dor #3", type: "text" },
      ]},
      { label: "3 Maiores Desejos", fields: [
        { id: "desejo1", label: "Desejo #1", type: "text", required: true },
        { id: "desejo2", label: "Desejo #2", type: "text" },
        { id: "desejo3", label: "Desejo #3", type: "text" },
      ]},
      { label: "3 Principais Objeções", fields: [
        { id: "objecao1", label: "Objeção #1", type: "text", required: true },
        { id: "objecao2", label: "Objeção #2", type: "text" },
        { id: "objecao3", label: "Objeção #3", type: "text" },
      ]},
      { fields: [
        { id: "nivelConsciencia", label: "Nível de Consciência do Avatar", type: "select", hint: "Quão consciente ele está do problema e da solução?", options: ["Inconsciente", "Consciente do problema", "Consciente da solução", "Consciente do produto", "Mais consciente"] },
        { id: "canaisOnline", label: "Canais Online Principais", type: "text", placeholder: "Ex: Instagram, YouTube, LinkedIn..." },
      ]},
      { label: "Resumo do Mapa da Empatia", fields: [
        { id: "empatiaResumo", label: "Síntese do Mapa da Empatia", type: "textarea", rows: 3, hint: "Breve resumo de quem é seu avatar com base nos 6 quadrantes (preencha em detalhe na seção 'Mapa da Empatia')." },
      ]},
    ],
  },
  {
    id: "mapaEmpatia",
    title: "Mapa da Empatia",
    icon: HeartHandshake,
    groups: [
      { fields: [
        { id: "me_ve", label: "👀 O que VÊ?",
          type: "textarea", rows: 4,
          placeholder: "Ex.: Concorrentes posando de bem-sucedidos no Instagram, anúncios de cursos prometendo 6 dígitos, amigos viajando e comprando o que ele ainda não pode, feeds cheios de 'método infalível'...",
          hint: "Estímulos visuais do cotidiano (Xplane/Dave Gray). Responda: Como é o mundo em que ele vive? Como são os amigos? O que vê os concorrentes oferecendo? Que conteúdos consome (TV, redes, sites)? Que ofertas aparecem na frente dele? Mínimo 3 itens concretos do ambiente pessoal e profissional." },
        { id: "me_ouve", label: "👂 O que OUVE?",
          type: "textarea", rows: 4,
          placeholder: "Ex.: Família dizendo 'arruma emprego de verdade', podcasts de empreendedorismo, gurus prometendo escala rápida, parceiro(a) cobrando estabilidade, líderes religiosos pregando paciência...",
          hint: "Vozes e influências (não só som). Responda: Quais pessoas e ideias o influenciam? Quem são seus ídolos? Quais marcas favoritas? Que produtos de comunicação consome (podcasts, canais, comunidades)? O que dizem amigos, família, chefe e liderados? Indique apoio, pressão ou ruído. Mínimo 3 fontes." },
        { id: "me_pensaSente", label: "🧠 O que PENSA e SENTE?",
          type: "textarea", rows: 4,
          placeholder: "Ex.: 'Preciso provar que dá certo antes que zombem de mim', sente-se atrasado em relação a quem começou junto, sonha em sair do CLT mas tem medo de perder estabilidade...",
          hint: "Mundo interior — ambiente emocional. Responda: Como ele se sente em relação ao mundo? Quais suas preocupações reais? Quais seus sonhos e aspirações? Que crenças limitantes carrega? Inclua sentimentos que NÃO admite em voz alta. Mínimo 3 frases concretas." },
        { id: "me_falaFaz", label: "💬 O que FALA e FAZ?",
          type: "textarea", rows: 4,
          placeholder: "Ex.: Posta prints de faturamento mesmo em meses ruins, consome conteúdo gratuito o tempo todo mas raramente compra, fala que vai começar 'segunda-feira', troca de método a cada semana...",
          hint: "Atitude pública e comportamento (discurso x prática). Responda: Sobre o que costuma falar? Como age no dia a dia? Como se veste e se apresenta? Quais hobbies tem? Onde aparecem contradições entre o que diz e o que faz? Mínimo 3 comportamentos específicos." },
        { id: "me_dores", label: "😣 DORES (medos, frustrações, obstáculos)",
          type: "textarea", rows: 4,
          placeholder: "Ex.: Medo de investir e não ter retorno, frustração com cursos que prometem demais, falta de tempo entre CLT e projeto pessoal, vergonha de pedir ajuda...",
          hint: "Dúvidas e obstáculos para consumir a solução. Responda: Do que ele tem medo? Quais suas maiores frustrações hoje? Que obstáculos precisa superar para conseguir o que deseja (tempo, dinheiro, conhecimento, suporte, autoestima)? Que riscos ele percebe ao decidir comprar? Mínimo 4 itens concretos." },
        { id: "me_ganhos", label: "🏆 GANHOS / NECESSIDADES (critérios de sucesso)",
          type: "textarea", rows: 4,
          placeholder: "Ex.: Faturar R$ 10k/mês de forma previsível em 12 meses, sair do CLT, ser reconhecido como autoridade no nicho, viajar trabalhando do notebook, ter orgulho da própria trajetória...",
          hint: "O que ele realmente quer alcançar. Responda: O que é sucesso para ele? Onde quer chegar? O que acabaria com seus problemas? Inclua ganhos tangíveis (dinheiro, tempo, métricas com prazo) e intangíveis (orgulho, status, reconhecimento, paz). Mínimo 4 itens." },
      ]},
    ],
  },
  {
    id: "posicionamento",
    title: "Posicionamento e Autoridade",
    icon: Trophy,
    groups: [{
      fields: [
        { id: "nomeExpert", label: "Nome do Expert / Produtor", type: "text", required: true },
        { id: "audienciaAtual", label: "Audiência Atual", type: "text", placeholder: "Ex: 50k Instagram, 5k lista de e-mail" },
        { id: "historiaTransformacao", label: "História de Transformação do Expert", type: "textarea", rows: 4, hint: "Qual foi a jornada do expert? De onde veio, o que superou, onde chegou?" },
        { id: "provasSociais", label: "Provas Sociais Disponíveis", type: "textarea", rows: 3, hint: "Depoimentos, cases, números, prêmios, menções na mídia..." },
        { id: "diferenciais", label: "Diferenciais frente à Concorrência", type: "textarea", rows: 3, hint: "O que torna este produto único?" },
      ],
    }],
  },
  {
    id: "estrutura",
    title: "Estrutura do Produto",
    icon: ClipboardList,
    groups: [{
      fields: [
        { id: "modulosPrincipais", label: "Módulos / Conteúdos Principais", type: "textarea", rows: 5, required: true, hint: "Liste os principais módulos ou temas abordados" },
        { id: "bonusIncluidos", label: "Bônus Incluídos", type: "textarea", rows: 4, hint: "Liste todos os bônus que acompanham o produto" },
        { id: "suporteOferecido", label: "Suporte Oferecido", type: "text", placeholder: "Ex: Suporte por e-mail, grupo no Telegram..." },
        { id: "plataformaEntrega", label: "Plataforma de Entrega do Produto", type: "text", placeholder: "Ex: Hotmart, Kiwify, área de membros própria..." },
      ],
    }],
  },
  {
    id: "estrategia",
    title: "Estratégia e Metas",
    icon: Target,
    // Note: a parte de seleção de estratégia é renderizada à parte (StrategyPicker)
    groups: [
      { label: "Datas e Metas", fields: [
        { id: "dataInicio", label: "Data de Início", type: "date" },
        { id: "dataEncerramento", label: "Data de Encerramento / Abertura de Carrinho", type: "date" },
        { id: "metaFaturamento", label: "Meta de Faturamento Total", type: "text", required: true, placeholder: "R$ 100.000,00" },
        { id: "orcamentoTrafego", label: "Orçamento para Tráfego Pago", type: "text", placeholder: "R$ 20.000,00" },
      ]},
      { label: "Equipe", fields: [
        { id: "gestorTrafego", label: "Gestor de Tráfego", type: "radio", options: ["Tenho", "Eu mesmo", "Preciso"] },
        { id: "copywriter", label: "Copywriter", type: "radio", options: ["Tenho", "Eu mesmo", "Preciso"] },
        { id: "designer", label: "Designer", type: "radio", options: ["Tenho", "Eu mesmo", "Preciso"] },
      ]},
      { label: "Ferramentas", fields: [
        { id: "plataformaCheckout", label: "Plataforma de Checkout", type: "text", placeholder: "Hotmart, Kiwify, Eduzz..." },
        { id: "ferramentaEmail", label: "Ferramenta de E-mail", type: "text", placeholder: "ActiveCampaign, RD Station..." },
        { id: "plataformaEvento", label: "Plataforma do Evento", type: "text", placeholder: "Zoom, YouTube, Área de membros..." },
      ]},
    ],
  },
];

// ============ Strategies ============
export const STRATEGIES: Strategy[] = [
  {
    id: "lp", name: "Lançamento Pago", emoji: "🎟️",
    description: "Inscrição paga para evento, workshop ou imersão. O público paga para participar do CPL.",
    tags: ["Evento", "Ingresso", "Workshop", "Imersão"],
    sections: [
      { id: "lp_evento", title: "O Evento Pago", icon: Ticket, groups: [{ fields: [
        { id: "lp_nomeEvento", label: "Nome do Evento Pago", type: "text", required: true, placeholder: "Ex: Workshop de Tráfego Avançado..." },
        { id: "lp_promessaEvento", label: "Grande Promessa do Evento", type: "textarea", rows: 3, required: true, hint: "O que a pessoa sairá sabendo/conseguindo fazer?" },
        { id: "lp_duracaoFormato", label: "Duração e Formato do Evento", type: "text", placeholder: "Ex: 3 dias de lives no Zoom..." },
        { id: "lp_sequenciaEmail", label: "Sequência de E-mails Pós-Compra do Ingresso", type: "textarea", rows: 4, hint: "Como você vai se comunicar com quem comprou o ingresso até o dia do evento?" },
      ]}]},
      { id: "lp_ingressos", title: "Ingressos e Ofertas", icon: Ticket, groups: [{ fields: [
        { id: "lp_precoBasico", label: "Preço do Ingresso Básico", type: "text", required: true, placeholder: "R$ 97,00" },
        { id: "lp_precoVIP", label: "Preço do Ingresso VIP", type: "text", placeholder: "R$ 197,00" },
        { id: "lp_inclusoVIP", label: "O que o Ingresso VIP inclui a mais?", type: "textarea", rows: 3, hint: "Diferenciais do VIP frente ao ingresso básico" },
        { id: "lp_orderBump", label: "Order Bump no Checkout do Ingresso", type: "textarea", rows: 2, hint: "Produto de baixo valor para aumentar o ticket médio" },
        { id: "lp_downsell", label: "Downsell para quem não comprar o Produto Principal", type: "textarea", rows: 2, hint: "O que oferecer para quem participou mas não comprou?" },
      ]}]},
      { id: "lp_pitch", title: "Show-up e Pitch", icon: Target, groups: [{ fields: [
        { id: "lp_estrategiaShowup", label: "Estratégia de Show-up", type: "textarea", rows: 4, hint: "Como você vai garantir que as pessoas apareçam no evento?" },
        { id: "lp_pitchVendas", label: "Pitch de Vendas Planejado", type: "textarea", rows: 4, hint: "Como será a oferta do produto principal durante o evento?" },
      ]}]},
    ],
  },
  {
    id: "lo", name: "Lançamento Orgânico (FL)", emoji: "📣",
    description: "Fórmula de Lançamento com CPLs gratuitos e sequência de pré-lançamento.",
    tags: ["CPL", "Gratuito", "Pré-lançamento", "Carrinho"],
    sections: [
      { id: "lo_cpls", title: "Conteúdos de Pré-Lançamento (CPLs)", icon: Megaphone, groups: [{ fields: [
        { id: "lo_temaCPLs", label: "Tema dos CPLs", type: "textarea", rows: 4, required: true, hint: "Quais assuntos serão abordados em cada CPL?" },
        { id: "lo_numeroCPLs", label: "Número de CPLs Planejados", type: "text", placeholder: "Ex: 3 CPLs" },
        { id: "lo_formatoCPLs", label: "Formato dos CPLs", type: "select", options: ["Vídeo Gravado", "Live/Ao Vivo", "Sequência de E-mail", "Híbrido"] },
        { id: "lo_plataformaCPLs", label: "Plataforma dos CPLs", type: "text", placeholder: "Ex: YouTube, Instagram..." },
      ]}]},
      { id: "lo_captura", title: "Captura e Sequência", icon: Users, groups: [{ fields: [
        { id: "lo_estrategiaCaptura", label: "Estratégia de Captura de Leads", type: "textarea", rows: 3, hint: "Como as pessoas vão se inscrever para assistir aos CPLs?" },
        { id: "lo_sequenciaEmail", label: "Sequência de E-mails do Pré-Lançamento", type: "textarea", rows: 5 },
      ]}]},
      { id: "lo_carrinho", title: "Abertura de Carrinho", icon: Target, groups: [{ fields: [
        { id: "lo_estrategiaCarrinho", label: "Estratégia de Abertura de Carrinho", type: "textarea", rows: 4, hint: "Quais gatilhos e bônus serão usados?" },
        { id: "lo_duracaoCarrinho", label: "Duração do Carrinho Aberto", type: "text", placeholder: "Ex: 7 dias, 5 dias..." },
      ]}]},
    ],
  },
  {
    id: "ls", name: "Lançamento Semente", emoji: "🌱",
    description: "Venda o produto antes de criá-lo. Valide a ideia com uma turma piloto.",
    tags: ["Validação", "Piloto", "Early Bird", "Pré-venda"],
    sections: [
      { id: "ls_validacao", title: "Validação do Produto", icon: Sprout, groups: [{ fields: [
        { id: "ls_ideiacentral", label: "Ideia Central do Produto (ainda não criado)", type: "textarea", rows: 3, required: true },
        { id: "ls_formatoValidacao", label: "Formato de Validação", type: "select", options: ["Grupo Fechado/Turma Piloto", "Pré-venda com entrega futura", "Mentoria em Grupo ao vivo", "Workshop de Validação"] },
        { id: "ls_precoValidacao", label: "Preço de Validação (Early Bird)", type: "text", placeholder: "Ex: R$ 497,00" },
        { id: "ls_minimoVendas", label: "Mínimo de Vendas para Validar", type: "text", placeholder: "Ex: 20 alunos" },
      ]}]},
      { id: "ls_turma", title: "Turma Piloto", icon: Users, groups: [{ fields: [
        { id: "ls_prazoEntrega", label: "Prazo para Entrega do Produto Após Validação", type: "text", placeholder: "Ex: 60 dias após atingir o mínimo" },
      ]}]},
    ],
  },
  {
    id: "li", name: "Lançamento Interno", emoji: "🔒",
    description: "Lançamento exclusivo para a base de leads já existente, sem tráfego frio.",
    tags: ["Base de leads", "Reaquecimento", "E-mail", "Lista"],
    sections: [
      { id: "li_base", title: "Sua Base de Leads", icon: Lock, groups: [{ fields: [
        { id: "li_tamanhoBase", label: "Tamanho da Base de Leads", type: "text", required: true, placeholder: "Ex: 8.000 leads na lista de e-mail" },
        { id: "li_temperaturaBase", label: "Temperatura da Base", type: "select", options: ["Quente (engajada, comprou antes)", "Morna (engaja às vezes)", "Fria (pouco engajamento)", "Mista"] },
        { id: "li_ultimoContato", label: "Último Contato com a Base", type: "text", placeholder: "Ex: Há 3 meses..." },
      ]}]},
      { id: "li_reaq", title: "Reaquecimento e Sequência", icon: Megaphone, groups: [{ fields: [
        { id: "li_reaquecimento", label: "Estratégia de Reaquecimento", type: "textarea", rows: 4, hint: "Como você vai reaquecer a base antes de fazer a oferta?" },
        { id: "li_sequenciaEmail", label: "Sequência de E-mails do Lançamento Interno", type: "textarea", rows: 5 },
      ]}]},
    ],
  },
  {
    id: "pe", name: "Perpétuo / Evergreen", emoji: "♾️",
    description: "Funil automatizado que vende continuamente, sem data de abertura de carrinho.",
    tags: ["Automação", "VSL", "Funil", "Evergreen"],
    sections: [
      { id: "pe_funil", title: "Estrutura do Funil Evergreen", icon: InfinityIcon, groups: [{ fields: [
        { id: "pe_tipoFunil", label: "Tipo de Funil Evergreen", type: "select", required: true, options: ["VSL (Vídeo de Vendas)", "Webinário Gravado", "Carta de Vendas (texto)", "Quiz + Oferta", "Desafio Automatizado"] },
        { id: "pe_upsellDownsell", label: "Upsell / Downsell no Funil", type: "textarea", rows: 3, hint: "Quais ofertas adicionais serão apresentadas?" },
      ]}]},
      { id: "pe_trafego", title: "Automação e Tráfego", icon: Target, groups: [{ fields: [
        { id: "pe_fonteTrafego", label: "Fonte de Tráfego Principal", type: "text", placeholder: "Ex: Meta Ads, Google Ads, YouTube Ads..." },
        { id: "pe_orcamentoMensal", label: "Orçamento Mensal de Tráfego", type: "text", placeholder: "R$ 5.000,00/mês" },
        { id: "pe_metaROAS", label: "Meta de ROAS Mensal", type: "text", placeholder: "Ex: 3x, 5x..." },
        { id: "pe_automacao", label: "Sequência de Automação (e-mail / WhatsApp)", type: "textarea", rows: 5 },
      ]}]},
    ],
  },
  {
    id: "af", name: "Estratégia de Afiliados", emoji: "🤝",
    description: "Recrutamento e ativação de afiliados para amplificar as vendas do produto.",
    tags: ["Afiliados", "Comissão", "Recrutamento", "Parceria"],
    sections: [
      { id: "af_programa", title: "Programa de Afiliados", icon: Handshake, groups: [{ fields: [
        { id: "af_comissao", label: "Comissão Oferecida ao Afiliado (%)", type: "text", required: true, placeholder: "Ex: 40%, 50%..." },
        { id: "af_plataformaAfiliados", label: "Plataforma de Afiliados", type: "text", placeholder: "Ex: Hotmart, Kiwify..." },
        { id: "af_recrutamento", label: "Estratégia de Recrutamento de Afiliados", type: "textarea", rows: 4 },
      ]}]},
      { id: "af_materiais", title: "Materiais e Suporte", icon: ClipboardList, groups: [{ fields: [
        { id: "af_materiais", label: "Materiais de Divulgação Disponíveis", type: "textarea", rows: 4, hint: "Quais materiais você vai fornecer para os afiliados?" },
        { id: "af_suporteAfiliados", label: "Suporte e Treinamento para Afiliados", type: "textarea", rows: 3 },
      ]}]},
    ],
  },
  {
    id: "cp", name: "Co-produção", emoji: "🧩",
    description: "Parceria entre expert (conteúdo) e produtor (operação) para lançar o produto.",
    tags: ["Expert", "Produtor", "Parceria", "Divisão"],
    sections: [
      { id: "cp_parceria", title: "Estrutura da Parceria", icon: Puzzle, groups: [{ fields: [
        { id: "cp_papelExpert", label: "Papel do Expert (Conteúdo)", type: "textarea", rows: 3, required: true, hint: "Quais são as responsabilidades do expert?" },
        { id: "cp_papelProdutor", label: "Papel do Produtor (Operação)", type: "textarea", rows: 3, hint: "Quais são as responsabilidades do produtor?" },
        { id: "cp_divisaoReceita", label: "Divisão de Receita Combinada", type: "text", required: true, placeholder: "Ex: 60% expert / 40% produtor" },
        { id: "cp_responsabilidades", label: "Responsabilidades Detalhadas de Cada Parte", type: "textarea", rows: 4 },
      ]}]},
      { id: "cp_estrategia", title: "Estratégia de Lançamento", icon: Target, groups: [{ fields: [
        { id: "cp_estrategiaEscolhida", label: "Estratégia de Lançamento Escolhida para a Co-produção", type: "select", required: true, options: ["Lançamento Pago", "Lançamento Orgânico (FL)", "Lançamento Semente", "Lançamento Interno", "Perpétuo/Evergreen", "Venda Direta"] },
      ]}]},
    ],
  },
  {
    id: "vd", name: "Venda Direta", emoji: "⚡",
    description: "Oferta direta sem evento, CPLs ou aquecimento longo. Tráfego → Página de Vendas (VSL/Carta) → Checkout.",
    tags: ["Direct Response", "VSL", "Página de vendas", "Tráfego pago"],
    sections: [
      { id: "vd_oferta", title: "Oferta e Promessa", icon: Zap, groups: [{ fields: [
        { id: "vd_grandePromessa", label: "Grande Promessa da Oferta", type: "textarea", rows: 3, required: true, hint: "Promessa central + prazo + mecanismo único. Ex.: 'Da estagnação a R$10k/mês em 90 dias com o Método X'." },
        { id: "vd_mecanismoUnico", label: "Mecanismo Único / Diferencial", type: "textarea", rows: 3, hint: "Por que ESSA oferta funciona quando outras falharam?" },
        { id: "vd_urgenciaEscassez", label: "Urgência e Escassez na Oferta", type: "textarea", rows: 2, hint: "Ex.: vagas limitadas, bônus por tempo, condição especial até X..." },
        { id: "vd_garantiaForte", label: "Garantia (Risco Reverso)", type: "text", placeholder: "Ex.: 7 dias incondicional, 30 dias com resultado..." },
      ]}]},
      { id: "vd_pagina", title: "Página de Vendas", icon: ShoppingCart, groups: [{ fields: [
        { id: "vd_tipoPagina", label: "Formato da Página de Vendas", type: "select", required: true, options: ["VSL (Vídeo de Vendas)", "Carta de Vendas (texto longo)", "Híbrida (vídeo + carta)", "Quiz funnel", "Landing curta + checkout"] },
        { id: "vd_headlinePrincipal", label: "Headline Principal", type: "text", required: true, placeholder: "A frase de impacto no topo da página" },
        { id: "vd_subHeadline", label: "Sub-headline / Pré-headline", type: "text", placeholder: "Reforço imediato à promessa" },
        { id: "vd_estruturaCopy", label: "Estrutura da Copy / Roteiro VSL", type: "textarea", rows: 5, hint: "Bloco a bloco: hook → história → problema → solução → prova → oferta → urgência → CTA." },
        { id: "vd_ctaPrincipal", label: "CTA Principal (Botão de Compra)", type: "text", placeholder: "Ex.: 'Quero garantir minha vaga agora'" },
      ]}]},
      { id: "vd_trafego", title: "Tráfego e Funil", icon: Target, groups: [{ fields: [
        { id: "vd_fonteTrafego", label: "Fonte de Tráfego Principal", type: "text", required: true, placeholder: "Meta Ads, Google Ads, YouTube Ads, TikTok..." },
        { id: "vd_orcamentoDiario", label: "Orçamento Diário Inicial", type: "text", placeholder: "R$ 200,00/dia" },
        { id: "vd_metaCPA", label: "Meta de CPA (Custo por Aquisição)", type: "text", placeholder: "Ex.: R$ 250,00" },
        { id: "vd_metaROAS", label: "Meta de ROAS", type: "text", placeholder: "Ex.: 2.5x, 3x..." },
        { id: "vd_anguloCriativo", label: "Ângulos de Criativos para Anúncios", type: "textarea", rows: 4, hint: "Quais ângulos/dores serão testados nos criativos? Liste pelo menos 3." },
      ]}]},
      { id: "vd_checkout", title: "Checkout, Order Bump e Pós-venda", icon: ClipboardList, groups: [{ fields: [
        { id: "vd_orderBump", label: "Order Bump no Checkout", type: "textarea", rows: 2, hint: "Produto complementar barato para aumentar ticket médio." },
        { id: "vd_upsell1", label: "Upsell #1 (após compra principal)", type: "textarea", rows: 2 },
        { id: "vd_downsell", label: "Downsell (se recusar o upsell)", type: "textarea", rows: 2 },
        { id: "vd_recuperacaoCarrinho", label: "Estratégia de Recuperação de Carrinho Abandonado", type: "textarea", rows: 3, hint: "E-mails, WhatsApp, retargeting..." },
        { id: "vd_pagamentoBoleto", label: "Régua de Recuperação de Boleto/PIX", type: "textarea", rows: 2 },
      ]}]},
    ],
  },
];

export const getStrategy = (id?: string | null): Strategy | undefined =>
  STRATEGIES.find((s) => s.id === id);

export const getAllSections = (strategyId?: string | null): Section[] => {
  const strat = getStrategy(strategyId);
  return strat ? [...FIXED_SECTIONS, ...strat.sections] : FIXED_SECTIONS;
};

export const collectFieldIds = (sections: Section[]): string[] =>
  sections.flatMap((s) => s.groups.flatMap((g) => g.fields?.map((f) => f.id) ?? []));

export const isSectionComplete = (
  section: Section,
  data: Record<string, string>,
  strategyId?: string | null,
): boolean => {
  if (section.id === "estrategia" && !strategyId) return false;
  const required = section.groups.flatMap((g) => g.fields?.filter((f) => f.required) ?? []);
  if (required.length === 0) {
    // section considered visited if any field has value
    const ids = collectFieldIds([section]);
    return ids.some((id) => (data[id] ?? "").trim().length > 0);
  }
  return required.every((f) => (data[f.id] ?? "").trim().length > 0);
};
