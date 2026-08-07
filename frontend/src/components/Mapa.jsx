import { useEffect, useMemo, useRef, useState } from "react";
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

export default function Mapa({
  ufSel, onSelectUf, onSelectMunicipio, municipioSel,
  mesorregioes, mesoSel, onSelectMeso, cidadesMeso,
}) {
  // ── geo data (was useGeoMalha) ──
  const [geoBrMeso, setGeoBrMeso] = useState(null);
  const [infoMesoBr, setInfoMesoBr] = useState({});
  const [geoMesoUf, setGeoMesoUf] = useState(null);
  const [geoMun, setGeoMun] = useState(null);
  const [nomesMesoUf, setNomesMesoUf] = useState({});
  const [bounds, setBounds] = useState(null);
  const mesoBoundsRef = useRef({});

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

  const casosMesoMap = useMemo(() => Object.fromEntries((mesorregioes || []).map((m) => [m.mesorregiao, m])), [mesorregioes]);
  const maxMeso = Math.max(1, ...(mesorregioes || []).map((m) => m.casos));
  const maxMun = Math.max(1, ...Object.values(casosMun).map((m) => m.casos || 0));

  function estiloMesoBr(f) {
    const cod = String(f.properties.codarea);
    const info = infoMesoBr[cod];
    const nome = info?.nome || "";
    const casos = casosMesoMap[nome]?.casos || 0;
    const t = maxMeso > 1 ? Math.log(casos + 1) / Math.log(maxMeso + 1) : 0;
    return { fillColor: corCalor(t), fillOpacity: casos ? 0.75 : 0.05, weight: 0.5, color: "#ffffff" };
  }
  function aoMesoBr(f, layer) {
    const cod = String(f.properties.codarea);
    const info = infoMesoBr[cod];
    const nome = info?.nome || cod;
    const uf = info?.uf || "";
    const casos = casosMesoMap[nome]?.casos || 0;
    layer.bindTooltip(`<b>${nome}</b> · ${uf} · ${n(casos)} casos`, { sticky: true });
    layer.on({
      click: () => uf && onSelectUf(uf),
      mouseover: (e) => e.target.setStyle({ weight: 2, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMesoBr(f)),
    });
  }

  function estiloMesoUf(f) {
    const cod = String(f.properties.codarea);
    const nome = nomesMesoUf[cod] || "";
    const casos = casosMesoMap[nome]?.casos || 0;
    const t = maxMeso > 1 ? Math.log(casos + 1) / Math.log(maxMeso + 1) : 0;
    const sel = mesoSel === nome;
    return {
      fillColor: corCalor(t), fillOpacity: casos ? 0.75 : 0.05,
      weight: sel ? 2.5 : 1, color: sel ? "#131c2b" : "#ffffff",
    };
  }
  function aoMesoUf(f, layer) {
    const cod = String(f.properties.codarea);
    const nome = nomesMesoUf[cod] || cod;
    const casos = casosMesoMap[nome]?.casos || 0;
    layer.bindTooltip(`<b>${nome}</b> · ${n(casos)} casos`, { sticky: true });
    layer.on({
      click: () => onSelectMeso(nome),
      mouseover: (e) => e.target.setStyle({ weight: 2.5, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMesoUf(f)),
    });
  }

  function estiloMun(f) {
    const cod = String(f.properties.codarea);
    const casos = casosMun[cod]?.casos || 0;
    const t = maxMun > 1 ? Math.log(casos + 1) / Math.log(maxMun + 1) : 0;
    const sel = municipioSel && String(municipioSel.cod_ibge) === cod;
    return {
      fillColor: corCalor(t), fillOpacity: casos ? 0.75 : 0.04,
      weight: sel ? 2.5 : 0.5, color: sel ? "#131c2b" : "#ffffff",
    };
  }
  function aoMun(f, layer) {
    const cod = String(f.properties.codarea);
    const m = casosMun[cod];
    layer.bindTooltip(`<b>${m?.municipio || cod}</b> · ${n(m?.casos || 0)} casos`, { sticky: true });
    layer.on({
      click: () => m && onSelectMunicipio({ cod_ibge: Number(cod), municipio: m.municipio, uf: ufSel }),
      mouseover: (e) => e.target.setStyle({ weight: 2, color: "#131c2b" }),
      mouseout: (e) => e.target.setStyle(estiloMun(f)),
    });
  }

  return (
    <MapContainer
      center={[-15, -54]} zoom={3.6}
      minZoom={3.2} maxZoom={9}
      maxBounds={[[-36, -78], [8, -30]]} maxBoundsViscosity={1}
      style={{ flex: 1, minHeight: 440, background: "transparent", borderRadius: 12 }}
      attributionControl={false} scrollWheelZoom
    >
      <AjustarVista bounds={bounds} />
      {!ufSel && geoBrMeso && (
        <GeoJSON key="br-meso" data={geoBrMeso} style={estiloMesoBr} onEachFeature={aoMesoBr} />
      )}
      {ufSel && !mesoSel && geoMesoUf && (
        <GeoJSON key={`meso-${ufSel}`} data={geoMesoUf} style={estiloMesoUf} onEachFeature={aoMesoUf} />
      )}
      {ufSel && mesoSel && geoMun && (
        <GeoJSON key={`mun-${ufSel}-${mesoSel}-${Object.keys(casosMun).length}-${municipioSel?.cod_ibge || ""}`}
                 data={geoMun} style={estiloMun} onEachFeature={aoMun} />
      )}
    </MapContainer>
  );
}
