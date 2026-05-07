import { formatBRL, traduzirSituacao } from './eleicoes';

interface CandidatoData {
  candidato: string;
  nome_completo?: string;
  partido: string;
  nome_partido?: string;
  cargo: string;
  municipio?: string;
  numero?: string | number;
  situacao?: string;
  genero?: string;
  escolaridade?: string;
  ocupacao?: string;
  estado_civil?: string;
  cor_raca?: string;
  uf_nascimento?: string;
  data_nascimento?: string;
}

interface EscolaRow { bairro: string; escola: string; votos: number; secoes: number; }
interface ZonaAgregada { zona: string; municipio: string; votos: number; escolas: EscolaRow[]; }
type AnyRow = Record<string, any>;

const NI = 'NÃO INFORMADO';

function fmtN(v: number) { return v.toLocaleString('pt-BR'); }
function pct(part: number, total: number) { return total > 0 ? `${((part / total) * 100).toFixed(1)}%` : '—'; }
function ni(v: string) { return !v || v === NI ? '—' : v; }
function hasName(v: string) { return !!v && v !== NI; }

function agregaZonas(dados: AnyRow[]): ZonaAgregada[] {
  const map = new Map<string, ZonaAgregada>();
  for (const r of dados) {
    const z = String(r.zona || '?');
    if (!map.has(z)) map.set(z, { zona: z, municipio: String(r.municipio || ''), votos: 0, escolas: [] });
    const agg = map.get(z)!;
    agg.votos += Number(r.total_votos || 0);
    agg.escolas.push({
      bairro: String(r.bairro || NI),
      escola: String(r.escola || NI),
      votos:  Number(r.total_votos || 0),
      secoes: Number(r.secoes || 0),
    });
  }
  for (const agg of map.values()) agg.escolas.sort((a, b) => b.votos - a.votos);
  return [...map.values()].sort((a, b) => b.votos - a.votos);
}

