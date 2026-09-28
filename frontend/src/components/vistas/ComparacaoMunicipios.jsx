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
        O número absoluto esconde o tamanho da cidade. A incidência (casos confirmados por 100 mil
        habitantes) mostra o peso real da doença sobre a população. Usa o período selecionado e
        considera as três doenças, independente da aba escolhida. População do Censo 2022 (IBGE).
      </p>

      <div className="tabela-rolavel">
        <table className="tabela-comp">
          <thead>
            <tr>
              <th>Município</th>
              <th>População</th>
              <th>Notificações</th>
              <th>Confirmados</th>
              <th>Incidência (conf. / 100 mil)</th>
              <th>% da população notificada</th>
              <th>Óbitos</th>
              <th>Óbitos / 100 mil</th>
              <th>Letalidade (sobre confirmados)</th>
              {SERIES.map((s) => <th key={s.chave}>{s.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {dados.map((m) => (
              <tr key={m.cod_ibge}>
                <th scope="row">{m.municipio}/{m.uf}</th>
                <td>{m.populacao == null ? "sem dado" : n(m.populacao)}</td>
                <td>{n(m.casos)}</td>
                <td>{n(m.confirmados)}</td>
                <td className="destaque">{taxa(m.incidencia)}</td>
                <td>{m.pct_populacao == null ? "sem dado" : `${nd(m.pct_populacao)}%`}</td>
                <td>{n(m.obitos)}</td>
                <td>{nd(m.obitos_100mil)}</td>
                <td>{m.letalidade == null ? "—" : `${nd(m.letalidade, 3)}%`}</td>
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
          A incidência só é calculada para municípios com 100 mil habitantes ou mais (—): abaixo
          disso, poucos casos a mais ou a menos fazem a taxa oscilar muito.
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
