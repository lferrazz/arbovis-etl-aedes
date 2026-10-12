import { AlternadorMetrica, GraficoBarras, POP_MIN_INCIDENCIA, n, nd, taxa } from "../Graficos.jsx";

const SERIES = [
  { chave: "dengue", nome: "Dengue", cor: "#2563eb" },
  { chave: "zika", nome: "Zika", cor: "#a855f7" },
  { chave: "chikungunya", nome: "Chikungunya", cor: "#f59e0b" },
];

export default function ComparacaoMunicipios({ estado, metrica, setMetrica, onLimpar }) {
  if (!estado) return null;
  if (estado.carregando) {
    return <div className="card"><p className="dica">Comparando municípios…</p></div>;
  }
  if (estado.erro) {
    return <div className="card"><p className="dica">Erro ao comparar: {estado.erro}</p></div>;
  }

  const dados = estado.dados || [];
  const porIncidencia = metrica === "incidencia";
  const temSemPopulacao = dados.some((m) => m.populacao == null);
  const temPequeno = dados.some((m) => m.populacao != null && m.populacao < POP_MIN_INCIDENCIA);

  const dadosGrafico = dados.map((m) => ({
    municipio: m.municipio,
    ...Object.fromEntries(SERIES.map(({ chave }) => [
      chave,
      porIncidencia ? m.por_doenca[chave].incidencia : m.por_doenca[chave].casos,
    ])),
  }));

  return (
    <div className="card">
      <div className="card-topo">
        <h3>Comparação entre municípios</h3>
        <div className="comp-acoes">
          <AlternadorMetrica metrica={metrica} setMetrica={setMetrica} />
          <button className="voltar" onClick={onLimpar}>Limpar</button>
        </div>
      </div>
      <p className="dica">
        O número absoluto esconde o tamanho da cidade. Os casos atendidos contam pela cidade onde o caso
        foi notificado; a incidência conta os confirmados pela cidade onde a pessoa mora, por 100 mil
        habitantes ao ano, e mostra o peso real da doença sobre a população. Usa o período selecionado e
        as três doenças, independente da aba escolhida. População do Censo 2022 (IBGE).
      </p>

      <div className="tabela-rolavel">
        <table className="tabela-comp">
          <thead>
            <tr>
              <th>Município</th>
              <th>População</th>
              <th>Casos atendidos</th>
              <th>Confirmados atendidos</th>
              <th>Incidência (conf. por 100 mil hab. ao ano)</th>
              <th>% da população com caso provável</th>
              <th>Óbitos entre confirmados</th>
              <th>Óbitos por 100 mil hab. ao ano</th>
              <th>Letalidade (sobre confirmados)</th>
              {SERIES.map((s) => <th key={s.chave}>{s.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {dados.map((m) => (
              <tr key={m.cod_ibge}>
                <th scope="row">{m.municipio}/{m.uf}</th>
                <td>{m.populacao == null ? "sem população" : n(m.populacao)}</td>
                <td>{n(m.casos)}</td>
                <td>{n(m.confirmados)}</td>
                <td className="destaque">{m.populacao == null ? "sem população" : taxa(m.incidencia)}</td>
                <td>{m.pct_populacao == null ? "sem população" : `${nd(m.pct_populacao)}%`}</td>
                <td>{n(m.obitos)}</td>
                <td>{m.populacao == null ? "sem população" : nd(m.obitos_100mil)}</td>
                <td>{m.letalidade == null ? "sem dado" : `${nd(m.letalidade, 3)}%`}</td>
                {SERIES.map((s) => (
                  <td key={s.chave}>
                    {porIncidencia ? taxa(m.por_doenca[s.chave].incidencia) : n(m.por_doenca[s.chave].casos)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GraficoBarras dados={dadosGrafico} chaveX="municipio" series={SERIES}
                     formatador={porIncidencia ? (v) => taxa(v) : n} />

      {temPequeno && (
        <p className="dica" style={{ marginTop: 12 }}>
          A incidência só é calculada para municípios com 100 mil habitantes ou mais (aparece como
          "sem dado"): abaixo disso, poucos casos a mais ou a menos fazem a taxa oscilar muito.
        </p>
      )}
      {temSemPopulacao && (
        <p className="dica" style={{ marginTop: 12 }}>
          Município sem população no Censo 2022, por ter sido criado depois do recenseamento.
          As taxas por habitante não podem ser calculadas nesse caso.
        </p>
      )}
    </div>
  );
}
