import { useMemo, useState } from "react";
import { normalizar } from "../texto.js";

const MAX_SUGESTOES = 8;

export default function BuscaMunicipio({ municipios, selecionados, onEscolher, desabilitado }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const falhou = Boolean(municipios?.erro);
  const indice = useMemo(
    () => (Array.isArray(municipios) ? municipios : [])
      .map((m) => ({ ...m, nomeNorm: normalizar(m.municipio), ufNorm: m.uf.toLowerCase() })),
    [municipios],
  );

  const termo = normalizar(texto.trim());
  const sugestoes = useMemo(() => {
    if (!termo) return [];
    const escolhidos = new Set(selecionados.map((c) => c.cod_ibge));
    // Nome exato > começa com o termo > só contém; empate vai para o nome mais curto.
    // Assim "jatai" traz Jataí antes de Jataizinho, e "rio verde go" traz Rio Verde
    // antes de Carmo do Rio Verde. Aceita o termo com a UF no fim ("rio verde go").
    const achados = [];
    for (const m of indice) {
      if (escolhidos.has(m.cod_ibge)) continue;
      const comUf = `${m.nomeNorm} ${m.ufNorm}`;
      let nota;
      if (m.nomeNorm === termo || comUf === termo) nota = 0;
      else if (m.nomeNorm.startsWith(termo) || comUf.startsWith(termo)) nota = 1;
      else if (comUf.includes(termo)) nota = 2;
      else continue;
      achados.push([nota, m]);
    }
    achados.sort((a, b) => a[0] - b[0] || a[1].nomeNorm.length - b[1].nomeNorm.length);
    return achados.slice(0, MAX_SUGESTOES).map(([, m]) => m);
  }, [indice, termo, selecionados]);

  const indiceAtivo = Math.min(ativo, sugestoes.length - 1);
  const mostrarLista = aberto && sugestoes.length > 0;

  function escolher(m) {
    onEscolher(m);
    setTexto("");
    setAtivo(0);
  }

  function aoTeclar(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo(Math.min(indiceAtivo + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo(Math.max(indiceAtivo - 1, 0));
    } else if (e.key === "Enter" && sugestoes[indiceAtivo]) {
      e.preventDefault();
      escolher(sugestoes[indiceAtivo]);
    } else if (e.key === "Escape") {
      setTexto("");
    }
  }

  const carregando = municipios == null;
  const placeholder = carregando
    ? "Carregando municípios…"
    : falhou ? "Não foi possível carregar a lista de cidades. Use o mapa ou a lista ao lado."
    : desabilitado ? "Limite de 4 cidades atingido" : "Buscar qualquer cidade do Brasil…";

  return (
    <div className="busca-mun">
      <input
        className="busca" role="combobox" aria-label="Buscar cidade para comparar"
        aria-expanded={mostrarLista} aria-controls="busca-mun-lista" aria-autocomplete="list"
        aria-activedescendant={mostrarLista ? `busca-mun-${sugestoes[indiceAtivo].cod_ibge}` : undefined}
        placeholder={placeholder} value={texto} disabled={carregando || falhou || desabilitado}
        onChange={(e) => { setTexto(e.target.value); setAtivo(0); setAberto(true); }}
        onFocus={() => setAberto(true)} onBlur={() => setAberto(false)} onKeyDown={aoTeclar}
      />
      {mostrarLista && (
        <ul id="busca-mun-lista" className="busca-mun-lista" role="listbox">
          {sugestoes.map((m, i) => (
            <li key={m.cod_ibge} id={`busca-mun-${m.cod_ibge}`} role="option" aria-selected={i === indiceAtivo}
                className={i === indiceAtivo ? "ativo" : ""}
                // mousedown + preventDefault: escolhe antes do blur fechar a lista
                onMouseDown={(e) => { e.preventDefault(); escolher(m); }}
                onMouseEnter={() => setAtivo(i)}>
              <span>{m.municipio}</span>
              <span className="uf">{m.uf}</span>
            </li>
          ))}
        </ul>
      )}
      {aberto && termo && !carregando && !falhou && sugestoes.length === 0 && (
        <div className="busca-mun-lista busca-mun-vazio">Nenhuma cidade encontrada</div>
      )}
    </div>
  );
}
