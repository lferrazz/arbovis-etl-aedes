import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { useId } from "react";
import { rotuloPeriodo, rotuloPeriodoLongo } from "../datas.js";
import { Icone } from "./Icones.jsx";

const fmt = new Intl.NumberFormat("pt-BR");
export const n = (v) => fmt.format(v ?? 0);

// Para taxas: mantém casas decimais e marca ausência como "sem dado", nunca como 0.
export const nd = (v, casas = 1) =>
  v == null ? "sem dado" : v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

const EIXO = { fill: "#5c6773", fontSize: 12 };
const GRADE = "#e8edf4";
const TOOLTIP = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f1",
  borderRadius: 10,
  color: "#131c2b",
  boxShadow: "0 4px 12px rgba(20,30,50,.1)",
};

// `ajuda` (opcional): explicação que aparece num balão ao passar o mouse ou ao
// focar o card pelo teclado/toque, já que o `title` nativo não funciona no celular.
export function Kpi({ rotulo, valor, detalhe, cor, icone, ajuda }) {
  const idAjuda = useId();
  const completo = typeof valor === "number" ? n(valor) : valor;
  return (
    <div className={`kpi${ajuda ? " com-ajuda" : ""}`} style={{ "--kpi-cor": cor }}
         tabIndex={ajuda ? 0 : undefined} aria-describedby={ajuda ? idAjuda : undefined}>
      <div className="ico"><Icone nome={icone} /></div>
      <div className="kpi-texto">
        <div className="rotulo">
          <span className="rotulo-texto">{rotulo}</span>
          {ajuda && <span className="kpi-info" aria-hidden="true">i</span>}
        </div>
        <div className="valor">{completo}</div>
        {detalhe && <div className="kpi-detalhe">{detalhe}</div>}
      </div>
      {ajuda && <div className="kpi-ajuda" role="tooltip" id={idAjuda}>{ajuda}</div>}
    </div>
  );
}

// Barras em HTML com o número sempre visível, bom para distribuições em que
// categorias minúsculas (ex.: óbitos vs curas) sumiriam num gráfico em escala.
export function BarrasValor({ dados, chaveX, chaveY, cor }) {
  const max = Math.max(1, ...dados.map((d) => d[chaveY] || 0));
  return (
    <div className="barras-pct">
      {dados.map((d) => (
        <div key={d[chaveX]} className="barra-linha">
          <span className="barra-nome" title={d[chaveX]}>{d[chaveX]}</span>
          <div className="barra-trilho">
            <div className="barra-fill" style={{ width: `${(d[chaveY] || 0) / max * 100}%`, background: cor }} />
          </div>
          <span className="barra-val">{n(d[chaveY])}</span>
        </div>
      ))}
    </div>
  );
}

export function GraficoTemporal({ dados, cor, grau = "mes" }) {
  return (
    <div className="grafico">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey="periodo" tick={EIXO} minTickGap={40} tickFormatter={(p) => rotuloPeriodo(p, grau)} />
        <YAxis tick={EIXO} width={64} tickFormatter={n} />
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => n(v)} labelFormatter={(p) => rotuloPeriodoLongo(p, grau)} />
        <Legend />
        <Line type="monotone" dataKey="casos" name="Casos" stroke={cor} strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="mortes" name="Mortes" stroke="#f43f5e" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

export function GraficoLinhas({ dados, chaveX, series, formatador = n, dominioY }) {
  return (
    <div className="grafico">
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={dados} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke={GRADE} strokeDasharray="3 3" />
        <XAxis dataKey={chaveX} tick={EIXO} minTickGap={24} />
        <YAxis tick={EIXO} width={52} tickFormatter={formatador} domain={dominioY} />
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatador(v)} />
        <Legend />
        {series.map((s) => (
          <Line key={s.chave} type="monotone" dataKey={s.chave} name={s.nome}
                stroke={s.cor} strokeWidth={2} dot={{ r: 2.5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
    </div>
  );
}

// `series` (opcional) desenha várias barras agrupadas; sem ela o comportamento é
// exatamente o de antes, com uma barra só.
export function GraficoBarras({
  dados, chaveX, chaveY, cor, nome, horizontal, series, formatador = n,
  larguraRotulo = 158, alto = false,
}) {
  const barras = series || [{ chave: chaveY, nome, cor }];
  return (
    <div className={`grafico${alto ? " alto" : ""}`}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={dados}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 8, right: 24, bottom: 4, left: 8 }}
      >
        <CartesianGrid stroke={GRADE} strokeDasharray="3 3" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={EIXO} tickFormatter={formatador} />
            <YAxis type="category" dataKey={chaveX} tick={{ ...EIXO, fontSize: 11 }} width={larguraRotulo} />
          </>
        ) : (
          <>
            <XAxis dataKey={chaveX} tick={EIXO} />
            <YAxis tick={EIXO} width={64} tickFormatter={formatador} />
          </>
        )}
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => formatador(v)} cursor={{ fill: "#f1f4f9" }} />
        {series && <Legend />}
        {barras.map((b) => <Bar key={b.chave} dataKey={b.chave} name={b.nome} fill={b.cor} radius={4} />)}
      </BarChart>
    </ResponsiveContainer>
    </div>
  );
}

const CORES_SEXO = { F: "#ec4899", M: "#3b82f6", I: "#8b98a8", O: "#22c55e" };

export function GraficoSexo({ dados }) {
  const rotulo = { F: "Feminino", M: "Masculino", I: "Ignorado", O: "Outro" };
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={dados} dataKey="casos" nameKey="sexo" cx="50%" cy="50%" outerRadius={90}
             label={(d) => rotulo[d.sexo] || d.sexo}>
          {dados.map((d) => <Cell key={d.sexo} fill={CORES_SEXO[d.sexo] || "#8b98a8"} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP} formatter={(v) => n(v)} />
      </PieChart>
    </ResponsiveContainer>
  );
}
