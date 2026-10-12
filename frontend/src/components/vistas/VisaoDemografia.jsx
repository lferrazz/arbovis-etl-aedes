import { GraficoBarras, n, nd } from "../Graficos.jsx";

const ROTULO_SEXO = { F: "Feminino", M: "Masculino", I: "Ignorado" };

function porSexo(linhas) {
  const somas = {};
  for (const l of linhas) {
    const chave = ROTULO_SEXO[l.sexo] ? l.sexo : "I";
    somas[chave] = (somas[chave] || 0) + l.casos;
  }
  const total = Object.values(somas).reduce((s, v) => s + v, 0) || 1;
  return ["F", "M", "I"]
    .filter((k) => somas[k])
    .map((k) => ({ sexo: ROTULO_SEXO[k], casos: somas[k], pct: somas[k] / total * 100 }));
}

export default function VisaoDemografia({ cor, demografia }) {
  const sexo = porSexo(demografia.por_sexo);
  return (
    <div className="grade2">
      <div className="card">
        <div className="card-topo"><h3>Casos prováveis por faixa etária</h3></div>
        <p className="dica">
          Quantos casos prováveis houve em cada faixa de idade. As faixas com mais gente na população
          também tendem a ter mais casos.
        </p>
        <GraficoBarras dados={demografia.por_faixa} chaveX="faixa" chaveY="casos" cor={cor} nome="Casos prováveis" />
      </div>
      <div className="card">
        <div className="card-topo"><h3>Casos prováveis por sexo</h3></div>
        <p className="dica">
          Parcela dos casos prováveis do recorte em cada sexo. Ignorado reúne as fichas sem essa
          informação.
        </p>
        <div className="barras-pct">
          {sexo.map((s) => (
            <div key={s.sexo} className="barra-linha" title={`${n(s.casos)} casos prováveis`}>
              <span className="barra-nome">{s.sexo}</span>
              <div className="barra-trilho"><div className="barra-fill" style={{ width: `${s.pct}%`, background: cor }} /></div>
              <span className="barra-val">{nd(s.pct)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
