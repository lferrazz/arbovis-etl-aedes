import { useEffect, useMemo, useState } from "react";
import { api, periodo } from "../api.js";
import { n } from "../components/Graficos.jsx";
import VisaoDemografia from "../components/vistas/VisaoDemografia.jsx";
import VisaoGeral from "../components/vistas/VisaoGeral.jsx";
import VisaoMapas from "../components/vistas/VisaoMapas.jsx";
import VisaoQualidade from "../components/vistas/VisaoQualidade.jsx";
import VisaoSintomas from "../components/vistas/VisaoSintomas.jsx";
import VisaoTendencias from "../components/vistas/VisaoTendencias.jsx";

const CORES = { dengue: "#ef4444", zika: "#a855f7", chikungunya: "#f59e0b" };

const TITULOS = {
  geral: "Visão geral",
  mapas: "Mapas interativos",
  tendencias: "Tendências temporais",
  demografia: "Perfil demográfico",
  sintomas: "Sintomas e atendimento",
  qualidade: "Qualidade dos dados",
};

function rankingUf(porUf) {
  return [...porUf].sort((a, b) => b.casos - a.casos).slice(0, 10);
}

function tiposPct(tipos) {
  const total = tipos.reduce((s, t) => s + t.casos, 0) || 1;
  return tipos.map((t) => ({ tipo: t.tipo, pct: +(t.casos / total * 100).toFixed(1) }));
}

function listaMunicipios(cidades, busca, temUf) {
  return cidades
    .filter((m) => !busca || m.municipio.toLowerCase().includes(busca.toLowerCase()))
    .slice(0, temUf ? 400 : 15);
}

function nomeExibicao(doenca) {
  return doenca ? doenca[0].toUpperCase() + doenca.slice(1) : "arboviroses";
}

