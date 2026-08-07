import { GraficoBarras } from "../Graficos.jsx";

export default function VisaoSintomas({ cor, sintomas, tipos, tiposPct }) {
  return (
    <>
      <div className="card">
        <div className="card-topo"><h3>Principais sintomas</h3></div>
        <p className="dica">Número de pessoas que relataram cada sintoma.</p>
        <GraficoBarras dados={sintomas} chaveX="sintoma" chaveY="qtd" cor={cor} nome="Pessoas" horizontal />
      </div>
      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Onde os casos são atendidos</h3></div>
          <p className="dica">Tipos de estabelecimento (CNES) que mais notificaram.</p>
          <GraficoBarras dados={tipos} chaveX="tipo" chaveY="casos" cor={cor} nome="Casos" horizontal />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Concentração por tipo de unidade (CNES)</h3></div>
          <p className="dica">Percentual dos casos absorvido por cada tipo de estabelecimento.</p>
          <div className="barras-pct">
            {tiposPct.map((t) => (
              <div key={t.tipo} className="barra-linha">
                <span className="barra-nome" title={t.tipo}>{t.tipo}</span>
                <div className="barra-trilho"><div className="barra-fill" style={{ width: `${t.pct}%`, background: cor }} /></div>
                <span className="barra-val">{t.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
