import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  HelpCircle, Search, Trophy, BarChart2, User, UserCheck,
  Wallet, TrendingUp, Hash, School, Users, UsersRound,
  FlaskConical, Database, Download, Filter, Star,
  Mail, ExternalLink, BookOpen, Lightbulb, Shield,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Módulos da plataforma ──────────────────────────────────────────────────

const modulos = [
  {
    icon: Trophy,
    title: 'Ranking & Resultados',
    url: '/',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    desc: 'Veja todos os candidatos ordenados por votos. Filtre por cargo, partido ou município. Clique em qualquer candidato para ver o perfil completo.',
  },
  {
    icon: BarChart2,
    title: 'Relatório de Votação',
    url: '/relatorio',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    desc: 'Análise detalhada dos votos por zona eleitoral, seção e comparativo entre turnos. Ideal para entender o desempenho geográfico.',
  },
  {
    icon: User,
    title: 'Perfil de Candidatos',
    url: '/candidatos',
    color: 'text-primary',
    bg: 'bg-primary/10',
    desc: 'Ficha completa de cada candidato: dados pessoais, bens declarados, histórico de eleições anteriores, financiamento e redes sociais.',
  },
  {
    icon: UserCheck,
    title: 'Suplentes',
    url: '/suplentes',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    desc: 'Liste e marque suplentes por cidade. Use a estrela (★) para criar uma lista personalizada. Dados de 2014 a 2024.',
  },
  {
    icon: Wallet,
    title: 'Financiamento',
    url: '/financiamento',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    desc: 'Receitas e despesas declaradas ao TSE por candidato. Identifique maiores doadores e padrões de gasto por partido.',
  },
  {
    icon: TrendingUp,
    title: 'Força por Zona',
    url: '/forca-zona',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    desc: 'Calcula o "índice de força" de cada partido por zona eleitoral, revelando territórios de influência e domínio político.',
  },
  {
    icon: Hash,
    title: 'Zonas Eleitorais',
    url: '/zonas',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    desc: 'Distribuição de votos por zona. Use os filtros de zona e bairro para detalhar até seção eleitoral.',
  },
  {
    icon: School,
    title: 'Locais de Votação',
    url: '/escolas',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
    desc: 'Todas as escolas e locais de votação cadastrados, com quantidade de seções, eleitores e endereço.',
  },
  {
    icon: Users,
    title: 'Mesários por Seção',
    url: '/mesarios',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    desc: 'Relação de mesários por seção eleitoral. Útil para validar escalas e identificar voluntários recorrentes.',
  },
  {
    icon: UsersRound,
    title: 'Eleitorado',
    url: '/eleitorado',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    desc: 'Perfil do eleitorado: distribuição por faixa etária, gênero, grau de instrução e situação eleitoral.',
  },
  {
    icon: FlaskConical,
    title: 'Pesquisas Eleitorais',
    url: '/pesquisas',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    desc: 'Registro oficial de pesquisas eleitorais do TSE para 2024. Inclui instituto, metodologia e contratantes.',
  },
];

// ── FAQs agrupados ────────────────────────────────────────────────────────

