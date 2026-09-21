import { useMemo, useState } from "react";

// "jatai" precisa achar "Jataí": compara sem acento e sem maiúscula.
const normalizar = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_SUGESTOES = 8;

export default function BuscaMunicipio({ municipios, selecionados, onEscolher, desabilitado }) {
  const [texto, setTexto] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);

  const indice = useMemo(
    () => (municipios || []).map((m) => ({ ...m, nomeNorm: normalizar(m.municipio), ufNorm: m.uf.toLowerCase() })),
    [municipios],
  );

  const termo = normalizar(texto.trim());
  const sugestoes = useMemo(() => {
    if (!termo) return [];
    const escolhidos = new Set(selecionados.map((c) => c.cod_ibge));
    // Quem começa com o termo vem antes de quem só o contém.
    const comeca = [];
    const contem = [];
    for (const m of indice) {
      if (escolhidos.has(m.cod_ibge)) continue;
      if (m.nomeNorm.startsWith(termo)) comeca.push(m);
      else if (m.nomeNorm.includes(termo) || `${m.nomeNorm} ${m.ufNorm}`.includes(termo)) contem.push(m);
      if (comeca.length >= MAX_SUGESTOES) break;
    }
    return [...comeca, ...contem].slice(0, MAX_SUGESTOES);
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
    : desabilitado ? "Limite de 4 cidades atingido" : "Buscar qualquer cidade do Brasil…";

  return (
    <div className="busca-mun">
      <input
        className="busca" role="combobox" aria-label="Buscar cidade para comparar"
        aria-expanded={mostrarLista} aria-controls="busca-mun-lista" aria-autocomplete="list"
        aria-activedescendant={mostrarLista ? `busca-mun-${sugestoes[indiceAtivo].cod_ibge}` : undefined}
        placeholder={placeholder} value={texto} disabled={carregando || desabilitado}
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
      {aberto && termo && !carregando && sugestoes.length === 0 && (
        <div className="busca-mun-lista busca-mun-vazio">Nenhuma cidade encontrada</div>
      )}
    </div>
  );
}
