const BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const KEY = import.meta.env.VITE_API_KEY || "";

const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export async function api(path, params = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== "") url.searchParams.set(k, v);
  });
  const chave = url.toString();
  const agora = Date.now();
  const hit = _cache.get(chave);
  if (hit && agora - hit.ts < CACHE_TTL) return hit.data;

  const res = await fetch(chave, { headers: { "X-API-Key": KEY } });
  if (!res.ok) throw new Error(`Erro ${res.status} em ${path}`);
  const data = await res.json();
  _cache.set(chave, { data, ts: agora });
  return data;
}


const MALHA_BR_MESO =
  "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR" +
  "?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=mesorregiao";
const MESO_NOMES_BR =
  "https://servicodados.ibge.gov.br/api/v1/localidades/mesorregioes";

const malhaEstadoUrl = (cod) =>
  `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${cod}` +
  "?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=municipio";
const malhaMesoUfUrl = (cod) =>
  `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${cod}` +
  "?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=mesorregiao";
const mesoNomesUfUrl = (cod) =>
  `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${cod}/mesorregioes`;

async function buscarJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ${res.status} em ${url}`);
  return res.json();
}

async function localOuIbge(caminho, urlIbge) {
  try {
    return await buscarJson(`${import.meta.env.BASE_URL}malhas/${caminho}`);
  } catch {
    return buscarJson(urlIbge);
  }
}

export const buscarMalhaBrMeso = () => localOuIbge("br-meso.json", MALHA_BR_MESO);
export const buscarNomesMesoBr = () => localOuIbge("mesorregioes.json", MESO_NOMES_BR);
export const buscarMalhaMesoUf = (cod) => localOuIbge(`uf/${cod}-meso.json`, malhaMesoUfUrl(cod));
export const buscarNomesMesoUf = (cod) =>
  localOuIbge("mesorregioes.json", mesoNomesUfUrl(cod))
    .then((lista) => lista.filter((m) => String(m.UF?.id) === String(cod)));
export const buscarMalhaMunicipios = (cod) => localOuIbge(`uf/${cod}-mun.json`, malhaEstadoUrl(cod));


export const COD_UF = {
  "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
  "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
  "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
  "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
};

export const SIGLA_COD = Object.fromEntries(Object.entries(COD_UF).map(([c, s]) => [s, c]));
