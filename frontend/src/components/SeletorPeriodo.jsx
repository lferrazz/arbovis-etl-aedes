import { useEffect, useRef, useState } from "react";
import {
  atalhos, dataReferencia, diaDaSemana, diasEntre, diasNoMes, fmtBR,
  inicioMes, limitarIntervalo, mesSomado,
} from "../datas.js";
import { n } from "./Graficos.jsx";

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function Mes({ mes, rascunho, hover, limites, onDia, onHover }) {
  const ano = mes.slice(0, 4);
  const m = mes.slice(5, 7);
  // Enquanto só o início foi clicado, o dia sob o mouse faz o papel do fim.
  const outraPonta = rascunho.fim ?? (rascunho.inicio ? hover : null);
  const [lo, hi] = [rascunho.inicio, outraPonta].filter(Boolean).sort();

  const celulas = [];
  for (let i = 0; i < diaDaSemana(mes); i++) celulas.push(<span key={`v${i}`} />);
  for (let d = 1; d <= diasNoMes(mes); d++) {
    const iso = `${ano}-${m}-${String(d).padStart(2, "0")}`;
    const ponta = iso === lo || iso === hi;
    const dentro = lo && hi && iso > lo && iso < hi;
    celulas.push(
      <button
        key={iso} type="button"
        className={`dia${ponta ? " ponta" : ""}${dentro ? " dentro" : ""}`}
        disabled={iso < limites.inicio || iso > limites.fim}
        aria-label={fmtBR(iso)} aria-pressed={ponta}
        onClick={() => onDia(iso)} onMouseEnter={() => onHover(iso)}
      >
        {d}
      </button>,
    );
  }

  return (
    <div className="cal-mes">
      <div className="cal-titulo">{MESES[+m - 1]} {ano}</div>
      <div className="cal-grade">
        {SEMANA.map((s, i) => <span key={i} className="cal-sem">{s}</span>)}
        {celulas}
      </div>
    </div>
  );
}

function erroDoRascunho({ inicio, fim }, limites) {
  if (!inicio) return "Escolha a data inicial.";
  if (!fim) return "Escolha a data final.";
  if (inicio < limites.inicio || fim > limites.fim) {
    return `A base cobre de ${fmtBR(limites.inicio)} a ${fmtBR(limites.fim)}.`;
  }
  if (inicio > fim) return "A data inicial está depois da final.";
  return null;
}

