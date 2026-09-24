import { BarrasValor, GraficoBarras, GraficoTemporal, Kpi, n, nd } from "../Graficos.jsx";

export default function VisaoGeral({ cor, resumo, serie, grau, mapa, sazonal, regiao, desfecho, ufSel }) {
  return (
    <>
      <div className="kpis kpis-6">
        <Kpi rotulo="Casos notificados" valor={resumo.casos} cor={cor} icone="casos" />
        <Kpi rotulo="Curas" valor={resumo.curas} cor="#10b981" icone="curas" />
        <Kpi rotulo="Óbitos" valor={resumo.obitos} cor="#ef4444" icone="obitos" />
        <Kpi rotulo="Letalidade" valor={`${nd(resumo.letalidade, 3)}%`} cor="#f59e0b" icone="letalidade" />
        <Kpi rotulo="% confirmados" valor={`${nd(resumo.pct_confirmados)}%`} cor="#0ea5e9" icone="letalidade" />
        <Kpi rotulo="Idade média" valor={resumo.idade_media ? `${resumo.idade_media} anos` : "sem dado"} cor="#8b5cf6" icone="demografia" />
      </div>
      <div className="grade-mapa">
        <div className="card">
          <div className="card-topo"><h3>Evolução dos casos</h3></div>
          <GraficoTemporal dados={serie} cor={cor} grau={grau} />
        </div>
        <div className="card">
          <h3>Locais mais afetados</h3>
          <p className="dica">{ufSel ? `Cidades de ${ufSel}` : "Municípios no Brasil"}</p>
          <ul className="ranking rolavel">
            {mapa.slice(0, 12).map((m) => (
              <li key={m.cod_ibge}><span className="nome">{m.municipio}/{m.uf}</span><span className="n">{n(m.casos)}</span></li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grade3">
        <div className="card">
          <div className="card-topo"><h3>Sazonalidade</h3></div>
          <p className="dica">Casos por mês do ano.</p>
          <GraficoBarras dados={sazonal} chaveX="mes" chaveY="casos" cor={cor} nome="Casos" />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Casos por região</h3></div>
          <p className="dica">Distribuição pelas 5 regiões.</p>
          <GraficoBarras dados={regiao} chaveX="regiao" chaveY="casos" cor={cor} nome="Casos" horizontal />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Desfecho dos casos</h3></div>
          <p className="dica">Evolução dos casos.</p>
          <BarrasValor dados={desfecho} chaveX="desfecho" chaveY="casos" cor={cor} />
        </div>
      </div>
    </>
  );
}
