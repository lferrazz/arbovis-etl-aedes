import Mapa from "../Mapa.jsx";
import { n } from "../Graficos.jsx";

export default function VisaoMapas({
  filtros, onVoltarBrasil, onVoltarMesorregioes,
  mesorregioes, mesorregiaoSel, onSelectMeso,
  municipioSel, onSelectMunicipio, onSelectUf,
  cidadesMeso, listaMun, busca, setBusca,
  bairros,
}) {
  return (
    <>
      <div className="grade-mapa">
        <div className="card mapa">
          <div className="card-topo">
            <h3>{mesorregiaoSel ? `Municípios — ${mesorregiaoSel}` : filtros.uf ? `Mesorregiões de ${filtros.uf}` : "Mesorregiões do Brasil"}</h3>
            {filtros.uf && (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="voltar" onClick={onVoltarBrasil}>← Brasil</button>
                {mesorregiaoSel && <button className="voltar" onClick={onVoltarMesorregioes}>← Mesorregiões</button>}
              </div>
            )}
          </div>
          <Mapa ufSel={filtros.uf} onSelectUf={onSelectUf}
                onSelectMunicipio={onSelectMunicipio} municipioSel={municipioSel}
                mesorregioes={mesorregioes} mesoSel={mesorregiaoSel} onSelectMeso={onSelectMeso}
                cidadesMeso={cidadesMeso} />
        </div>
        <div className="card">
          {filtros.uf && mesorregioes.length > 0 && (
            <div className="meso-bloco">
              <h3>Mesorregiões de {filtros.uf}</h3>
              <p className="dica">Clique para ver as cidades da região.</p>
              <ul className="ranking">
                {mesorregioes.map((mr) => (
                  <li key={mr.mesorregiao} className={mesorregiaoSel === mr.mesorregiao ? "sel" : ""}
                      onClick={() => onSelectMeso(mr.mesorregiao)}>
                    <span className="nome">{mr.mesorregiao}</span>
                    <span className="n">{n(mr.casos)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className={filtros.uf && mesorregioes.length ? "comEspaco" : ""}>
            {mesorregiaoSel ? `Cidades — ${mesorregiaoSel}` : filtros.uf ? `Cidades de ${filtros.uf}` : "Municípios mais afetados"}
          </h3>
          {filtros.uf && <input className="busca" placeholder="Buscar cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />}
          <ul className="ranking rolavel">
            {listaMun.map((m) => (
              <li key={m.cod_ibge} className={municipioSel?.cod_ibge === m.cod_ibge ? "sel" : ""}
                  onClick={() => onSelectMunicipio(m)} title="Ver bairros">
                <span className="nome">{m.municipio}{filtros.uf ? "" : `/${m.uf}`}</span>
                <span className="n">{n(m.casos)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {municipioSel && (
        <div className="card">
          <h3>Unidades de saúde — {municipioSel.municipio}</h3>
          <p className="dica">Unidade (CNES) que notificou o caso, com o bairro onde fica.</p>
          <div className="grade2">
            {[bairros.slice(0, Math.ceil(bairros.length / 2)),
              bairros.slice(Math.ceil(bairros.length / 2))].map((coluna, col) => (
              <ul className="ranking" key={col}>
                {coluna.map((b, i) => (
                  <li key={i} className="sem-clique">
                    <span className="ubs-info">
                      <span className="ubs-nome" title={b.ubs}>{b.ubs}</span>
                      <span className="ubs-bairro">{b.bairro}</span>
                    </span>
                    <span className="n">{n(b.casos)}</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
