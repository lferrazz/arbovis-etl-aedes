import { useEffect, useRef } from "react";
import Mapa from "../Mapa.jsx";
import { Kpi, n, nd } from "../Graficos.jsx";
import BuscaMunicipio from "../BuscaMunicipio.jsx";
import ComparacaoMunicipios from "./ComparacaoMunicipios.jsx";

const DOENCAS = [
  { chave: "dengue", nome: "Dengue", cor: "#ef4444" },
  { chave: "zika", nome: "Zika", cor: "#a855f7" },
  { chave: "chikungunya", nome: "Chikungunya", cor: "#f59e0b" },
];

// Mesmos números da comparação, para uma cidade só: o clique deixa de mostrar
// apenas a contagem de casos e passa a mostrar o peso sobre a população.
function PanoramaCidade({ panorama }) {
  if (!panorama || panorama.carregando) return <p className="dica">Carregando números da cidade…</p>;
  if (panorama.erro || !panorama.dados) return <p className="dica">Não foi possível carregar os números da cidade.</p>;

  const p = panorama.dados;
  const semPopulacao = p.populacao == null;
  return (
    <>
      <div className="kpis kpis-6 kpis-compactos">
        <Kpi rotulo="População" valor={semPopulacao ? "sem dado" : p.populacao} icone="demografia" cor="#64748b"
             ajuda="População residente no Censo 2022 do IBGE." />
        <Kpi rotulo="Casos" valor={p.casos} icone="casos" cor="#0ea5e9"
             ajuda="Notificações das três arboviroses no período selecionado." />
        <Kpi rotulo="Casos por 100 mil hab." valor={nd(p.casos_100mil)} icone="tendencias" cor="#10b981"
             ajuda="Casos dividido pela população, vezes 100 mil. É o que permite comparar cidades de tamanhos diferentes." />
        <Kpi rotulo="% da população" valor={p.pct_populacao == null ? "sem dado" : `${nd(p.pct_populacao)}%`}
             icone="qualidade" cor="#8b5cf6"
             ajuda="Quanto da população foi notificada no período. Uma mesma pessoa pode ter sido notificada mais de uma vez ao longo dos anos." />
        <Kpi rotulo="Óbitos" valor={p.obitos} icone="obitos" cor="#ef4444"
             ajuda="Mortes causadas pela própria arbovirose." />
        <Kpi rotulo="Letalidade" valor={`${nd(p.letalidade, 3)}%`} icone="letalidade" cor="#f59e0b"
             ajuda="Percentual de óbitos entre os casos notificados." />
      </div>
      <div className="panorama-doencas">
        {DOENCAS.map((d) => (
          <span key={d.chave} className="doenca-chip">
            <i style={{ background: d.cor }} />
            {d.nome}: <b>{n(p.por_doenca[d.chave].casos)}</b>
            {!semPopulacao && <em>{nd(p.por_doenca[d.chave].casos_100mil)} por 100 mil</em>}
          </span>
        ))}
      </div>
    </>
  );
}

