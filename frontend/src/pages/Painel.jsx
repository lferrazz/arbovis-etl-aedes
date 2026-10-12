import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { n } from "../components/Graficos.jsx";
import VisaoDemografia from "../components/vistas/VisaoDemografia.jsx";
import VisaoGeral from "../components/vistas/VisaoGeral.jsx";
import VisaoMapas from "../components/vistas/VisaoMapas.jsx";
import VisaoQualidade from "../components/vistas/VisaoQualidade.jsx";
import VisaoSintomas from "../components/vistas/VisaoSintomas.jsx";
import VisaoTendencias from "../components/vistas/VisaoTendencias.jsx";
import { GRAOS, INICIO_DADOS, completarSerie, fmtBR, grauPermitido, grauSugerido } from "../datas.js";
import { normalizar } from "../texto.js";

const CORES = { dengue: "#2563eb", zika: "#a855f7", chikungunya: "#f59e0b" };

const TITULOS = {
  geral: "Visão geral",
  mapas: "Mapas interativos",
  tendencias: "Tendências temporais",
  demografia: "Perfil demográfico",
  sintomas: "Sintomas e atendimento",
  qualidade: "Qualidade dos dados",
};

function ordenarPorMetrica(lista, metrica) {
  if (metrica !== "incidencia") return lista;
  return lista.filter((x) => x.incidencia != null).sort((a, b) => b.incidencia - a.incidencia);
}

function rankingUf(porUf, metrica) {
  const lista = metrica === "incidencia" ? porUf : [...porUf].sort((a, b) => b.casos - a.casos);
  return ordenarPorMetrica(lista, metrica).slice(0, 10);
}

function tiposPct(tipos) {
  const total = tipos.reduce((s, t) => s + t.casos, 0) || 1;
  return tipos.map((t) => ({ tipo: t.tipo, pct: t.casos / total * 100 }));
}

function listaMunicipios(cidades, busca, temUf) {
  const termo = normalizar(busca);
  return cidades
    .filter((m) => !termo || normalizar(m.municipio).includes(termo))
    .slice(0, temUf ? 400 : 15);
}

function nomeExibicao(doenca) {
  return doenca ? doenca[0].toUpperCase() + doenca.slice(1) : "arboviroses";
}

