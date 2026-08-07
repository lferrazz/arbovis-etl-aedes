import { BarrasValor, GraficoBarras } from "../Graficos.jsx";

export default function VisaoDemografia({ cor, demografia, desfecho }) {
  return (
    <div className="grade2">
      <div className="card">
        <div className="card-topo"><h3>Casos por faixa etária</h3></div>
        <p className="dica">Notificações em cada faixa de idade.</p>
        <GraficoBarras dados={demografia.por_faixa} chaveX="faixa" chaveY="casos" cor={cor} nome="Casos" />
      </div>
      <div className="card">
        <div className="card-topo"><h3>Desfecho dos casos</h3></div>
        <p className="dica">Evolução: cura, óbito, em investigação ou ignorado.</p>
        <BarrasValor dados={desfecho} chaveX="desfecho" chaveY="casos" cor={cor} />
      </div>
    </div>
  );
}
