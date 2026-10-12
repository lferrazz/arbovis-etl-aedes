import { fmtBR } from "../../datas.js";
import { GraficoBarras, n, nd } from "../Graficos.jsx";

const pct = (v) => `${nd(v)}%`;

function faixasDeAnos(anos) {
  const faixas = [];
  for (const ano of [...anos].sort((a, b) => a - b)) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && ano === ultima[1] + 1) ultima[1] = ano;
    else faixas.push([ano, ano]);
  }
  const textos = faixas.map(([a, b]) => (a === b ? String(a) : `${a} a ${b}`));
  return textos.length > 1 ? `${textos.slice(0, -1).join(", ")} e ${textos[textos.length - 1]}` : textos[0];
}

export default function VisaoSintomas({ cor, sintomas, tipos, tiposPct, periodo }) {
  const lista = sintomas.sintomas;
  const semBase = lista.every((s) => s.pct == null);
  const anos = sintomas.anos_com_sintomas;
  const parcela = sintomas.total ? sintomas.com_sintomas / sintomas.total * 100 : 0;
  return (
    <>
      <div className="nota-ponte nota-intro">
        <b>Período selecionado:</b> {fmtBR(periodo.inicio)} a {fmtBR(periodo.fim)}.{" "}
        {anos.length > 0 ? (
          <>
            <b>Período que aparece no gráfico de sintomas:</b> {faixasDeAnos(anos)}, os anos em que a ficha
            do SINAN tinha os campos de sintoma. São {n(sintomas.com_sintomas)} de {n(sintomas.total)} casos
            prováveis ({pct(parcela)}). Os demais anos ficam fora do cálculo, em vez de contarem como quem
            não teve sintoma.
          </>
        ) : (
          <>Nenhum ano deste período tem os campos de sintoma na ficha do SINAN.</>
        )}
      </div>

      <div className="card">
        <div className="card-topo"><h3>Principais sintomas</h3></div>
        <p className="dica">
          Percentual de pessoas que relataram cada sintoma, entre os casos prováveis cuja ficha tem o
          campo preenchido. Passe o mouse na barra para ver quantas pessoas isso representa.
        </p>
        {semBase ? (
          <p className="dica">Nenhum caso provável do recorte tem os campos de sintoma na ficha.</p>
        ) : (
          <GraficoBarras dados={lista} chaveX="sintoma" chaveY="pct" cor={cor} nome="Relataram" horizontal
                         formatador={(v) => `${nd(v, 0)}%`}
                         formatadorTooltip={(v, s) => `${pct(v)} (${n(s.qtd)} de ${n(s.base)})`} />
        )}
      </div>
      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Onde os casos são atendidos</h3></div>
          <p className="dica">
            Quantidade de casos prováveis por tipo de unidade de saúde que fez a notificação, segundo o
            cadastro nacional de estabelecimentos (CNES).
          </p>
          <GraficoBarras dados={tipos} chaveX="tipo" chaveY="casos" cor={cor} nome="Casos prováveis"
                         horizontal larguraRotulo={210} alto />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Concentração por tipo de unidade (CNES)</h3></div>
          <p className="dica">
            Os mesmos tipos de unidade, agora em percentual: quanto do atendimento ficou com cada um.
            Mostra se os casos chegam mais pela atenção básica ou pelos hospitais.
          </p>
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
