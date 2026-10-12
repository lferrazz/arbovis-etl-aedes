import { useEffect, useRef } from "react";
import Mapa from "../Mapa.jsx";
import {
  AJUDA_ATENDIDOS, AJUDA_INCIDENCIA, AJUDA_OBITOS, AlternadorMetrica, Kpi, n, nd, taxa, valorMetrica,
} from "../Graficos.jsx";
import BuscaMunicipio from "../BuscaMunicipio.jsx";
import ComparacaoMunicipios from "./ComparacaoMunicipios.jsx";

const DOENCAS = [
  { chave: "dengue", nome: "Dengue", cor: "#2563eb" },
  { chave: "zika", nome: "Zika", cor: "#a855f7" },
  { chave: "chikungunya", nome: "Chikungunya", cor: "#f59e0b" },
];

function PanoramaCidade({ panorama }) {
  if (!panorama || panorama.carregando) return <p className="dica">Carregando números da cidade…</p>;
  if (panorama.erro || !panorama.dados) return <p className="dica">Não foi possível carregar os números da cidade.</p>;

  const p = panorama.dados;
  const semPopulacao = p.populacao == null;
  return (
    <>
      <div className="kpis kpis-6 kpis-compactos">
        <Kpi rotulo="População" valor={semPopulacao ? "sem população" : p.populacao} icone="demografia" cor="#64748b"
             ajuda="População residente no Censo 2022 do IBGE. Municípios criados depois do Censo aparecem sem população." />
        <Kpi rotulo="Casos atendidos" valor={p.casos} icone="casos" cor="#0ea5e9"
             ajuda={`${AJUDA_ATENDIDOS} Soma as três arboviroses no período selecionado.`} />
        <Kpi rotulo="Incidência (média anual)" valor={semPopulacao ? "sem população" : taxa(p.incidencia)}
             icone="tendencias" cor="#10b981"
             detalhe={p.incidencia == null && !semPopulacao ? "menos de 100 mil hab." : "confirmados por 100 mil hab."}
             ajuda={AJUDA_INCIDENCIA} />
        <Kpi rotulo="% da população com caso provável"
             valor={p.pct_populacao == null ? "sem população" : `${nd(p.pct_populacao)}%`}
             icone="qualidade" cor="#8b5cf6"
             ajuda="Casos prováveis de moradores da cidade sobre a população, somando todo o período. Uma mesma pessoa pode ter adoecido mais de uma vez ao longo dos anos." />
        <Kpi rotulo="Óbitos" valor={p.obitos} icone="obitos" cor="#ef4444"
             detalhe="entre confirmados atendidos aqui" ajuda={AJUDA_OBITOS} />
        <Kpi rotulo="Letalidade" valor={p.letalidade == null ? "sem dado" : `${nd(p.letalidade, 3)}%`} icone="letalidade" cor="#f59e0b"
             ajuda="Óbitos entre os casos confirmados divididos pelos casos confirmados. Numerador e denominador saem do mesmo grupo." />
      </div>
      <div className="panorama-doencas">
        {DOENCAS.map((d) => (
          <span key={d.chave} className="doenca-chip">
            <i style={{ background: d.cor }} />
            {d.nome}: <b>{n(p.por_doenca[d.chave].casos)}</b>
            {p.por_doenca[d.chave].incidencia != null && <em>{nd(p.por_doenca[d.chave].incidencia)} conf. por 100 mil ao ano</em>}
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
  comparacao, metrica, setMetrica, onLimparComparacao,
}) {
  const porIncidencia = metrica === "incidencia";
  const refBairros = useRef(null);
  const ultimoRolado = useRef(null);
  const codSel = municipioSel?.cod_ibge;

  useEffect(() => {
    if (!codSel || modoComparar || !refBairros.current) return;
    if (ultimoRolado.current === codSel) return;
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
              <AlternadorMetrica metrica={metrica} setMetrica={setMetrica} />
              {filtros.uf && <button className="voltar" onClick={onVoltarBrasil}>← Brasil</button>}
              {mesorregiaoSel && <button className="voltar" onClick={onVoltarMesorregioes}>← Mesorregiões</button>}
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
                cidadesMeso={cidadesMeso} metrica={metrica} />
        </div>
        <div className="card">
          {filtros.uf && mesorregioes.length > 0 && (
            <div className="meso-bloco">
              <h3>Mesorregiões de {filtros.uf}</h3>
              <p className="dica">
                Clique para ver as cidades da região.
                {porIncidencia
                  ? " Casos confirmados de moradores por 100 mil habitantes ao ano."
                  : " Casos prováveis atendidos na região."}
              </p>
              <ul className="ranking">
                {mesorregioes.map((mr) => (
                  <li key={mr.mesorregiao} className={mesorregiaoSel === mr.mesorregiao ? "sel" : ""}
                      onClick={() => onSelectMeso(mr.mesorregiao)}>
                    <span className="nome">{mr.mesorregiao}</span>
                    <span className="n">{valorMetrica(mr, metrica)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <h3 className={`lista-titulo ${filtros.uf && mesorregioes.length ? "comEspaco" : ""}`}>
            {mesorregiaoSel ? `Cidades de ${mesorregiaoSel}` : filtros.uf ? `Cidades de ${filtros.uf}`
              : porIncidencia ? "Maior incidência" : "Onde os casos foram atendidos"}
          </h3>
          <p className="dica">
            {porIncidencia
              ? "Confirmados por 100 mil habitantes ao ano, pela cidade onde a pessoa mora. Só municípios com 100 mil habitantes ou mais."
              : "Casos prováveis pela cidade onde foram notificados. Clique numa cidade para ver as unidades de saúde."}
          </p>
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
                  <span className="n">{valorMetrica(m, metrica)}</span>
                </li>
              );
            })}
          </ul>
          {listaMun.length === 0 && porIncidencia && (
            <p className="dica">Nenhum município deste recorte tem 100 mil habitantes ou mais.</p>
          )}
        </div>
      </div>
      <ComparacaoMunicipios estado={comparacao} metrica={metrica}
                            setMetrica={setMetrica} onLimpar={onLimparComparacao} />

      {municipioSel && !modoComparar && (
        <div className="card card-bairros" ref={refBairros}>
          <h3>{municipioSel.municipio}{municipioSel.uf ? `/${municipioSel.uf}` : ""}</h3>
          <PanoramaCidade panorama={panorama} />

          <h3 className="lista-titulo">Unidades de saúde</h3>
          <p className="dica">
            Unidades de saúde (CNES) que mais notificaram casos prováveis na cidade, com o bairro onde cada
            uma fica. Mostra para onde os doentes procuraram atendimento.
          </p>
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
