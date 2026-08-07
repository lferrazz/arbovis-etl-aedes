import { Kpi, n } from "../Graficos.jsx";

const pct = (x) => `${String(x).replace(".", ",")}%`;

export default function VisaoQualidade({ qualidade }) {
  if (!qualidade) {
    return (
      <div className="card">
        <div className="card-topo"><h3>Qualidade dos dados</h3></div>
        <p className="dica">
          Ainda indisponível. Estes números aparecem depois de reconstruir a camada gold
          com o novo pipeline (backfill de município via CNES + registros preservados).
          Rode o ETL para popular.
        </p>
      </div>
    );
  }

  const q = qualidade;
  return (
    <>
      <div className="kpis">
        <Kpi rotulo="Total de notificações" valor={q.total} cor="#0ea5e9" icone="casos" />
        <Kpi rotulo="Indivíduos identificados" valor={`${n(q.identificados)} · ${pct(q.pct_identificados)}`} cor="#10b981" icone="curas" />
        <Kpi rotulo="Sem informação" valor={`${n(q.sem_informacao)} · ${pct(q.pct_sem_informacao)}`} cor="#f59e0b" icone="qualidade" />
      </div>

      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Por que ficou "Sem informação"</h3></div>
          <p className="dica">
            Um registro é um indivíduo quando tem <b>data</b> e <b>cidade</b>. Faltando qualquer um,
            ele é preservado e contado aqui — nada é descartado. Um mesmo registro pode faltar os dois.
          </p>
          <ul className="ranking">
            <li><span className="nome">Sem data de notificação</span><span className="n">{n(q.sem_data)}</span></li>
            <li><span className="nome">Sem município (nem via CNES)</span><span className="n">{n(q.sem_municipio)}</span></li>
            <li><span className="nome">Município recuperado via CNES</span><span className="n">{n(q.municipio_via_cnes)}</span></li>
          </ul>
        </div>

        <div className="card">
          <div className="card-topo"><h3>Outros campos incompletos</h3></div>
          <p className="dica">
            Campos que não impedem localizar o caso, mas cuja ausência mostra o quanto a base
            depende do preenchimento manual na ponta.
          </p>
          <ul className="ranking">
            <li>
              <span className="nome">Sem nenhum sintoma registrado</span>
              <span className="n">{n(q.sem_sintomas)} · {pct(q.pct_sem_sintomas)}</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