export default function Painel({ doenca, filtros, setFiltros, vista }) {
  const cor = CORES[doenca] || "#10a37f";

  const [dados, setDados] = useState(null);
  const [serie, setSerie] = useState({ chave: "", dados: [] });
  const [grauEscolhido, setGrauEscolhido] = useState({ chave: "", grau: null });
  const [municipioSel, setMunicipioSel] = useState(null);
  const [bairros, setBairros] = useState([]);
  const [busca, setBusca] = useState("");
  const [mesorregiaoSel, setMesorregiaoSel] = useState(null);
  const [cidadesMeso, setCidadesMeso] = useState(null);
  const [qualidade, setQualidade] = useState(null);
  const ultimoPedidoBairros = useRef(null);

  const [modoComparar, setModoComparar] = useState(false);
  const [comparar, setComparar] = useState([]);
  const [comparacao, setComparacao] = useState(null);
  const [panorama, setPanorama] = useState(null);
  const [metricaGeo, setMetricaGeo] = useState("casos");
  const [topIncidencia, setTopIncidencia] = useState({ chave: "", dados: [] });

  const periodo = useMemo(() => ({ inicio: filtros.inicio, fim: filtros.fim }), [filtros.inicio, filtros.fim]);
  const params = useMemo(() => ({ doenca, uf: filtros.uf, ...periodo }), [doenca, filtros.uf, periodo]);

  const chavePeriodo = `${periodo.inicio}|${periodo.fim}`;
  const granularidade =
    grauEscolhido.chave === chavePeriodo && grauPermitido(grauEscolhido.grau, periodo.inicio, periodo.fim)
      ? grauEscolhido.grau
      : grauSugerido(periodo.inicio, periodo.fim);
  const setGranularidade = (grau) => setGrauEscolhido({ chave: chavePeriodo, grau });

  useEffect(() => {
    let vivo = true;
    setDados(null); setMunicipioSel(null); setBusca(""); setMesorregiaoSel(null); setCidadesMeso(null);
    Promise.all([
      api("/resumo", params),
      api("/sintomas", params),
      api("/demografia", params),
      api("/estabelecimentos/tipos", params),
      api("/casos/mapa", { ...params, limite: filtros.uf ? 5570 : 20 }),
      api("/casos/por-uf", { doenca, ...periodo }),
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
  }, [params, periodo, doenca, filtros.uf]);

  const chaveSerie = `${JSON.stringify(params)}|${granularidade}`;
  useEffect(() => {
    let vivo = true;
    api("/casos/temporal", { ...params, granularidade })
      .then((d) => vivo && setSerie({ chave: chaveSerie, dados: d }))
      .catch(() => vivo && setSerie({ chave: chaveSerie, dados: [] }));
    return () => { vivo = false; };
  }, [params, granularidade, chaveSerie]);

  const serieVisivel = useMemo(
    () => (serie.chave === chaveSerie
      ? completarSerie(serie.dados, granularidade, periodo.inicio, periodo.fim, INICIO_DADOS[doenca])
      : []),
    [serie, chaveSerie, granularidade, periodo, doenca],
  );

  const chaveTop = JSON.stringify(params);
  const precisaTop = metricaGeo === "incidencia" && !filtros.uf;
  useEffect(() => {
    if (!precisaTop) return undefined;
    let vivo = true;
    api("/casos/mapa", { ...params, limite: 20, ordem: "incidencia" })
      .then((d) => vivo && setTopIncidencia({ chave: chaveTop, dados: d }))
      .catch(() => vivo && setTopIncidencia({ chave: chaveTop, dados: [] }));
    return () => { vivo = false; };
  }, [precisaTop, params, chaveTop]);

  const [todosMunicipios, setTodosMunicipios] = useState(null);
  useEffect(() => {
    if (!modoComparar || (todosMunicipios && !todosMunicipios.erro)) return;
    setTodosMunicipios(null);
    api("/municipios")
      .then(setTodosMunicipios)
      .catch((e) => setTodosMunicipios({ erro: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoComparar]);

  const codsComparar = comparar.map((c) => c.cod_ibge).join(",");
  useEffect(() => {
    if (comparar.length < 2) { setComparacao(null); return undefined; }
    let vivo = true;
    setComparacao({ carregando: true });
    api("/municipios/comparar", { cods: codsComparar, ...periodo })
      .then((d) => vivo && setComparacao({ dados: d }))
      .catch((e) => vivo && setComparacao({ erro: e.message }));
    return () => { vivo = false; };
  }, [codsComparar, comparar.length, periodo]);

  function alternarComparar(m) {
    setComparar((atual) => {
      if (atual.some((c) => c.cod_ibge === m.cod_ibge)) {
        return atual.filter((c) => c.cod_ibge !== m.cod_ibge);
      }
      if (atual.length >= 4) return atual;
      return [...atual, { cod_ibge: m.cod_ibge, municipio: m.municipio, uf: m.uf || filtros.uf }];
    });
  }

  function limparComparacao() {
    setComparar([]); setModoComparar(false);
  }

  function selecionarMunicipio(m) {
    if (modoComparar) alternarComparar(m);
    else abrirMunicipio(m);
  }

  useEffect(() => {
    let vivo = true;
    setQualidade({ carregando: true });
    api("/qualidade", params)
      .then((d) => vivo && setQualidade(d))
      .catch((e) => vivo && setQualidade({ erro: e.message }));
    return () => { vivo = false; };
  }, [params]);

  function abrirMunicipio(m) {
    setMunicipioSel(m);
    setBairros([]);
    setPanorama({ carregando: true });
    ultimoPedidoBairros.current = m.cod_ibge;

    api("/municipios/comparar", { cods: String(m.cod_ibge), ...periodo })
      .then((d) => { if (ultimoPedidoBairros.current === m.cod_ibge) setPanorama({ dados: d[0] }); })
      .catch((e) => { if (ultimoPedidoBairros.current === m.cod_ibge) setPanorama({ erro: e.message }); });

    api(`/bairros/${m.cod_ibge}`, { doenca, ...periodo })
      .then((d) => { if (ultimoPedidoBairros.current === m.cod_ibge) setBairros(d); })
      .catch(() => { if (ultimoPedidoBairros.current === m.cod_ibge) setBairros([]); });
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
  const baseCidades = cidadesMeso
    || (precisaTop ? (topIncidencia.chave === chaveTop ? topIncidencia.dados : []) : mapa);
  const cidades = ordenarPorMetrica(baseCidades, metricaGeo);
  const mesorregioesOrd = ordenarPorMetrica(mesorregioes, metricaGeo);
  const nomeExib = nomeExibicao(doenca);
  const local = filtros.uf || "o Brasil";
  const listaMun = listaMunicipios(cidades, busca, !!filtros.uf);
  const grausPermitidos = Object.fromEntries(
    GRAOS.map(([g]) => [g, grauPermitido(g, periodo.inicio, periodo.fim)]),
  );

  const SUBS = {
    geral: (
      <>Entre {fmtBR(periodo.inicio)} e {fmtBR(periodo.fim)}, {local} registrou <b>{n(resumo.casos)}</b>{" "}
        casos prováveis {doenca ? `de ${nomeExib}` : "de arboviroses"}, dos quais <b>{n(resumo.confirmados)}</b>{" "}
        foram confirmados, com <b>{n(resumo.obitos)}</b> óbitos entre os confirmados. Caso provável é toda
        notificação que não foi descartada.</>
    ),
    mapas: "O mapa mostra onde os casos se concentram. Clique numa mesorregião para abrir o estado e, depois, "
      + "numa cidade para ver as unidades de saúde. Em Atendidos, cada caso conta para a cidade onde foi "
      + "notificado. Em Incidência, conta para a cidade onde a pessoa mora, em relação à população.",
    tendencias: (
      <>Como os casos prováveis e os óbitos variaram de {fmtBR(periodo.inicio)} a {fmtBR(periodo.fim)}. Cada
        ponto soma os casos de um dia, semana, mês ou ano, conforme o tamanho do período escolhido no calendário.</>
    ),
    demografia: "Quem adoeceu: os casos prováveis do recorte divididos por faixa de idade e por sexo.",
    sintomas: "Os sinais clínicos registrados nas fichas e os tipos de unidade de saúde que atenderam os casos.",
    qualidade: "Quanto da base veio completa do SINAN e o que falta em cada campo, no mesmo recorte de doença, "
      + "UF e período das outras abas.",
  };

  return (
    <>
      <h1 className="vista-titulo">{TITULOS[vista]}{doenca ? ` · ${nomeExib}` : ""}</h1>
      <p className="vista-sub">{SUBS[vista]}</p>

      {vista === "geral" && (
        <VisaoGeral cor={cor} resumo={resumo} serie={serieVisivel} grau={granularidade} locais={cidades}
                    sazonal={sazonal} regiao={regiao} desfecho={desfecho} ufSel={filtros.uf}
                    metrica={metricaGeo} setMetrica={setMetricaGeo} />
      )}

      {vista === "mapas" && (
        <VisaoMapas filtros={filtros} onVoltarBrasil={voltarBrasil} onVoltarMesorregioes={limparSelecaoMapa}
                    mesorregioes={mesorregioesOrd} mesorregiaoSel={mesorregiaoSel} onSelectMeso={abrirMeso}
                    municipioSel={municipioSel} onSelectMunicipio={selecionarMunicipio} onSelectUf={selecionarUf}
                    cidadesMeso={cidadesMeso} listaMun={listaMun} busca={busca} setBusca={setBusca}
                    bairros={bairros} panorama={panorama}
                    modoComparar={modoComparar} setModoComparar={setModoComparar}
                    comparar={comparar} onAlternarComparar={alternarComparar} todosMunicipios={todosMunicipios}
                    comparacao={comparacao} metrica={metricaGeo} setMetrica={setMetricaGeo}
                    onLimparComparacao={limparComparacao} />
      )}

      {vista === "tendencias" && (
        <VisaoTendencias cor={cor} serie={serieVisivel} granularidade={granularidade}
                         setGranularidade={setGranularidade} permitidos={grausPermitidos}
                         sazonal={sazonal} rankingUf={rankingUf(porUf, metricaGeo)}
                         metrica={metricaGeo} setMetrica={setMetricaGeo} />
      )}

      {vista === "demografia" && (
        <VisaoDemografia cor={cor} demografia={demografia} />
      )}

      {vista === "sintomas" && (
        <VisaoSintomas cor={cor} sintomas={sintomas} tipos={tipos} tiposPct={tiposPct(tipos)} periodo={periodo} />
      )}

      {vista === "qualidade" && <VisaoQualidade qualidade={qualidade} ufSel={filtros.uf} />}
    </>
  );
}
