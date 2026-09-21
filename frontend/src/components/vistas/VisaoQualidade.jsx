import { GraficoLinhas, Kpi, n, nd } from "../Graficos.jsx";

const pct = (x) => `${nd(x)}%`;

// Ordem = do mais para o menos relevante para quem lê o dashboard.
const CAMPOS = [
  { chave: "sem_sintomas", rotulo: "Sem sintoma registrado", icone: "sintomas", cor: "#8b5cf6" },
  { chave: "evolucao_ignorada", rotulo: "Evolução ignorada", icone: "obitos", cor: "#ef4444" },
  { chave: "classificacao_vazia", rotulo: "Classificação vazia", icone: "qualidade", cor: "#f59e0b" },
  { chave: "unidade_vazia", rotulo: "Unidade (CNES) vazia", icone: "mapas", cor: "#0ea5e9" },
  { chave: "sexo_ignorado", rotulo: "Sexo ignorado", icone: "demografia", cor: "#64748b" },
  { chave: "idade_vazia", rotulo: "Idade vazia", icone: "demografia", cor: "#64748b" },
];

const SERIES_ANO = [
  { chave: "pct_aproveitaveis", nome: "Com data e município", cor: "#10b981" },
  { chave: "pct_com_sintomas", nome: "Com sintomas registrados", cor: "#8b5cf6" },
];

export default function VisaoQualidade({ qualidade, ufSel }) {
  if (!qualidade || qualidade.carregando) {
    return <div className="card"><p className="dica">Carregando qualidade dos dados…</p></div>;
  }
  if (qualidade.erro) {
    return <div className="card"><p className="dica">Erro ao carregar: {qualidade.erro}</p></div>;
  }

  const q = qualidade;
  const comData = q.total - q.sem_data;

  return (
    <>
      <div className="kpis">
        <Kpi rotulo="Registros no recorte" valor={q.total} icone="casos" cor="#0ea5e9"
             detalhe="Tudo o que chegou do SINAN" />
        <Kpi rotulo="Completos (data e município)" valor={q.aproveitaveis} icone="curas" cor="#10b981"
             detalhe={`${pct(q.pct.aproveitaveis)} dos registros`} />
        <Kpi rotulo="Sem data de notificação" valor={q.sem_data} icone="tendencias" cor="#f59e0b"
             detalhe={`${pct(q.pct.sem_data)} · fora de todas as abas`} />
        <Kpi rotulo="Sem município" valor={ufSel ? "—" : q.sem_municipio} icone="mapas" cor="#ef4444"
             detalhe={ufSel ? "Não entram no filtro por UF" : `${pct(q.pct.sem_municipio)} · fora do mapa`} />
      </div>

      <p className="nota-ponte">
        As outras abas contam os <b>{n(comData)}</b> registros que têm data — os sem município entram
        nos totais, mas não no mapa nem nos rankings de cidades.
        {q.municipio_via_cnes > 0 && (
          <> O ETL recuperou o município de <b>{n(q.municipio_via_cnes)}</b> ({pct(q.pct.municipio_via_cnes)})
            pela unidade de saúde que notificou (CNES), quando a notificação veio sem cidade.</>
        )}
      </p>

      <h2 className="secao-titulo">Outros campos incompletos</h2>
      <p className="secao-sub">Não impedem localizar o caso, mas limitam o que dá para analisar.</p>
      <div className="kpis kpis-compactos">
        {CAMPOS.map((c) => (
          <Kpi key={c.chave} rotulo={c.rotulo} valor={q.campos[c.chave].faltando}
               detalhe={`${pct(q.campos[c.chave].pct)} dos registros`} icone={c.icone} cor={c.cor} />
        ))}
      </div>

      <div className="card">
        <div className="card-topo"><h3>Completude por ano</h3></div>
        <p className="dica">
          Quedas bruscas costumam ser mudança na ficha do SINAN, não descuido de quem preencheu.
          Os campos de sintoma, por exemplo, não existem nos arquivos de dengue de 2007 a 2014 nem
          em nenhum ano da Zika — por isso "sem sintoma registrado" é alto mesmo com a ficha bem preenchida.
        </p>
        <GraficoLinhas dados={q.por_ano} chaveX="ano" series={SERIES_ANO}
                       formatador={(v) => `${nd(v, 0)}%`} dominioY={[0, 100]} />
      </div>
    </>
  );
}