export function exportarPDF(params: {
  candidato: CandidatoData;
  ano: number;
  composicao: AnyRow[];
  historico: AnyRow[];
  bens: AnyRow[];
  patrimonioTotal: number;
  receitas: AnyRow[];
}) {
  const { candidato, ano, composicao, historico, bens, patrimonioTotal, receitas } = params;

  const totalVotos = composicao.reduce((s, r) => s + Number(r.total_votos || 0), 0);
  const zonas = agregaZonas(composicao);
  const sit = traduzirSituacao(candidato.situacao || '');

  const sitClass = (() => {
    const s = (candidato.situacao || '').toUpperCase();
    if (s.includes('ELEIT') && !s.includes('NÃO')) return 'badge-green';
    if (s.includes('TURNO')) return 'badge-blue';
    if (s.includes('NÃO ELEIT')) return 'badge-red';
    return 'badge-gray';
  })();

  /* ── Composição: oculta sub-linhas sem nome de escola/bairro ── */
  const composicaoHTML = zonas.length === 0
    ? '<p class="empty">Dados de votação não disponíveis.</p>'
    : `
    <table class="vote-table">
      <thead>
        <tr>
          <th style="width:26px">#</th>
          <th>Zona / Local de Votação</th>
          <th>Município / Bairro</th>
          <th class="r" style="width:58px">Votos</th>
          <th class="r" style="width:52px">% Total</th>
        </tr>
      </thead>
      <tbody>
        ${zonas.map((z, zi) => {
          // Exibe apenas escolas com nome identificado
          const loc = z.escolas.filter(e => hasName(e.escola) || hasName(e.bairro));
          const semID = z.votos - loc.reduce((s, e) => s + e.votos, 0);
          return `
            <tr class="zona-row">
              <td class="idx">${zi + 1}</td>
              <td><strong>Zona ${z.zona}</strong>${loc.length > 0 ? ` <span class="cnt">· ${loc.length} local${loc.length !== 1 ? 'is' : ''}</span>` : ''}</td>
              <td>${z.municipio}</td>
              <td class="r mono bold">${fmtN(z.votos)}</td>
              <td class="r mono">${pct(z.votos, totalVotos)}</td>
            </tr>
            ${loc.map((e, ei) => `
              <tr class="escola-row">
                <td class="idx muted">${zi + 1}.${ei + 1}</td>
                <td class="escola-name pl10">${hasName(e.escola) ? e.escola : '<em class="muted">Sem nome</em>'}</td>
                <td class="muted">${hasName(e.bairro) ? e.bairro : '—'}</td>
                <td class="r mono">${fmtN(e.votos)}</td>
                <td class="r mono muted">${pct(e.votos, totalVotos)}</td>
              </tr>
            `).join('')}
            ${semID > 0 && loc.length > 0 ? `
              <tr class="escola-row">
                <td class="idx muted">${zi + 1}.*</td>
                <td class="muted pl10" colspan="2"><em>Seções sem local identificado</em></td>
                <td class="r mono muted">${fmtN(semID)}</td>
                <td class="r mono muted">${pct(semID, totalVotos)}</td>
              </tr>
            ` : ''}
          `;
        }).join('')}
      </tbody>
    </table>`;

  /* ── Histórico ── */
  const histHTML = historico.length === 0 ? '' : `
    <section>
      <h2>Vida Política</h2>
      <table class="vote-table">
        <thead><tr><th>Ano</th><th>Cargo</th><th>Município</th><th>Partido</th><th>Situação</th><th class="r">Votos</th></tr></thead>
        <tbody>
          ${historico.map(h => `
            <tr>
              <td class="mono bold">${h.ano}</td>
              <td>${h.cargo || '—'}</td>
              <td>${h.municipio || '—'}</td>
              <td>${h.partido || '—'}</td>
              <td>${traduzirSituacao(h.situacao || '')}</td>
              <td class="r mono">${Number(h.total_votos || 0) > 0 ? fmtN(Number(h.total_votos)) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;

  /* ── Patrimônio ── */
  const bensHTML = bens.length === 0 ? '' : `
    <section>
      <h2>Patrimônio Declarado</h2>
      <p class="subtitle">Total: <strong>${formatBRL(patrimonioTotal)}</strong> · ${bens.length} ${bens.length === 1 ? 'bem' : 'bens'}</p>
      <table class="vote-table">
        <thead><tr><th>#</th><th>Tipo</th><th>Descrição</th><th class="r">Valor</th></tr></thead>
        <tbody>
          ${bens.map((b, i) => `
            <tr>
              <td class="idx">${i + 1}</td>
              <td>${b.tipo || '—'}</td>
              <td>${b.descricao || '—'}</td>
              <td class="r mono">${b.valor ? formatBRL(Number(b.valor)) : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </section>`;

  /* ── Receitas ── */
  const totalRec = receitas.reduce((s, r) => {
    const v = Number(String(r.vr_receita || r.VR_RECEITA || r.valor || 0).replace(',', '.'));
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  const recHTML = receitas.length === 0 ? '' : `
    <section>
      <h2>Receitas de Campanha</h2>
      <p class="subtitle">Total: <strong>${formatBRL(totalRec)}</strong> · ${receitas.length} registros</p>
      <table class="vote-table">
        <thead><tr><th>Doador</th><th>Origem</th><th class="r">Valor</th></tr></thead>
        <tbody>
          ${receitas.slice(0, 50).map(r => {
            const doador = r.nm_doador || r.NM_DOADOR || r.doador || '—';
            const origem = r.ds_origem_receita || r.DS_ORIGEM_RECEITA || r.origem || '—';
            const val = Number(String(r.vr_receita || r.VR_RECEITA || r.valor || 0).replace(',', '.'));
            return `<tr><td>${doador}</td><td>${origem}</td><td class="r mono">${Number.isFinite(val) && val > 0 ? formatBRL(val) : '—'}</td></tr>`;
          }).join('')}
          ${receitas.length > 50 ? `<tr><td colspan="3" class="muted" style="text-align:center">… e mais ${receitas.length - 50} registros</td></tr>` : ''}
        </tbody>
      </table>
    </section>`;

  /* ── Campos pessoais ── */
  const campos = [
    ['Gênero', candidato.genero],
    ['Escolaridade', candidato.escolaridade],
    ['Profissão', candidato.ocupacao],
    ['Estado Civil', candidato.estado_civil],
    ['Cor/Raça', candidato.cor_raca],
    ['Naturalidade', candidato.uf_nascimento],
    ['Partido', candidato.nome_partido || candidato.partido],
    ['Município', candidato.municipio],
  ].filter(([, v]) => !!v);

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${candidato.candidato} — Eleição ${ano}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',system-ui,sans-serif;font-size:10.5px;color:#1a1a2e;background:#fff;padding:20px 24px}

    /* Header */
    .header{display:flex;align-items:flex-start;gap:14px;padding-bottom:12px;border-bottom:2px solid #e2e8f0;margin-bottom:14px}
    .avatar{width:48px;height:48px;border-radius:50%;background:#ede9fe;display:flex;align-items:center;justify-content:center;font-size:20px;color:#7c3aed;font-weight:800;flex-shrink:0}
    .header-info{flex:1;min-width:0}
    .nome-urna{font-size:18px;font-weight:800;color:#0f172a;line-height:1.2}
    .nome-completo{font-size:10px;color:#64748b;margin-top:1px}
    .badges{display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;align-items:center}
    .badge{padding:1px 7px;border-radius:99px;font-size:9.5px;font-weight:700;border:1px solid}
    .badge-partido{background:#ede9fe;color:#5b21b6;border-color:#c4b5fd}
    .badge-cargo  {background:#f0f9ff;color:#0369a1;border-color:#bae6fd}
    .badge-green  {background:#dcfce7;color:#166534;border-color:#86efac}
    .badge-red    {background:#fee2e2;color:#991b1b;border-color:#fca5a5}
    .badge-blue   {background:#dbeafe;color:#1d4ed8;border-color:#93c5fd}
    .badge-gray   {background:#f1f5f9;color:#475569;border-color:#cbd5e1}
    .badge-year   {background:#fef3c7;color:#92400e;border-color:#fcd34d}
    .header-stats{text-align:right;flex-shrink:0}
    .votos-total{font-size:24px;font-weight:800;color:#7c3aed;font-variant-numeric:tabular-nums}
    .votos-label{font-size:8.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}

    /* Campos pessoais */
    .campos{display:grid;grid-template-columns:repeat(4,1fr);gap:7px 12px;margin-bottom:14px;padding:10px 12px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0}
    .campo-label{font-size:8.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;font-weight:600}
    .campo-value{font-size:10.5px;color:#0f172a;font-weight:600;margin-top:1px}

    /* Seções */
    section{margin-bottom:14px}
    h2{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#7c3aed;margin-bottom:5px;padding-bottom:3px;border-bottom:1px solid #e2e8f0}
    .subtitle{font-size:9.5px;color:#64748b;margin-bottom:5px}
    .empty{font-size:10px;color:#94a3b8;font-style:italic}

    /* Tabelas */
    .vote-table{width:100%;border-collapse:collapse;font-size:10px}
    .vote-table th{background:#f1f5f9;font-weight:700;text-transform:uppercase;font-size:8.5px;letter-spacing:.07em;color:#64748b;padding:4px 6px;border-bottom:1px solid #e2e8f0}
    .vote-table td{padding:2.5px 6px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
    .vote-table tr:last-child td{border-bottom:none}
    .zona-row td{background:#fafafa;font-weight:600;border-top:1px solid #e8edf3}
    .escola-row td{font-size:9.5px;background:#fff}
    .r{text-align:right}
    .mono{font-variant-numeric:tabular-nums;font-family:'Courier New',monospace}
    .bold{font-weight:700}
    .muted{color:#94a3b8}
    .pl10{padding-left:14px}
    .idx{color:#cbd5e1;font-variant-numeric:tabular-nums;width:26px;white-space:nowrap}
    .escola-name{color:#334155}
    .cnt{font-weight:400;font-size:8.5px;color:#94a3b8}

    /* Footer */
    .footer{margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;font-size:8.5px;color:#94a3b8}

    /* Print */
    @media print{
      body{padding:0}
      .zona-row{page-break-inside:avoid}
      @page{margin:.8cm 1cm;size:A4 portrait}
    }
  </style>
</head>
<body>

<div class="header">
  <div class="avatar">${(candidato.candidato || '?')[0].toUpperCase()}</div>
  <div class="header-info">
    <div class="nome-urna">${candidato.candidato}</div>
    ${candidato.nome_completo && candidato.nome_completo !== candidato.candidato
      ? `<div class="nome-completo">${candidato.nome_completo}</div>` : ''}
    <div class="badges">
      <span class="badge badge-partido">${candidato.partido}</span>
      <span class="badge badge-cargo">${candidato.cargo}</span>
      <span class="badge badge-year">Eleição ${ano}</span>
      ${sit ? `<span class="badge ${sitClass}">${sit}</span>` : ''}
      ${candidato.numero ? `<span style="font-size:9.5px;color:#64748b;margin-left:2px">Nº ${candidato.numero}</span>` : ''}
    </div>
  </div>
  <div class="header-stats">
    <div class="votos-total">${fmtN(totalVotos)}</div>
    <div class="votos-label">votos totais</div>
    <div style="font-size:9px;color:#94a3b8;margin-top:3px">${zonas.length} zonas · ${composicao.length} locais</div>
  </div>
</div>

${campos.length > 0 ? `
<div class="campos">
  ${campos.map(([l, v]) => `<div><div class="campo-label">${l}</div><div class="campo-value">${v}</div></div>`).join('')}
</div>` : ''}

<section>
  <h2>Composição de Votos — Eleição ${ano}</h2>
  ${composicaoHTML}
</section>

${histHTML}
${bensHTML}
${recHTML}

<div class="footer">
  <span>EleiçõesGO — Inteligência Eleitoral · Dados: TSE</span>
  <span>Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
</div>

<script>window.onload=function(){window.print()}</script>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) win.addEventListener('afterprint', () => URL.revokeObjectURL(url));
}