export default function Painel({ doenca, filtros, setFiltros, vista }) {
  const cor = CORES[doenca] || "#10a37f";

  const [dados, setDados] = useState(null);
  const [serie, setSerie] = useState([]);
  const [granularidade, setGranularidade] = useState("mes");
  const [municipioSel, setMunicipioSel] = useState(null);
  const [bairros, setBairros] = useState([]);
  const [busca, setBusca] = useState("");
  const [mesorregiaoSel, setMesorregiaoSel] = useState(null);
  const [cidadesMeso, setCidadesMeso] = useState(null);
  const [qualidade, setQualidade] = useState(null);

  const params = useMemo(
    () => ({ doenca, uf: filtros.uf, ...periodo(filtros.anoInicio, filtros.anoFim) }),
    [doenca, filtros],
  );

  useEffect(() => {
    let vivo = true;
    setDados(null); setMunicipioSel(null); setBusca(""); setMesorregiaoSel(null); setCidadesMeso(null);
    Promise.all([
      api("/resumo", params),
      api("/sintomas", params),
      api("/demografia", params),
      api("/estabelecimentos/tipos", params),
      api("/casos/mapa", { ...params, limite: filtros.uf ? 5570 : 20 }),
      api("/casos/por-uf", { doenca, ...periodo(filtros.anoInicio, filtros.anoFim) }),
      api("/casos/sazonalidade", params),
      api("/casos/por-regiao", params),
      api("/casos/desfecho", params),
      api("/casos/por-mesorregiao", params),
    ])
      .then(([resumo, sintomas, demografia, tipos, mapa, porUf, sazonal, regiao, desfecho, mesorregioes]) => {
        if (vivo) setDados({ resumo, sintomas, demografia, tipos, mapa, porUf, sazonal, regiao, desfecho, mesorregioes });
      })
      .catch((e) => vivo && setDados({ erro: e.message }));
    return () => { vivo = false; };
  }, [params, doenca]);

  useEffect(() => {
    let vivo = true;
    api("/casos/temporal", { ...params, granularidade })
      .then((d) => vivo && setSerie(d)).catch(() => vivo && setSerie([]));
    return () => { vivo = false; };
  }, [params, granularidade]);

  // Isolado: se o /qualidade ainda não existir (antes do re-run do ETL),
  // só esta aba fica indisponível — não derruba o resto do dashboard.
  useEffect(() => {
    let vivo = true;
    api("/qualidade", { doenca })
      .then((d) => vivo && setQualidade(d)).catch(() => vivo && setQualidade(null));
    return () => { vivo = false; };
  }, [doenca]);

  function abrirMunicipio(m) {
    setMunicipioSel(m);
    api(`/bairros/${m.cod_ibge}`, { doenca, ...periodo(filtros.anoInicio, filtros.anoFim) })
      .then(setBairros).catch(() => setBairros([]));
  }

  function abrirMeso(meso) {
    if (meso === mesorregiaoSel) { setMesorregiaoSel(null); setCidadesMeso(null); return; }
    setMesorregiaoSel(meso);
    api("/casos/mapa", { ...params, mesorregiao: meso, limite: 5570 }).then(setCidadesMeso).catch(() => setCidadesMeso([]));
  }

  function limparSelecaoMapa() {
    setMunicipioSel(null); setMesorregiaoSel(null); setCidadesMeso(null);
  }

  const selecionarUf = (uf) => setFiltros((f) => ({ ...f, uf }));
  const voltarBrasil = () => { selecionarUf(""); limparSelecaoMapa(); };

  if (!dados) return <div className="carregando">Carregando dados…</div>;
  if (dados.erro) return <div className="carregando">Erro ao carregar: {dados.erro}</div>;

  const { resumo, sintomas, demografia, tipos, mapa, porUf, sazonal, regiao, desfecho, mesorregioes } = dados;
  const cidades = cidadesMeso || mapa;
  const nomeExib = nomeExibicao(doenca);
  const local = filtros.uf || "o Brasil";
  const listaMun = listaMunicipios(cidades, busca, !!filtros.uf);

  const SUBS = {
    geral: (
      <>Entre {filtros.anoInicio} e {filtros.anoFim}, {local} registrou <b>{n(resumo.casos)}</b>{" "}
        casos {doenca ? `de ${nomeExib}` : "das arboviroses"}, com <b>{n(resumo.obitos)}</b> óbitos.</>
    ),
    mapas: "Clique numa mesorregião para filtrar por estado; depois, clique novamente para ver os municípios.",
    tendencias: "Casos e óbitos ao longo do tempo — ajuste a granularidade (semana, mês ou ano).",
    demografia: "Distribuição das notificações por faixa etária.",
    sintomas: "Sinais clínicos mais relatados e os tipos de unidade que absorvem os casos.",
    qualidade: "Quantos registros são indivíduos (com data e cidade) e quantos ficaram sem informação. Considera toda a base — ignora os filtros de UF e período.",
  };

  return (
    <>
      <h1 className="vista-titulo">{TITULOS[vista]}{doenca ? ` · ${nomeExib}` : ""}</h1>
      <p className="vista-sub">{SUBS[vista]}</p>

      {vista === "geral" && (
        <VisaoGeral cor={cor} resumo={resumo} serie={serie} mapa={mapa}
                    sazonal={sazonal} regiao={regiao} desfecho={desfecho} ufSel={filtros.uf} />
      )}

      {vista === "mapas" && (
        <VisaoMapas filtros={filtros} onVoltarBrasil={voltarBrasil} onVoltarMesorregioes={limparSelecaoMapa}
                    mesorregioes={mesorregioes} mesorregiaoSel={mesorregiaoSel} onSelectMeso={abrirMeso}
                    municipioSel={municipioSel} onSelectMunicipio={abrirMunicipio} onSelectUf={selecionarUf}
                    cidadesMeso={cidadesMeso} listaMun={listaMun} busca={busca} setBusca={setBusca}
                    bairros={bairros} />
      )}

      {vista === "tendencias" && (
        <VisaoTendencias cor={cor} serie={serie} granularidade={granularidade} setGranularidade={setGranularidade}
                         sazonal={sazonal} rankingUf={rankingUf(porUf)} />
      )}

      {vista === "demografia" && (
        <VisaoDemografia cor={cor} demografia={demografia} desfecho={desfecho} />
      )}

      {vista === "sintomas" && (
        <VisaoSintomas cor={cor} sintomas={sintomas} tipos={tipos} tiposPct={tiposPct(tipos)} />
      )}

      {vista === "qualidade" && <VisaoQualidade qualidade={qualidade} />}
    </>
  );
}
