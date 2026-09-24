import { BarrasValor, GraficoBarras, GraficoTemporal, Kpi, n, nd } from "../Graficos.jsx";

export default function VisaoGeral({ cor, resumo, serie, grau, mapa, sazonal, regiao, desfecho, ufSel }) {
  return (
    <>
      <div className="kpis kpis-4">
        <Kpi rotulo="Notificados" valor={resumo.casos} cor={cor} icone="casos"
             ajuda="Toda suspeita registrada no SINAN, confirmada ou não. É o universo da base: a notificação é aberta pelo atendimento, antes de qualquer resultado de exame." />
        <Kpi rotulo="Confirmados" valor={resumo.confirmados} cor="#0ea5e9" icone="letalidade"
             detalhe={`${nd(resumo.pct_confirmados)}% dos notificados`}
             ajuda="Casos com classificação final de confirmado, por critério laboratorial ou clínico-epidemiológico. Cada doença tem seus próprios códigos no SINAN, e a dengue mudou os dela em 2014." />
        <Kpi rotulo="Curas" valor={resumo.curas} cor="#10b981" icone="curas"
             ajuda="Notificações encerradas com recuperação do paciente, confirmadas ou não. Registra a melhora clínica, e não se o exame confirmou a doença, então inclui casos depois descartados." />
        <Kpi rotulo="Óbitos" valor={resumo.obitos} cor="#ef4444" icone="obitos"
             detalhe={`letalidade de ${nd(resumo.letalidade, 3)}%`}
             ajuda="Mortes causadas pela própria arbovirose. A letalidade usa o total de notificados como denominador, e casos sem desfecho informado nunca entram como óbito, então o valor real tende a ser um pouco maior." />
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
