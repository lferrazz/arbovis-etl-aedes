import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  SIGLA_COD,
  buscarMalhaBrMeso, buscarNomesMesoBr,
  buscarMalhaMesoUf, buscarNomesMesoUf,
  buscarMalhaMunicipios,
} from "../api.js";
import { n } from "./Graficos.jsx";

const SEM_TAXA = "#cbd5e1";

// Valor que colore o polígono na métrica escolhida; null = taxa não calculada.
const valorDe = (item, metrica) => (metrica === "incidencia" ? item?.incidencia ?? null : item?.casos || 0);

// Log: sem ele, o maior valor (SP em notificações) achata todo o resto.
const intensidade = (v, max) => (max > 1 && v ? Math.log(v + 1) / Math.log(max + 1) : 0);

function textoTooltip(nome, item) {
  return `<b>${nome}</b> · ${n(item?.casos || 0)} notificações`;
}

function corCalor(t) {
  const h = 50 * (1 - t);
  const s = 85 + 10 * t;
  const l = 65 - 20 * t;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

// Extensão continental do Brasil (aprox.) para o mapa nacional preencher o card.
const BOUNDS_BR = [[-33.9, -73.9], [5.3, -34.8]];

function AjustarVista({ bounds }) {
  const map = useMap();
  useEffect(() => {
    map.flyToBounds(bounds || BOUNDS_BR, { padding: [12, 12], duration: 0.6 });
  }, [bounds, map]);
  return null;
}

// O zoom mínimo fixo deixava afastar até o Brasil virar um ponto dentro do card.
// Aqui o piso passa a ser o zoom em que o Brasil ainda cabe inteiro, recalculado
// quando o card muda de tamanho, já que depende da largura disponível.
function ZoomMinimo() {
  const map = useMap();
  useEffect(() => {
    let quadro = 0;
    const ajustar = () => {
      const minimo = map.getBoundsZoom(BOUNDS_BR);
      map.setMinZoom(Math.min(minimo, map.getMaxZoom()));
      if (map.getZoom() < minimo) map.setZoom(minimo, { animate: false });
    };
    ajustar();
    // ResizeObserver e não map.on("resize"): o Leaflet só percebe resize da janela,
    // e aqui a largura do card muda sozinha (mapa fixo, card de comparação abrindo).
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(quadro);
      quadro = requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        ajustar();
      });
    });
    observador.observe(map.getContainer());
    return () => { cancelAnimationFrame(quadro); observador.disconnect(); };
  }, [map]);
  return null;
}

// Rolar o mouse sobre o mapa dava zoom em vez de rolar a página. Agora a roda só
// dá zoom com Ctrl pressionado (padrão de mapa embutido); sem Ctrl, a página rola.
function ZoomComCtrl({ aoRolarSemCtrl }) {
  const map = useMap();
  useEffect(() => {
    const elemento = map.getContainer();
    const aoRolar = (evento) => {
      if (!evento.ctrlKey) {
        aoRolarSemCtrl();
        return;
      }
      evento.preventDefault();
      const passo = evento.deltaY < 0 ? 1 : -1;
      map.setZoomAround(map.mouseEventToContainerPoint(evento), map.getZoom() + passo);
    };
    elemento.addEventListener("wheel", aoRolar, { passive: false });
    return () => elemento.removeEventListener("wheel", aoRolar);
  }, [map, aoRolarSemCtrl]);
  return null;
}