const faqs = [
  {
    category: 'Dados & Fontes',
    icon: Database,
    items: [
      {
        q: 'De onde vêm os dados?',
        a: 'Todos os dados são do Portal de Dados Abertos do TSE (dadosabertos.tse.jus.br). São dados oficiais, públicos e gratuitos, processados e indexados para consulta em tempo real.',
      },
      {
        q: 'Quais eleições estão disponíveis?',
        a: 'Estão disponíveis: 2014, 2016, 2018, 2020, 2022 e 2024. Eleições municipais (2016, 2020, 2024) contêm prefeitos e vereadores. Eleições gerais (2014, 2018, 2022) contêm governadores, senadores, deputados federais e estaduais.',
      },
      {
        q: 'Com que frequência os dados são atualizados?',
        a: 'Para eleições já encerradas os dados são definitivos (resultado oficial TSE). Para eleições em andamento, os dados são atualizados conforme liberação pelo TSE, normalmente em lotes após o pleito.',
      },
      {
        q: 'Por que alguns candidatos não têm foto?',
        a: 'Nem todos os candidatos enviaram foto ao TSE. Nesses casos exibimos o avatar com a inicial do nome. As fotos disponíveis vêm diretamente do repositório de imagens do TSE.',
      },
      {
        q: 'Os dados de bens declarados são confiáveis?',
        a: 'São os valores exatamente como declarados ao TSE pelo candidato. A veracidade e completude da declaração é responsabilidade do candidato. Inconsistências podem ser reportadas à Justiça Eleitoral.',
      },
    ],
  },
  {
    category: 'Filtros & Navegação',
    icon: Filter,
    items: [
      {
        q: 'Como usar os filtros globais?',
        a: 'A barra de filtros no topo é global e afeta todas as páginas. Selecione Ano, Município e demais filtros disponíveis para cada módulo. Os filtros são persistidos entre navegações na sessão.',
      },
      {
        q: 'Posso filtrar por partido específico?',
        a: 'Sim. No filtro global "Partido", selecione a sigla desejada. Também é possível buscar candidatos de um partido específico digitando a sigla no campo de busca.',
      },
      {
        q: 'Como ver dados de outro município?',
        a: 'Clique no campo "Município" na barra de filtros e comece a digitar o nome da cidade. O autocomplete mostrará todas as cidades disponíveis para o ano selecionado.',
      },
      {
        q: 'Posso ver dados de mais de um município ao mesmo tempo?',
        a: 'Atualmente o filtro suporta um município por vez. Para análises comparativas entre municípios, use o módulo Exportar CSV e compare as planilhas externamente.',
      },
    ],
  },
  {
    category: 'Exportação & Relatórios',
    icon: Download,
    items: [
      {
        q: 'Como exportar os dados para Excel?',
        a: 'Nas páginas de Ranking e Relatório há um botão "Exportar CSV" no canto superior direito da tabela. O arquivo .csv pode ser aberto diretamente no Excel, Google Sheets ou LibreOffice.',
      },
      {
        q: 'Quais dados são incluídos no CSV exportado?',
        a: 'O CSV do Ranking inclui: posição, candidato, número, partido, cargo, município, total de votos, percentual e situação eleitoral. Para dados completos de financiamento, use o módulo Financiamento.',
      },
    ],
  },
  {
    category: 'Suplentes',
    icon: Star,
    items: [
      {
        q: 'O que é a lista de suplentes?',
        a: 'A lista de suplentes é uma ferramenta pessoal para marcar e acompanhar candidatos classificados como SUPLENTE. Clique na estrela (★) ao lado de qualquer suplente para adicionar à sua lista.',
      },
      {
        q: 'A lista de suplentes é salva?',
        a: 'A lista é salva localmente no navegador (localStorage). Ela persiste entre sessões no mesmo dispositivo, mas não é sincronizada entre dispositivos diferentes.',
      },
      {
        q: 'Como buscar suplentes de uma cidade específica?',
        a: 'Na página Ranking, clique em "Buscar suplentes por cidade". Digite o nome da cidade e selecione o ano da eleição. Serão listados todos os candidatos classificados como SUPLENTE naquele pleito.',
      },
    ],
  },
  {
    category: 'Conta & Acesso',
    icon: Shield,
    items: [
      {
        q: 'Meus dados de acesso são seguros?',
        a: 'Sim. A autenticação utiliza Supabase Auth com criptografia bcrypt para senhas. Nenhuma senha é armazenada em texto claro. A sessão expira automaticamente por inatividade.',
      },
      {
        q: 'Como mudar minha senha?',
        a: 'Acesse Configurações > Conta e use a opção "Alterar senha". Será enviado um link de redefinição para o e-mail cadastrado.',
      },
    ],
  },
];

// ── Dicas rápidas ─────────────────────────────────────────────────────────

