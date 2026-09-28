import { AlternadorMetrica, BarrasValor, GraficoBarras, GraficoTemporal, Kpi, taxa, valorMetrica } from "../Graficos.jsx";

export default function VisaoGeral({
  cor, resumo, serie, grau, locais, sazonal, regiao, desfecho, ufSel, metrica, setMetrica,
}) {
  const porIncidencia = metrica === "incidencia";
  return (
    <>
      <div className="kpis kpis-4">
        <Kpi rotulo="Notificados" valor={resumo.casos} cor={cor} icone="casos"
             ajuda="Toda suspeita registrada no SINAN, confirmada ou não. É o universo da base: a notificação é aberta pelo atendimento, antes de qualquer resultado de exame." />
        <Kpi rotulo="Confirmados" valor={resumo.confirmados} cor="#0ea5e9" icone="letalidade"
             detalhe={`${taxa(resumo.pct_confirmados)}% dos notificados`}
             ajuda="Casos com classificação final de confirmado, por critério laboratorial ou clínico-epidemiológico. Cada doença tem seus próprios códigos no SINAN, e a dengue mudou os dela em 2014." />
        <Kpi rotulo="Curas" valor={resumo.curas} cor="#10b981" icone="curas"
             detalhe="entre os confirmados"
             ajuda="Casos confirmados que evoluíram para cura. As notificações depois descartadas ficam de fora, para a cura não contar quem nem teve a doença." />
        <Kpi rotulo="Óbitos" valor={resumo.obitos} cor="#ef4444" icone="obitos"
             detalhe={`letalidade de ${taxa(resumo.letalidade, 3)}% dos confirmados`}
             ajuda="Mortes causadas pela própria arbovirose. A letalidade divide esses óbitos pelos casos confirmados, o denominador usual em epidemiologia. Casos sem desfecho informado nunca entram como óbito, então o valor real tende a ser um pouco maior." />
      </div>
      <div className="grade-mapa">
        <div className="card">
          <div className="card-topo"><h3>Evolução das notificações e dos óbitos</h3></div>
          <GraficoTemporal dados={serie} cor={cor} grau={grau} />
        </div>
        <div className="card">
          <div className="card-topo">
            <h3>Locais mais afetados</h3>
            <AlternadorMetrica metrica={metrica} setMetrica={setMetrica} />
          </div>
          <p className="dica">
            {ufSel ? `Cidades de ${ufSel}` : "Municípios no Brasil"}
            {porIncidencia ? ", confirmados por 100 mil hab. (só municípios com 100 mil hab. ou mais)" : ", por notificações"}
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
          <p className="dica">Notificações por mês do ano.</p>
          <GraficoBarras dados={sazonal} chaveX="mes" chaveY="casos" cor={cor} nome="Notificações" />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Notificações por região</h3></div>
          <p className="dica">Distribuição pelas 5 regiões.</p>
          <GraficoBarras dados={regiao} chaveX="regiao" chaveY="casos" cor={cor} nome="Notificações" horizontal />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Desfecho dos casos confirmados</h3></div>
          <p className="dica">Como terminaram os casos confirmados. Descartados ficam de fora.</p>
          <BarrasValor dados={desfecho} chaveX="desfecho" chaveY="casos" cor={cor} />
        </div>
      </div>
    </>
  );
}
