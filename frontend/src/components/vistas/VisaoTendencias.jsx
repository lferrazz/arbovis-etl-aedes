import { GRAOS, LIMITE_TEXTO } from "../../datas.js";
import { AlternadorMetrica, GraficoBarras, GraficoTemporal, n, taxa } from "../Graficos.jsx";

export default function VisaoTendencias({
  cor, serie, granularidade, setGranularidade, permitidos, sazonal, rankingUf, metrica, setMetrica,
}) {
  const porIncidencia = metrica === "incidencia";
  return (
    <>
      <div className="card">
        <div className="card-topo">
          <h3>Evolução dos casos prováveis e dos óbitos</h3>
          <div className="segmentador">
            {GRAOS.map(([g, rot]) => (
              <button
                key={g}
                className={granularidade === g ? "ativo" : ""}
                disabled={!permitidos[g]}
                title={permitidos[g] ? undefined : `Disponível para períodos de ${LIMITE_TEXTO[g]}`}
                onClick={() => setGranularidade(g)}
              >
                {rot}
              </button>
            ))}
          </div>
        </div>
        <p className="dica">
          Casos prováveis no eixo da esquerda e óbitos entre confirmados no da direita. Os botões trocam o
          intervalo de cada ponto. Um vão na linha indica anos sem arquivo da doença na fonte, e não zero casos.
        </p>
        <GraficoTemporal dados={serie} cor={cor} grau={granularidade} />
      </div>
      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Sazonalidade</h3></div>
          <p className="dica">
            Casos prováveis somados por mês do ano, juntando todos os anos do período. A barra mais alta
            marca o pico da temporada.
          </p>
          <GraficoBarras dados={sazonal} chaveX="mes" chaveY="casos" cor={cor} nome="Casos prováveis" />
        </div>
        <div className="card">
          <div className="card-topo">
            <h3>Estados mais afetados</h3>
            <AlternadorMetrica metrica={metrica} setMetrica={setMetrica} />
          </div>
          <p className="dica">
            {porIncidencia
              ? "Os 10 estados com mais casos confirmados por 100 mil habitantes ao ano, pelo estado onde a pessoa mora. Compara estados de tamanhos diferentes."
              : "Os 10 estados com mais casos prováveis atendidos no período. Estados mais populosos tendem a aparecer no topo."}
          </p>
          <GraficoBarras dados={rankingUf} chaveX="uf" horizontal cor={cor}
                         chaveY={porIncidencia ? "incidencia" : "casos"}
                         nome={porIncidencia ? "Confirmados por 100 mil hab. ao ano" : "Casos prováveis atendidos"}
                         formatador={porIncidencia ? (v) => taxa(v) : n} />
        </div>
      </div>
    </>
  );
}
