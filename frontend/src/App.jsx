import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api } from "./api.js";
import Painel from "./pages/Painel.jsx";
import { Icone } from "./components/Icones.jsx";
import SeletorPeriodo from "./components/SeletorPeriodo.jsx";
import { LIMITES_PADRAO, PERIODO_PADRAO } from "./datas.js";

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
  const [limites, setLimites] = useState(LIMITES_PADRAO);
  const [filtros, setFiltros] = useState({ uf: "", ...PERIODO_PADRAO });
  const [vista, setVista] = useState("geral");

  useEffect(() => {
    api("/ufs").then(setUfs).catch(() => setUfs([]));
    api("/periodo/limites")
      .then((l) => l?.inicio && l?.fim && setLimites(l))
      .catch(() => {});
  }, []);

  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));
  const aplicarPeriodo = (inicio, fim) => setFiltros((f) => ({ ...f, inicio, fim }));

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
              <label htmlFor="filtro-uf">UF</label>
              <select id="filtro-uf" value={filtros.uf} onChange={set("uf")}>
                <option value="">Brasil</option>
                {ufs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <SeletorPeriodo inicio={filtros.inicio} fim={filtros.fim} limites={limites} onAplicar={aplicarPeriodo} />
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
