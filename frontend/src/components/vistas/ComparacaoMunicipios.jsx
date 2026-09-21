import { GraficoBarras, n, nd } from "../Graficos.jsx";

const SERIES = [
  { chave: "dengue", nome: "Dengue", cor: "#ef4444" },
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
  const por100mil = metrica === "por100mil";
  const temSemPopulacao = dados.some((m) => m.populacao == null);

  const dadosGrafico = dados.map((m) => ({
    municipio: m.municipio,
    ...Object.fromEntries(SERIES.map(({ chave }) => [
      chave,
      por100mil ? m.por_doenca[chave].casos_100mil : m.por_doenca[chave].casos,
    ])),
  }));

  return (
    <div className="card">
      <div className="card-topo">
        <h3>Comparação entre municípios</h3>
        <div className="comp-acoes">
          <div className="segmentador">
            <button className={!por100mil ? "ativo" : ""} onClick={() => setMetrica("absoluto")}>Absolutos</button>
            <button className={por100mil ? "ativo" : ""} onClick={() => setMetrica("por100mil")}>Por 100 mil hab.</button>
          </div>
          <button className="voltar" onClick={onLimpar}>Limpar</button>
        </div>
      </div>
      <p className="dica">
        O número absoluto esconde o tamanho da cidade. A taxa por 100 mil habitantes mostra o peso
        real da doença sobre a população. Usa o período selecionado e considera as três doenças,
        independente da aba escolhida. População do Censo 2022 (IBGE).
      </p>

      <div className="tabela-rolavel">
        <table className="tabela-comp">
          <thead>
            <tr>
              <th>Município</th>
              <th>População</th>
              <th>Casos</th>
              <th>Casos / 100 mil</th>
              <th>% da população</th>
              <th>Óbitos</th>
              <th>Óbitos / 100 mil</th>
              <th>Letalidade</th>
              {SERIES.map((s) => <th key={s.chave}>{s.nome}</th>)}
            </tr>
          </thead>
          <tbody>
            {dados.map((m) => (
              <tr key={m.cod_ibge}>
                <th scope="row">{m.municipio}/{m.uf}</th>
                <td>{m.populacao == null ? "—" : n(m.populacao)}</td>
                <td>{n(m.casos)}</td>
                <td className="destaque">{nd(m.casos_100mil)}</td>
                <td>{m.pct_populacao == null ? "—" : `${nd(m.pct_populacao)}%`}</td>
                <td>{n(m.obitos)}</td>
                <td>{nd(m.obitos_100mil)}</td>
                <td>{nd(m.letalidade, 3)}%</td>
                {SERIES.map((s) => (
                  <td key={s.chave}>
                    {por100mil ? nd(m.por_doenca[s.chave].casos_100mil) : n(m.por_doenca[s.chave].casos)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <GraficoBarras dados={dadosGrafico} chaveX="municipio" series={SERIES}
                     formatador={por100mil ? (v) => nd(v) : n} />

      {temSemPopulacao && (
        <p className="dica" style={{ marginTop: 12 }}>
          — Município sem população no Censo 2022 (criado depois do recenseamento);
          as taxas por habitante não podem ser calculadas.
        </p>
      )}
    </div>
  );
}
