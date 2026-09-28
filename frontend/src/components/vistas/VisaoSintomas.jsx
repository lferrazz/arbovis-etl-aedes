import { GraficoBarras, n, nd } from "../Graficos.jsx";

const pct = (v) => `${nd(v)}%`;

export default function VisaoSintomas({ cor, sintomas, tipos, tiposPct }) {
  const semBase = sintomas.every((s) => s.pct == null);
  return (
    <>
      <div className="card">
        <div className="card-topo"><h3>Principais sintomas</h3></div>
        <p className="dica">
          Percentual entre as notificações cuja ficha tem o campo de sintoma. A ficha de dengue de
          2007 a 2014 e a de Zika não têm esses campos, então ficam fora da base em vez de contarem
          como "não teve".
        </p>
        {semBase ? (
          <p className="dica">Nenhuma notificação do recorte tem os campos de sintoma na ficha.</p>
        ) : (
          <GraficoBarras dados={sintomas} chaveX="sintoma" chaveY="pct" cor={cor} nome="Relataram" horizontal
                         formatador={(v) => `${nd(v, 0)}%`}
                         formatadorTooltip={(v, s) => `${pct(v)} (${n(s.qtd)} de ${n(s.base)})`} />
        )}
      </div>
      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Onde as notificações são atendidas</h3></div>
          <p className="dica">Tipos de estabelecimento (CNES) que mais notificaram.</p>
          {/* Rótulos longos ("Centro de Saúde/Unidade Básica de Saúde") quebram em duas
              linhas e colidem com a categoria vizinha; daí mais largura e mais altura. */}
          <GraficoBarras dados={tipos} chaveX="tipo" chaveY="casos" cor={cor} nome="Notificações"
                         horizontal larguraRotulo={210} alto />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Concentração por tipo de unidade (CNES)</h3></div>
          <p className="dica">Percentual das notificações absorvido por cada tipo de estabelecimento.</p>
          <div className="barras-pct">
            {tiposPct.map((t) => (
              <div key={t.tipo} className="barra-linha">
                <span className="barra-nome" title={t.tipo}>{t.tipo}</span>
                <div className="barra-trilho"><div className="barra-fill" style={{ width: `${t.pct}%`, background: cor }} /></div>
                <span className="barra-val">{pct(t.pct)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