export default function VisaoMapas({
  filtros, onVoltarBrasil, onVoltarMesorregioes,
  mesorregioes, mesorregiaoSel, onSelectMeso,
  municipioSel, onSelectMunicipio, onSelectUf,
  cidadesMeso, listaMun, busca, setBusca,
  bairros, panorama,
  modoComparar, setModoComparar, comparar, onAlternarComparar, todosMunicipios,
  comparacao, metricaComp, setMetricaComp, onLimparComparacao,
}) {
  // O card de unidades nasce abaixo da dobra; sem isto o usuário clica na cidade
  // e não encontra o resultado.
  const refBairros = useRef(null);
  const ultimoRolado = useRef(null);
  const codSel = municipioSel?.cod_ibge;

  useEffect(() => {
    // No modo comparar o clique não abre as unidades, então não há para onde rolar.
    if (!codSel || modoComparar || !refBairros.current) return;
    if (ultimoRolado.current === codSel) return; // não re-rola quando os bairros chegam
    ultimoRolado.current = codSel;
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refBairros.current.scrollIntoView({ behavior: reduzir ? "auto" : "smooth", block: "start" });
  }, [codSel, modoComparar]);

  return (
    <>
      <div className="grade-mapa">
        <div className="card mapa">
          <div className="card-topo">
            <h3>{mesorregiaoSel ? `Municípios de ${mesorregiaoSel}` : filtros.uf ? `Mesorregiões de ${filtros.uf}` : "Mesorregiões do Brasil"}</h3>
            <div className="mapa-acoes">
              {filtros.uf && <button className="voltar" onClick={onVoltarBrasil}>← Brasil</button>}
              {mesorregiaoSel && <button className="voltar" onClick={onVoltarMesorregioes}>← Mesorregiões</button>}
              {/* Sair também limpa: antes a tabela continuava na tela depois de sair. */}
              <button className={`voltar ${modoComparar ? "ativo" : ""}`} aria-pressed={modoComparar}
                      onClick={() => (modoComparar ? onLimparComparacao() : setModoComparar(true))}>
                {modoComparar ? "Sair da comparação" : "Comparar cidades"}
              </button>
            </div>
          </div>
          {modoComparar && (
            <div className="comparar-barra">
              <BuscaMunicipio municipios={todosMunicipios} selecionados={comparar}
                              onEscolher={onAlternarComparar} desabilitado={comparar.length >= 4} />
              <div className="chips">
                {comparar.map((c) => (
                  <button key={c.cod_ibge} className="chip" onClick={() => onAlternarComparar(c)}
                          title="Remover da comparação">
                    {c.municipio}/{c.uf} <span aria-hidden="true">×</span>
                  </button>
                ))}
                {comparar.length < 2 && (
                  <span className="dica">
                    {comparar.length === 0
                      ? "Escolha de 2 a 4 cidades: busque aqui, clique no mapa ou na lista ao lado."
                      : "Escolha mais uma cidade para comparar."}
                  </span>
                )}
              </div>
            </div>
          )}
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
          <h3 className={`lista-titulo ${filtros.uf && mesorregioes.length ? "comEspaco" : ""}`}>
            {mesorregiaoSel ? `Cidades de ${mesorregiaoSel}` : filtros.uf ? `Cidades de ${filtros.uf}` : "Municípios mais afetados"}
          </h3>
          {filtros.uf && <input className="busca" placeholder="Buscar cidade…" value={busca} onChange={(e) => setBusca(e.target.value)} />}
          <ul className="ranking rolavel">
            {listaMun.map((m) => {
              const marcado = comparar.some((c) => c.cod_ibge === m.cod_ibge);
              const selecionado = !modoComparar && municipioSel?.cod_ibge === m.cod_ibge;
              return (
                <li key={m.cod_ibge}
                    className={`${selecionado ? "sel" : ""} ${marcado ? "marcado" : ""}`}
                    onClick={() => onSelectMunicipio(m)}
                    title={modoComparar ? "Adicionar à comparação" : "Ver bairros"}>
                  <span className="nome">{m.municipio}{filtros.uf ? "" : `/${m.uf}`}</span>
                  <span className="n">{n(m.casos)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <ComparacaoMunicipios estado={comparacao} metrica={metricaComp}
                            setMetrica={setMetricaComp} onLimpar={onLimparComparacao} />

      {municipioSel && !modoComparar && (
        <div className="card card-bairros" ref={refBairros}>
          <h3>{municipioSel.municipio}{municipioSel.uf ? `/${municipioSel.uf}` : ""}</h3>
          <PanoramaCidade panorama={panorama} />

          <h3 className="lista-titulo">Unidades de saúde</h3>
          <p className="dica">Unidade (CNES) que notificou o caso, com o bairro onde fica.</p>
          {bairros.length === 0 && <p className="dica">Carregando unidades…</p>}
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
