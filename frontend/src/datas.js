// Datas trafegam como ISO "AAAA-MM-DD", o mesmo formato da API. Comparar
// strings ISO já dá a ordem cronológica. As contas são em UTC para o fuso do
// navegador não deslocar dias.

export const LIMITES_PADRAO = { inicio: "2000-01-01", fim: "2026-04-03" };

// 2026 só tem um resto de notificações tardias; o último ano completo é 2025.
export const FIM_REFERENCIA = "2025-12-31";
export const PERIODO_PADRAO = { inicio: "2000-01-01", fim: FIM_REFERENCIA };

const DIA_MS = 86_400_000;
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function paraData(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d));
}
const paraIso = (dt) => dt.toISOString().slice(0, 10);

export const addDias = (iso, n) => paraIso(new Date(paraData(iso).getTime() + n * DIA_MS));
export const inicioMes = (iso) => `${iso.slice(0, 7)}-01`;
export const diaDaSemana = (iso) => paraData(iso).getUTCDay();
export const diasEntre = (a, b) => Math.round((paraData(b) - paraData(a)) / DIA_MS) + 1;
export const fmtBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "sem data");

export function mesSomado(iso, n) {
  const dt = paraData(iso);
  return paraIso(new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + n, 1)));
}

export function diasNoMes(iso) {
  const dt = paraData(iso);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
}

function segundaDaSemana(iso) {
  return addDias(iso, -((diaDaSemana(iso) + 6) % 7));
}

// ── Granularidade da série ──

export const GRAOS = [["dia", "Dia"], ["semana", "Semana"], ["mes", "Mês"], ["ano", "Ano"]];

// Acima disso o gráfico vira um borrão de pontos (2 anos por dia = 731 pontos).
const MAX_DIAS = { dia: 731, semana: 3653, mes: Infinity, ano: Infinity };
export const LIMITE_TEXTO = { dia: "até 2 anos", semana: "até 10 anos" };

export const grauPermitido = (grau, inicio, fim) => diasEntre(inicio, fim) <= (MAX_DIAS[grau] ?? -1);

export function grauSugerido(inicio, fim) {
  const dias = diasEntre(inicio, fim);
  if (dias <= 92) return "dia";
  if (dias <= 731) return "semana";
  if (dias <= 366 * 8) return "mes";
  return "ano";
}

function periodosDoIntervalo(grau, inicio, fim) {
  const chaves = [];
  if (grau === "ano") {
    for (let a = +inicio.slice(0, 4); a <= +fim.slice(0, 4); a++) chaves.push(String(a));
  } else if (grau === "mes") {
    for (let m = inicioMes(inicio); m <= fim; m = mesSomado(m, 1)) chaves.push(m.slice(0, 7));
  } else {
    const passo = grau === "semana" ? 7 : 1;
    for (let d = grau === "semana" ? segundaDaSemana(inicio) : inicio; d <= fim; d = addDias(d, passo)) chaves.push(d);
  }
  return chaves;
}

// A API só devolve períodos que tiveram notificação. Sem preencher, um dia
// sem casos some e a linha liga os vizinhos, sugerindo casos que não houve.
export function completarSerie(dados, grau, inicio, fim) {
  const porPeriodo = new Map(dados.map((r) => [r.periodo, r]));
  return periodosDoIntervalo(grau, inicio, fim).map(
    (p) => porPeriodo.get(p) ?? { periodo: p, casos: 0, mortes: 0 },
  );
}

export function rotuloPeriodo(p, grau) {
  if (!p || grau === "ano") return p;
  if (grau === "mes") return `${MESES_CURTOS[+p.slice(5, 7) - 1]}/${p.slice(2, 4)}`;
  return `${p.slice(8, 10)}/${p.slice(5, 7)}/${p.slice(2, 4)}`;
}

export function rotuloPeriodoLongo(p, grau) {
  if (!p || grau === "ano") return p;
  if (grau === "mes") return `${MESES_CURTOS[+p.slice(5, 7) - 1]} de ${p.slice(0, 4)}`;
  if (grau === "semana") return `Semana de ${fmtBR(p)} a ${fmtBR(addDias(p, 6))}`;
  return fmtBR(p);
}

// ── Atalhos do calendário ──

export const dataReferencia = (limites) => (limites.fim < FIM_REFERENCIA ? limites.fim : FIM_REFERENCIA);

export function atalhos(limites) {
  const ref = dataReferencia(limites);
  const ano = +ref.slice(0, 4);
  const lista = [
    ["Últimos 30 dias", addDias(ref, -29), ref],
    ["Últimos 90 dias", addDias(ref, -89), ref],
    ["Últimos 12 meses", addDias(`${ano - 1}${ref.slice(4)}`, 1), ref],
    [`Ano de ${ano}`, `${ano}-01-01`, `${ano}-12-31`],
    ["Últimos 5 anos", `${ano - 4}-01-01`, ref],
    ["Série completa", limites.inicio, limites.fim],
  ];
  return lista.map(([rotulo, inicio, fim]) => ({ rotulo, ...limitarIntervalo(inicio, fim, limites) }));
}

export function limitarIntervalo(inicio, fim, limites) {
  return {
    inicio: inicio < limites.inicio ? limites.inicio : inicio,
    fim: fim > limites.fim ? limites.fim : fim,
  };
}