export default function Mapa({
  ufSel, onSelectUf, onSelectMunicipio, municipioSel,
  mesorregioes, mesoSel, onSelectMeso, cidadesMeso, metrica = "casos",
}) {
  // ── geo data (was useGeoMalha) ──
  const [geoBrMeso, setGeoBrMeso] = useState(null);
  const [infoMesoBr, setInfoMesoBr] = useState({});
  const [geoMesoUf, setGeoMesoUf] = useState(null);
  const [geoMun, setGeoMun] = useState(null);
  const [nomesMesoUf, setNomesMesoUf] = useState({});
  const [bounds, setBounds] = useState(null);
  const mesoBoundsRef = useRef({});

  const [aviso, setAviso] = useState(false);
  const avisoTimerRef = useRef(null);
  // Estável entre renders: o listener de wheel depende desta função.
  const avisarSobreCtrl = useCallback(() => {
    setAviso(true);
    clearTimeout(avisoTimerRef.current);
    avisoTimerRef.current = setTimeout(() => setAviso(false), 1800);
  }, []);
  useEffect(() => () => clearTimeout(avisoTimerRef.current), []);

  useEffect(() => {
    Promise.all([buscarMalhaBrMeso(), buscarNomesMesoBr()])
      .then(([geo, nomes]) => {
        setGeoBrMeso(geo);
        const info = {};
        for (const item of nomes) info[String(item.id)] = { nome: item.nome, uf: item.UF.sigla };
        setInfoMesoBr(info);
      }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ufSel) {
      setGeoMesoUf(null); setGeoMun(null); setNomesMesoUf({});
      setBounds(null); mesoBoundsRef.current = {};
      return;
    }
    let vivo = true;
    const cod = SIGLA_COD[ufSel];
    Promise.all([
      buscarMalhaMesoUf(cod),
      buscarNomesMesoUf(cod),
      buscarMalhaMunicipios(cod),
    ]).then(([geoM, nomes, geoMunicipios]) => {
      if (!vivo) return;
      setGeoMesoUf(geoM);
      setGeoMun(geoMunicipios);
      const nm = {};
      const bm = {};
      for (const item of nomes) nm[String(item.id)] = item.nome;
      if (geoM.features) {
        for (const f of geoM.features) {
          try { bm[String(f.properties.codarea)] = L.geoJSON(f).getBounds(); } catch {}
        }
      }
      setNomesMesoUf(nm);
      mesoBoundsRef.current = bm;
      try { setBounds(L.geoJSON(geoM).getBounds()); } catch { setBounds(null); }
    }).catch(() => {});
    return () => { vivo = false; };
  }, [ufSel]);

  useEffect(() => {
    if (!ufSel) return;
    if (mesoSel) {
      const cod = Object.entries(nomesMesoUf).find(([, nome]) => nome === mesoSel)?.[0];
      if (cod && mesoBoundsRef.current[cod]) setBounds(mesoBoundsRef.current[cod]);
    } else if (geoMesoUf) {
      try { setBounds(L.geoJSON(geoMesoUf).getBounds()); } catch {}
    }
  }, [mesoSel, ufSel, nomesMesoUf, geoMesoUf]);

  // ── derived data ──
  const casosMun = useMemo(() => {
    if (!mesoSel || !cidadesMeso) return {};
    return Object.fromEntries(cidadesMeso.map((m) => [String(m.cod_ibge), m]));
  }, [mesoSel, cidadesMeso]);

  // Chave UF + nome: só o nome deixaria duas mesorregiões homônimas de estados
  // diferentes sobrescreverem uma à outra no mapa nacional.
  const casosMesoMap = useMemo(
    () => Object.fromEntries((mesorregioes || []).map((m) => [`${m.uf}|${m.mesorregiao}`, m])),
    [mesorregioes],
  );
  const maxMeso = Math.max(1, ...(mesorregioes || []).map((m) => valorDe(m, metrica) || 0));
  const maxMun = Math.max(1, ...Object.values(casosMun).map((m) => valorDe(m, metrica) || 0));

  function estiloValor(item, max, vazio) {
    const v = valorDe(item, metrica);
    if (metrica === "incidencia" && item && v == null) return { fillColor: SEM_TAXA, fillOpacity: 0.6 };
    return { fillColor: corCalor(intensidade(v, max)), fillOpacity: v ? 0.75 : vazio };
  }

  function estiloMesoBr(f) {
    const cod = String(f.properties.codarea);
    const info = infoMesoBr[cod];
    const item = casosMesoMap[`${info?.uf}|${info?.nome}`];
    return { ...estiloValor(item, maxMeso, 0.05), weight: 0.5, color: "#ffffff" };
  }
  function aoMesoBr(f, layer) {
    const cod = String(f.properties.codarea);
    const info = infoMesoBr[cod];
    const nome = info?.nome || cod;
    const uf = info?.uf || "";
    layer.bindTooltip(textoTooltip(`${nome} · ${uf}`, casosMesoMap[`${uf}|${nome}`]), { sticky: true });
    layer.on({
      click: () => uf && onSelectUf(uf),
      mouseover: (e) => e.target.setStyle({ weight: 2, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMesoBr(f)),
    });
  }

  function estiloMesoUf(f) {
    const cod = String(f.properties.codarea);
    const nome = nomesMesoUf[cod] || "";
    const sel = mesoSel === nome;
    return {
      ...estiloValor(casosMesoMap[`${ufSel}|${nome}`], maxMeso, 0.05),
      weight: sel ? 2.5 : 1, color: sel ? "#131c2b" : "#ffffff",
    };
  }
  function aoMesoUf(f, layer) {
    const cod = String(f.properties.codarea);
    const nome = nomesMesoUf[cod] || cod;
    layer.bindTooltip(textoTooltip(nome, casosMesoMap[`${ufSel}|${nome}`]), { sticky: true });
    layer.on({
      click: () => onSelectMeso(nome),
      mouseover: (e) => e.target.setStyle({ weight: 2.5, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMesoUf(f)),
    });
  }

  function estiloMun(f) {
    const cod = String(f.properties.codarea);
    const sel = municipioSel && String(municipioSel.cod_ibge) === cod;
    return {
      ...estiloValor(casosMun[cod], maxMun, 0.04),
      weight: sel ? 2.5 : 0.5, color: sel ? "#131c2b" : "#ffffff",
    };
  }
  function aoMun(f, layer) {
    const cod = String(f.properties.codarea);
    const m = casosMun[cod];
    layer.bindTooltip(textoTooltip(m?.municipio || cod, m), { sticky: true });
    layer.on({
      click: () => m && onSelectMunicipio({ cod_ibge: Number(cod), municipio: m.municipio, uf: ufSel }),
      mouseover: (e) => e.target.setStyle({ weight: 2, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMun(f)),
    });
  }

  return (
    <div className="mapa-wrap">
      <MapContainer
        center={[-15, -54]} zoom={3.6}
        maxZoom={9} zoomSnap={0.1} zoomDelta={1}
        maxBounds={[[-36, -78], [8, -30]]} maxBoundsViscosity={1}
        style={{ position: "absolute", inset: 0, background: "transparent", borderRadius: 12 }}
        attributionControl={false} scrollWheelZoom={false} doubleClickZoom={false}
      >
      <ZoomMinimo />
      <ZoomComCtrl aoRolarSemCtrl={avisarSobreCtrl} />
      <AjustarVista bounds={bounds} />
      {!ufSel && geoBrMeso && (
        <GeoJSON key={`br-meso-${metrica}`} data={geoBrMeso} style={estiloMesoBr} onEachFeature={aoMesoBr} />
      )}
      {ufSel && !mesoSel && geoMesoUf && (
        <GeoJSON key={`meso-${ufSel}-${metrica}`} data={geoMesoUf} style={estiloMesoUf} onEachFeature={aoMesoUf} />
      )}
      {ufSel && mesoSel && geoMun && (
        <GeoJSON key={`mun-${ufSel}-${mesoSel}-${metrica}-${Object.keys(casosMun).length}-${municipioSel?.cod_ibge || ""}`}
                 data={geoMun} style={estiloMun} onEachFeature={aoMun} />
      )}
      </MapContainer>
      {aviso && <div className="mapa-aviso">Use Ctrl + rolagem para aproximar</div>}
    </div>
  );
}
