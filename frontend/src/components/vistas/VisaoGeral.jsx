import {
  AJUDA_OBITOS, AJUDA_PROVAVEIS, AlternadorMetrica, BarrasValor, GraficoBarras, GraficoTemporal, Kpi, taxa, valorMetrica,
} from "../Graficos.jsx";

export default function VisaoGeral({
  cor, resumo, serie, grau, locais, sazonal, regiao, desfecho, ufSel, metrica, setMetrica,
}) {
  const porIncidencia = metrica === "incidencia";
  return (
    <>
      <div className="kpis kpis-4">
        <Kpi rotulo="Casos prováveis" valor={resumo.casos} cor={cor} icone="casos"
             ajuda={AJUDA_PROVAVEIS} />
        <Kpi rotulo="Confirmados" valor={resumo.confirmados} cor="#0ea5e9" icone="letalidade"
             detalhe={`${taxa(resumo.pct_confirmados)}% dos casos prováveis`}
             ajuda="Casos com classificação final de confirmado, por exame de laboratório ou por critério clínico e epidemiológico. Cada doença tem seus próprios códigos no SINAN, e a dengue mudou os dela em 2014." />
        <Kpi rotulo="Curas" valor={resumo.curas} cor="#10b981" icone="curas"
             detalhe="entre os confirmados"
             ajuda="Casos confirmados que evoluíram para cura. Curas, óbitos e letalidade são contados no mesmo grupo, o dos confirmados." />
        <Kpi rotulo="Óbitos" valor={resumo.obitos} cor="#ef4444" icone="obitos"
             detalhe={`letalidade de ${taxa(resumo.letalidade, 3)}% dos confirmados`}
             ajuda={`${AJUDA_OBITOS} Casos sem desfecho informado nunca entram como óbito, então o valor real tende a ser um pouco maior.`} />
      </div>
      <div className="grade-mapa">
        <div className="card">
          <div className="card-topo"><h3>Evolução dos casos prováveis e dos óbitos</h3></div>
          <p className="dica">
            A linha colorida mostra os casos prováveis (eixo da esquerda) e a vermelha, os óbitos entre os
            confirmados (eixo da direita). Os picos marcam as epidemias.
          </p>
          <GraficoTemporal dados={serie} cor={cor} grau={grau} />
        </div>
        <div className="card">
          <div className="card-topo">
            <h3>{porIncidencia ? "Maior incidência" : "Onde os casos foram atendidos"}</h3>
            <AlternadorMetrica metrica={metrica} setMetrica={setMetrica} />
          </div>
          <p className="dica">
            {ufSel ? `Cidades de ${ufSel}` : "Municípios do Brasil"}
            {porIncidencia
              ? ", em confirmados por 100 mil habitantes ao ano, pela cidade onde a pessoa mora. Só entram municípios com 100 mil habitantes ou mais."
              : ", em casos prováveis contados pela cidade onde foram notificados. Cidades polo atendem moradores de toda a região."}
          </p>
          <ul className="ranking rolavel">
            {locais.slice(0, 12).map((m) => (
              <li key={m.cod_ibge}><span className="nome">{m.municipio}/{m.uf}</span><span className="n">{valorMetrica(m, metrica)}</span></li>
            ))}
          </ul>
          {locais.length === 0 && porIncidencia && (
            <p className="dica">Nenhum município deste recorte tem 100 mil habitantes ou mais.</p>
          )}
        </div>
      </div>

      <div className="grade3">
        <div className="card">
          <div className="card-topo"><h3>Sazonalidade</h3></div>
          <p className="dica">
            Casos prováveis somados por mês do ano, juntando todos os anos do período. Mostra em que
            época a doença costuma crescer.
          </p>
          <GraficoBarras dados={sazonal} chaveX="mes" chaveY="casos" cor={cor} nome="Casos prováveis" />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Casos prováveis por região</h3></div>
          <p className="dica">
            Total de casos prováveis atendidos em cada uma das cinco regiões do país. Regiões mais
            populosas tendem a somar mais casos.
          </p>
          <GraficoBarras dados={regiao} chaveX="regiao" chaveY="casos" cor={cor} nome="Casos prováveis" horizontal />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Desfecho dos casos confirmados</h3></div>
          <p className="dica">
            Como terminaram os casos confirmados: cura, óbito pela doença, óbito por outra causa ou sem
            informação. O número de óbitos aqui é o mesmo do card acima.
          </p>
          <BarrasValor dados={desfecho} chaveX="desfecho" chaveY="casos" cor={cor} />
        </div>
      </div>
    </>
  );
}
