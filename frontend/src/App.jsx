import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api.js";
import Painel from "./pages/Painel.jsx";
import { Icone } from "./components/Icones.jsx";

const ANOS = Array.from({ length: 26 }, (_, i) => 2000 + i);
const VISTAS = [
  ["geral", "Visão Geral"],
  ["mapas", "Mapas Interativos"],
  ["tendencias", "Tendências Temporais"],
  ["demografia", "Dados Demográficos"],
  ["sintomas", "Sintomas"],
  ["qualidade", "Qualidade dos Dados"],
];

export default function App() {
  const [ufs, setUfs] = useState([]);
  const [filtros, setFiltros] = useState({ uf: "", anoInicio: 2000, anoFim: 2025 });
  const [vista, setVista] = useState("geral");

  useEffect(() => {
    api("/ufs").then(setUfs).catch(() => setUfs([]));
  }, []);

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const props = { filtros, setFiltros, vista };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="marca"><Icone nome="logo" /> Arbo<span style={{ color: "var(--accent)" }}>Vis</span></div>
        <div className="grupo">Navegação</div>
        <nav>
          {VISTAS.map(([id, rotulo]) => (
            <button key={id} className={vista === id ? "ativo" : ""} onClick={() => setVista(id)}>
              <Icone nome={id} /> {rotulo}
            </button>
          ))}
        </nav>
        <div className="rodape">Dados: DATASUS / SINAN · CNES · IBGE</div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="tabs">
            <NavLink to="/" end>Consolidado</NavLink>
            <NavLink to="/dengue">Dengue</NavLink>
            <NavLink to="/zika">Zika</NavLink>
            <NavLink to="/chikungunya">Chikungunya</NavLink>
          </div>
          <div className="esticar" />
          <div className="filtros">
            <div className="campo">
              <label>UF</label>
              <select value={filtros.uf} onChange={set("uf")}>
                <option value="">Brasil</option>
                {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>De</label>
              <select value={filtros.anoInicio} onChange={set("anoInicio")}>
                {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="campo">
              <label>Até</label>
              <select value={filtros.anoFim} onChange={set("anoFim")}>
                {ANOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="conteudo">
          <Routes>
            <Route path="/" element={<Painel {...props} />} />
            <Route path="/dengue" element={<Painel doenca="dengue" {...props} />} />
            <Route path="/zika" element={<Painel doenca="zika" {...props} />} />
            <Route path="/chikungunya" element={<Painel doenca="chikungunya" {...props} />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
