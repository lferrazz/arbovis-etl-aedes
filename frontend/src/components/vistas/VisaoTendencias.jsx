import { GraficoBarras, GraficoTemporal } from "../Graficos.jsx";

const GRANULARIDADES = [["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]];

export default function VisaoTendencias({ cor, serie, granularidade, setGranularidade, sazonal, rankingUf }) {
  return (
    <>
      <div className="card">
        <div className="card-topo">
          <h3>Evolução dos casos e óbitos</h3>
          <div className="segmentador">
            {GRANULARIDADES.map(([g, rot]) => (
              <button key={g} className={granularidade === g ? "ativo" : ""} onClick={() => setGranularidade(g)}>{rot}</button>
            ))}
          </div>
        </div>
        <GraficoTemporal dados={serie} cor={cor} />
      </div>
      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Sazonalidade</h3></div>
          <p className="dica">Casos somados por mês do ano — o pico da temporada.</p>
          <GraficoBarras dados={sazonal} chaveX="mes" chaveY="casos" cor={cor} nome="Casos" />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Estados mais afetados</h3></div>
          <p className="dica">Top 10 UFs no período.</p>
          <GraficoBarras dados={rankingUf} chaveX="uf" chaveY="casos" cor={cor} nome="Casos" horizontal />
        </div>
      </div>
    </>
  );
}
