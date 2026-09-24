import { GraficoLinhas, Kpi, n, nd } from "../Graficos.jsx";

const pct = (x) => `${nd(x)}%`;

// Ordem = do mais para o menos relevante para quem lê o dashboard.
const CAMPOS = [
  {
    chave: "sem_sintomas", rotulo: "Sem sintoma registrado", icone: "sintomas", cor: "#8b5cf6",
    ajuda: "Nenhum dos seis sintomas (febre, dor muscular, dor de cabeça, manchas na pele, dor nas "
      + "articulações e dor atrás dos olhos) foi preenchido. Quase sempre é limitação da ficha, não "
      + "descuido: a de dengue de 2007 a 2014 e a de Zika não têm esses campos.",
  },
  {
    chave: "evolucao_ignorada", rotulo: "Evolução ignorada", icone: "obitos", cor: "#ef4444",
    ajuda: "Não se sabe como o caso terminou (cura, óbito ou outro): o campo está vazio ou marcado "
      + "como \"ignorado\". Esses casos entram no total, mas nunca como óbito, então a "
      + "letalidade real pode ser um pouco maior que a mostrada.",
  },
  {
    chave: "classificacao_vazia", rotulo: "Classificação vazia", icone: "qualidade", cor: "#f59e0b",
    ajuda: "O caso não recebeu classificação final (confirmado, descartado ou inconclusivo). "
      + "Geralmente é uma investigação que não foi encerrada no sistema.",
  },
  {
    chave: "unidade_vazia", rotulo: "Unidade (CNES) vazia", icone: "mapas", cor: "#0ea5e9",
    ajuda: "Não há o código da unidade de saúde que notificou. Esses casos ficam fora da análise "
      + "por bairro e por tipo de estabelecimento.",
  },
  {
    chave: "sexo_ignorado", rotulo: "Sexo ignorado", icone: "demografia", cor: "#64748b",
    ajuda: "Sexo marcado como \"ignorado\" ou com valor que não é masculino nem feminino.",
  },
  {
    chave: "idade_vazia", rotulo: "Idade vazia", icone: "demografia", cor: "#64748b",
    ajuda: "Idade não informada, ou acima de 120 anos (tratada como erro de digitação). Esses casos "
      + "ficam fora da faixa etária e da idade média.",
  },
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
      <div className="kpis kpis-4">
        <Kpi rotulo="Registros no recorte" valor={q.total} icone="casos" cor="#0ea5e9"
             detalhe="Tudo o que chegou do SINAN"
             ajuda="Todas as notificações do SINAN na doença, UF e período escolhidos, completas ou não. O ETL só remove linhas duplicadas idênticas; registros incompletos são mantidos e contados aqui." />
        <Kpi rotulo="Completos (data e município)" valor={q.aproveitaveis} icone="curas" cor="#10b981"
             detalhe={`${pct(q.pct.aproveitaveis)} dos registros`}
             ajuda="Registros com a data da notificação e o município. São os que dá para colocar no tempo e no mapa." />
        <Kpi rotulo="Sem data de notificação" valor={q.sem_data} icone="tendencias" cor="#f59e0b"
             detalhe={`${pct(q.pct.sem_data)} · fora de todas as abas`}
             ajuda="Não há a data em que o caso foi notificado. Como todas as outras abas filtram por data, eles não aparecem em nenhuma delas. Aqui entram no período pelo ano da notificação." />
        <Kpi rotulo="Sem município" valor={ufSel ? "não se aplica" : q.sem_municipio} icone="mapas" cor="#ef4444"
             detalhe={ufSel ? "Não entram no filtro por UF" : `${pct(q.pct.sem_municipio)} · fora do mapa`}
             ajuda={ufSel
               ? "Com uma UF selecionada, registros sem município não têm como entrar no recorte, porque não se sabe a que estado pertencem."
               : "Nem a notificação nem a unidade de saúde informaram a cidade. Contam nos totais das outras abas, mas não aparecem no mapa nem nos rankings de cidades."} />
      </div>

      <p className="nota-ponte">
        As outras abas contam os <b>{n(comData)}</b> registros que têm data. Os sem município entram
        nos totais, mas não aparecem no mapa nem nos rankings de cidades.
        {q.municipio_via_cnes > 0 && (
          <> O ETL recuperou o município de <b>{n(q.municipio_via_cnes)}</b> ({pct(q.pct.municipio_via_cnes)})
            pela unidade de saúde que notificou (CNES), quando a notificação veio sem cidade.</>
        )}
      </p>

      <h2 className="secao-titulo">Outros campos incompletos</h2>
      <p className="secao-sub">Não impedem localizar o caso, mas limitam o que dá para analisar.</p>
      <div className="kpis kpis-6 kpis-compactos">
        {CAMPOS.map((c) => (
          <Kpi key={c.chave} rotulo={c.rotulo} valor={q.campos[c.chave].faltando}
               detalhe={`${pct(q.campos[c.chave].pct)} dos registros`} icone={c.icone} cor={c.cor}
               ajuda={c.ajuda} />
        ))}
      </div>

      <div className="card">
        <div className="card-topo"><h3>Completude por ano</h3></div>
        <p className="dica">
          Quedas bruscas costumam ser mudança na ficha do SINAN, não descuido de quem preencheu.
          Os campos de sintoma, por exemplo, não existem nos arquivos de dengue de 2007 a 2014 nem
          em nenhum ano da Zika, então "sem sintoma registrado" fica alto mesmo com a ficha bem preenchida.
        </p>
        <GraficoLinhas dados={q.por_ano} chaveX="ano" series={SERIES_ANO}
                       formatador={(v) => `${nd(v, 0)}%`} dominioY={[0, 100]} />
      </div>
    </>
  );
}