export default function SeletorPeriodo({ inicio, fim, limites, onAplicar }) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState({ inicio, fim });
  const [hover, setHover] = useState(null);
  const [mes, setMes] = useState(inicioMes(fim));
  const raiz = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fora = (e) => { if (!raiz.current?.contains(e.target)) setAberto(false); };
    const tecla = (e) => { if (e.key === "Escape") setAberto(false); };
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", tecla);
    };
  }, [aberto]);

  const mesMin = inicioMes(limites.inicio);
  const mesMax = mesSomado(inicioMes(limites.fim), -1);
  const limitarMes = (m) => (m < mesMin ? mesMin : m > mesMax ? mesMax : m);
  // Mostra `iso` no mês da direita, com o anterior ao lado.
  const mostrarFim = (iso) => setMes(limitarMes(mesSomado(inicioMes(iso), -1)));

  function abrir() {
    setRascunho({ inicio, fim });
    setHover(null);
    mostrarFim(fim);
    setAberto(true);
  }

  function clicarDia(iso) {
    setRascunho((r) => {
      if (!r.inicio || r.fim) return { inicio: iso, fim: null };
      return iso < r.inicio ? { inicio: iso, fim: r.inicio } : { inicio: r.inicio, fim: iso };
    });
  }

  function escolher(intervalo) {
    setRascunho(intervalo);
    mostrarFim(intervalo.fim);
  }

  const digitar = (campo) => (e) => {
    const iso = e.target.value || null;
    setRascunho((r) => ({ ...r, [campo]: iso }));
    if (iso && iso >= limites.inicio && iso <= limites.fim) {
      if (campo === "inicio") setMes(limitarMes(inicioMes(iso)));
      else mostrarFim(iso);
    }
  };

  const erro = erroDoRascunho(rascunho, limites);
  function aplicar() {
    if (erro) return;
    onAplicar(rascunho.inicio, rascunho.fim);
    setAberto(false);
  }

  const lista = atalhos(limites);
  const anos = [];
  for (let a = +limites.inicio.slice(0, 4); a <= +limites.fim.slice(0, 4); a++) anos.push(a);
  const { inicio: ri, fim: rf } = rascunho;
  const anoInteiro = ri && rf && ri.slice(0, 4) === rf.slice(0, 4)
    && ri.slice(5) === "01-01" && rf.slice(5) === "12-31" ? ri.slice(0, 4) : "";

  return (
    <div className="campo periodo" ref={raiz}>
      <label htmlFor="periodo-gatilho">Período</label>
      <button
        id="periodo-gatilho" type="button" className="periodo-gatilho"
        aria-haspopup="dialog" aria-expanded={aberto}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4.5" width="18" height="16.5" rx="2.5" />
          <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
        </svg>
        <span>{fmtBR(inicio)} – {fmtBR(fim)}</span>
      </button>

      {aberto && (
        <div className="periodo-pop" role="dialog" aria-label="Escolher período">
          <div className="periodo-atalhos">
            <div className="periodo-sec">Atalhos</div>
            {lista.map((a) => (
              <button key={a.rotulo} type="button"
                      className={a.inicio === ri && a.fim === rf ? "ativo" : ""}
                      onClick={() => escolher(a)}>
                {a.rotulo}
              </button>
            ))}
            <div className="periodo-sec">Ano inteiro</div>
            <select
              aria-label="Ano inteiro" value={anoInteiro}
              onChange={(e) => e.target.value
                && escolher(limitarIntervalo(`${e.target.value}-01-01`, `${e.target.value}-12-31`, limites))}
            >
              <option value="">Escolher ano…</option>
              {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <p className="periodo-nota">
              Atalhos contam a partir de {fmtBR(dataReferencia(limites))}, último ano completo da base.
            </p>
          </div>

          <div className="periodo-cal">
            <div className="cal-nav">
              <button type="button" className="cal-seta" aria-label="Mês anterior"
                      disabled={mes <= mesMin} onClick={() => setMes(limitarMes(mesSomado(mes, -1)))}>‹</button>
              <div className="cal-saltos">
                <select aria-label="Mês" value={+mes.slice(5, 7)}
                        onChange={(e) => setMes(limitarMes(`${mes.slice(0, 4)}-${String(e.target.value).padStart(2, "0")}-01`))}>
                  {MESES.map((nome, i) => <option key={nome} value={i + 1}>{nome}</option>)}
                </select>
                <select aria-label="Ano" value={mes.slice(0, 4)}
                        onChange={(e) => setMes(limitarMes(`${e.target.value}-${mes.slice(5, 7)}-01`))}>
                  {anos.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <button type="button" className="cal-seta" aria-label="Próximo mês"
                      disabled={mes >= mesMax} onClick={() => setMes(limitarMes(mesSomado(mes, 1)))}>›</button>
            </div>

            <div className="cal-meses" onMouseLeave={() => setHover(null)}>
              {[mes, mesSomado(mes, 1)].map((m) => (
                <Mes key={m} mes={m} rascunho={rascunho} hover={hover} limites={limites}
                     onDia={clicarDia} onHover={setHover} />
              ))}
            </div>

            <div className="periodo-datas">
              <div className="campo">
                <label htmlFor="periodo-inicio">Início</label>
                <input id="periodo-inicio" type="date" value={ri ?? ""}
                       min={limites.inicio} max={limites.fim} onChange={digitar("inicio")} />
              </div>
              <div className="campo">
                <label htmlFor="periodo-fim">Fim</label>
                <input id="periodo-fim" type="date" value={rf ?? ""}
                       min={limites.inicio} max={limites.fim} onChange={digitar("fim")} />
              </div>
            </div>
          </div>

          <div className="periodo-rodape">
            <span className={erro ? "periodo-erro" : "periodo-info"} aria-live="polite">
              {erro ?? `${n(diasEntre(ri, rf))} dias selecionados`}
            </span>
            <div className="periodo-acoes">
              <button type="button" className="voltar" onClick={() => setAberto(false)}>Cancelar</button>
              <button type="button" className="periodo-aplicar" disabled={!!erro} onClick={aplicar}>Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