const dicas = [
  { text: 'Clique em qualquer candidato na tabela para ver o perfil completo com histórico, bens e financiamento.', icon: ChevronRight },
  { text: 'Passe o mouse sobre uma linha no Ranking para pré-carregar os dados de bens — o perfil abre instantaneamente.', icon: ChevronRight },
  { text: 'Use o atalho de suplentes (★) para montar uma lista de acompanhamento antes de uma eleição suplementar.', icon: ChevronRight },
  { text: 'No filtro de município, basta digitar as primeiras letras — o autocomplete cobre todos os 246 municípios de Goiás.', icon: ChevronRight },
  { text: 'Exporte o CSV e use tabela dinâmica no Excel para análises personalizadas de financiamento vs. votos.', icon: ChevronRight },
];

// ── Componente principal ──────────────────────────────────────────────────

export default function Ajuda() {
  const [search, setSearch] = useState('');

  const filteredFaqs = faqs.map(group => ({
    ...group,
    items: group.items.filter(
      item =>
        !search ||
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(g => g.items.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Central de Ajuda</h1>
            <p className="text-xs text-muted-foreground">Guia completo da plataforma SETPOLITIC</p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar nas perguntas frequentes…"
          className="pl-9 h-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Módulos — só aparece sem busca ativa */}
      {!search && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Módulos da Plataforma</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            {modulos.map(m => (
              <Link
                key={m.url}
                to={m.url}
                className="group flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all"
              >
                <div className={cn('w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5', m.bg)}>
                  <m.icon className={cn('w-4 h-4', m.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors flex items-center gap-1">
                    {m.title}
                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{m.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Dicas rápidas — só aparece sem busca ativa */}
      {!search && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h2 className="text-sm font-semibold">Dicas Rápidas</h2>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 space-y-2">
            {dicas.map((d, i) => (
              <div key={i} className="flex items-start gap-2">
                <d.icon className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-foreground/80 leading-relaxed">{d.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Separator />

      {/* FAQs */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">
            Perguntas Frequentes
            {search && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                {filteredFaqs.reduce((s, g) => s + g.items.length, 0)} resultado{filteredFaqs.reduce((s, g) => s + g.items.length, 0) !== 1 ? 's' : ''}
              </Badge>
            )}
          </h2>
        </div>

        {filteredFaqs.length === 0 && (
          <div className="text-center py-10 text-muted-foreground text-sm">
            Nenhuma pergunta encontrada para "<span className="font-medium text-foreground">{search}</span>".
          </div>
        )}

        {filteredFaqs.map(group => (
          <div key={group.category} className="space-y-1">
            <div className="flex items-center gap-1.5 mb-2">
              <group.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.category}
              </span>
            </div>
            <Accordion type="single" collapsible className="space-y-1.5">
              {group.items.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`${group.category}-${i}`}
                  className="bg-card rounded-lg border border-border/50 px-4"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-3">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-3">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </section>

      <Separator />

      {/* Fonte dos dados */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Fonte dos Dados</h2>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-4 h-4 text-success mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Tribunal Superior Eleitoral (TSE)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Todos os dados eleitorais são provenientes do Portal de Dados Abertos do TSE —
                fonte oficial da Justiça Eleitoral Brasileira. Base histórica de 2014 a 2024,
                com mais de 1.200 tabelas indexadas.
              </p>
            </div>
          </div>
          <a
            href="https://dadosabertos.tse.jus.br"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            dadosabertos.tse.jus.br
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </section>

      {/* Contato */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Suporte</h2>
        </div>
        <div className="bg-card rounded-lg border border-border/50 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Não encontrou o que precisava?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Entre em contato com a nossa equipe para suporte técnico ou comercial.
            </p>
          </div>
          <a
            href="mailto:suporte@setpolitic.com"
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail className="w-3.5 h-3.5" />
            Enviar e-mail
          </a>
        </div>
      </section>

    </div>
  );
}
