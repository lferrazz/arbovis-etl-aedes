import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api.js";
import { n } from "../components/Graficos.jsx";
import VisaoDemografia from "../components/vistas/VisaoDemografia.jsx";
import VisaoGeral from "../components/vistas/VisaoGeral.jsx";
import VisaoMapas from "../components/vistas/VisaoMapas.jsx";
import VisaoQualidade from "../components/vistas/VisaoQualidade.jsx";
import VisaoSintomas from "../components/vistas/VisaoSintomas.jsx";
import VisaoTendencias from "../components/vistas/VisaoTendencias.jsx";
import { GRAOS, completarSerie, fmtBR, grauPermitido, grauSugerido } from "../datas.js";

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
  const [metricaComp, setMetricaComp] = useState("por100mil");

  const periodo = useMemo(() => ({ inicio: filtros.inicio, fim: filtros.fim }), [filtros.inicio, filtros.fim]);
  const params = useMemo(() => ({ doenca, uf: filtros.uf, ...periodo }), [doenca, filtros.uf, periodo]);

  // A escolha manual de granularidade vale só para o período em que foi feita;
  // mudou o período, volta a sugestão automática (dia/semana/mês/ano).
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

  // Enquanto a série nova não chega, não mostra a antiga com o eixo do período novo.
  const serieVisivel = useMemo(
    () => (serie.chave === chaveSerie
      ? completarSerie(serie.dados, granularidade, periodo.inicio, periodo.fim)
      : []),
    [serie, chaveSerie, granularidade, periodo],
  );

  // Trocar de UF invalida as cidades escolhidas; trocar de doença NÃO — a
  // comparação é sempre das três doenças, independente da aba.
  useEffect(() => {
    setComparar([]); setComparacao(null); setModoComparar(false);
  }, [filtros.uf]);

  const codsComparar = comparar.map((c) => c.cod_ibge).join(",");
  useEffect(() => {
    if (comparar.length < 2) { setComparacao(null); return undefined; }
    let vivo = true;
    setComparacao({ carregando: true });
    api("/municipios/comparar", { cods: codsComparar, ...periodo })
      .then((d) => vivo && setComparacao({ dados: d }))
      .catch((e) => vivo && setComparacao({ erro: e.message }));
    return () => { vivo = false; };
    // comparar.length vem de codsComparar; depender da string evita refetch por identidade nova
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

  // Um handler só para as duas origens de clique (lista e polígono do mapa),
  // senão "escolher um município" faria coisas diferentes em cada lugar.
  function selecionarMunicipio(m) {
    if (modoComparar) alternarComparar(m);
    else abrirMunicipio(m);
  }

  // Isolado dos demais: se /qualidade falhar, só esta aba mostra o erro.
  // Usa os mesmos filtros das outras abas (doença, UF e período).
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
    // Limpa a lista anterior e ignora resposta atrasada de uma cidade já trocada —
    // senão a tela rola até um card ainda mostrando as unidades da cidade anterior.
    setBairros([]);
    ultimoPedidoBairros.current = m.cod_ibge;
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
  const cidades = cidadesMeso || mapa;
  const nomeExib = nomeExibicao(doenca);
  const local = filtros.uf || "o Brasil";
  const listaMun = listaMunicipios(cidades, busca, !!filtros.uf);
  const grausPermitidos = Object.fromEntries(
    GRAOS.map(([g]) => [g, grauPermitido(g, periodo.inicio, periodo.fim)]),
  );

  const SUBS = {
    geral: (
      <>Entre {fmtBR(periodo.inicio)} e {fmtBR(periodo.fim)}, {local} registrou <b>{n(resumo.casos)}</b>{" "}
        casos {doenca ? `de ${nomeExib}` : "das arboviroses"}, com <b>{n(resumo.obitos)}</b> óbitos.</>
    ),
    mapas: "Clique numa mesorregião para filtrar por estado; depois, clique novamente para ver os municípios.",
    tendencias: (
      <>Casos e óbitos de {fmtBR(periodo.inicio)} a {fmtBR(periodo.fim)}. A granularidade se ajusta ao
        período escolhido no calendário, e dá para trocar entre dia, semana, mês e ano.</>
    ),
    demografia: "Distribuição das notificações por faixa etária.",
    sintomas: "Sinais clínicos mais relatados e os tipos de unidade que absorvem os casos.",
    qualidade: "Quanto da base está completa e o que falta em cada campo, no mesmo recorte de doença, UF e período das outras abas. Registros sem data entram no período pelo ano da notificação.",
  };

  return (
    <>
      <h1 className="vista-titulo">{TITULOS[vista]}{doenca ? ` · ${nomeExib}` : ""}</h1>
      <p className="vista-sub">{SUBS[vista]}</p>

      {vista === "geral" && (
        <VisaoGeral cor={cor} resumo={resumo} serie={serieVisivel} grau={granularidade} mapa={mapa}
                    sazonal={sazonal} regiao={regiao} desfecho={desfecho} ufSel={filtros.uf} />
      )}

      {vista === "mapas" && (
        <VisaoMapas filtros={filtros} onVoltarBrasil={voltarBrasil} onVoltarMesorregioes={limparSelecaoMapa}
                    mesorregioes={mesorregioes} mesorregiaoSel={mesorregiaoSel} onSelectMeso={abrirMeso}
                    municipioSel={municipioSel} onSelectMunicipio={selecionarMunicipio} onSelectUf={selecionarUf}
                    cidadesMeso={cidadesMeso} listaMun={listaMun} busca={busca} setBusca={setBusca}
                    bairros={bairros}
                    modoComparar={modoComparar} setModoComparar={setModoComparar}
                    comparar={comparar} onAlternarComparar={alternarComparar}
                    comparacao={comparacao} metricaComp={metricaComp} setMetricaComp={setMetricaComp}
                    onLimparComparacao={limparComparacao} />
      )}

      {vista === "tendencias" && (
        <VisaoTendencias cor={cor} serie={serieVisivel} granularidade={granularidade}
                         setGranularidade={setGranularidade} permitidos={grausPermitidos}
                         sazonal={sazonal} rankingUf={rankingUf(porUf)} />
      )}

      {vista === "demografia" && (
        <VisaoDemografia cor={cor} demografia={demografia} desfecho={desfecho} />
      )}

      {vista === "sintomas" && (
        <VisaoSintomas cor={cor} sintomas={sintomas} tipos={tipos} tiposPct={tiposPct(tipos)} />
      )}

      {vista === "qualidade" && <VisaoQualidade qualidade={qualidade} ufSel={filtros.uf} />}
    </>
  );
}
