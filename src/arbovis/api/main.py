from __future__ import annotations

from datetime import date

from fastapi import Depends, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from arbovis.api import queries
from arbovis.api.security import verificar_chave

app = FastAPI(title="ArboVis API", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

Doenca = Query(None, description="dengue, zika ou chikungunya")
Uf = Query(None, description="Sigla da UF (ex.: GO)")
Inicio = Query(None, description="Data inicial (AAAA-MM-DD)")
Fim = Query(None, description="Data final (AAAA-MM-DD)")

dep = [Depends(verificar_chave)]


@app.get("/")
def raiz():
    return {"api": "ArboVis", "versao": "1.0.0", "docs": "/docs"}


@app.get("/indicadores", dependencies=dep)
def get_indicadores(doenca: str | None = Doenca, uf: str | None = Uf,
                    inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.indicadores(doenca, uf, inicio, fim)


@app.get("/casos/temporal", dependencies=dep)
def get_temporal(doenca: str | None = Doenca, uf: str | None = Uf,
                 inicio: date | None = Inicio, fim: date | None = Fim,
                 granularidade: str = Query("mes", pattern="^(ano|mes|semana)$")):
    return queries.serie_temporal(doenca, uf, inicio, fim, granularidade)


@app.get("/casos/mapa", dependencies=dep)
def get_mapa(doenca: str | None = Doenca, uf: str | None = Uf,
             inicio: date | None = Inicio, fim: date | None = Fim,
             limite: int = Query(5570, ge=1, le=5570),
             mesorregiao: str | None = Query(None)):
    return queries.mapa(doenca, uf, inicio, fim, mesorregiao, limite)


@app.get("/casos/por-mesorregiao", dependencies=dep)
def get_por_mesorregiao(uf: str | None = Uf, doenca: str | None = Doenca,
                        inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.por_mesorregiao(doenca, uf, inicio, fim)


@app.get("/resumo", dependencies=dep)
def get_resumo(doenca: str | None = Doenca, uf: str | None = Uf,
               inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.resumo(doenca, uf, inicio, fim)


@app.get("/demografia", dependencies=dep)
def get_demografia(doenca: str | None = Doenca, uf: str | None = Uf,
                   inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.demografia(doenca, uf, inicio, fim)


@app.get("/casos/por-uf", dependencies=dep)
def get_por_uf(doenca: str | None = Doenca,
               inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.por_uf(doenca, inicio, fim)


@app.get("/casos/sazonalidade", dependencies=dep)
def get_sazonalidade(doenca: str | None = Doenca, uf: str | None = Uf,
                     inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.sazonalidade(doenca, uf, inicio, fim)


@app.get("/casos/por-regiao", dependencies=dep)
def get_por_regiao(doenca: str | None = Doenca, uf: str | None = Uf,
                   inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.por_regiao(doenca, uf, inicio, fim)


@app.get("/casos/desfecho", dependencies=dep)
def get_desfecho(doenca: str | None = Doenca, uf: str | None = Uf,
                 inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.desfecho(doenca, uf, inicio, fim)


@app.get("/estados/ranking", dependencies=dep)
def get_ranking_uf(doenca: str | None = Doenca,
                   inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.ranking_uf(doenca, inicio, fim)


@app.get("/qualidade", dependencies=dep)
def get_qualidade(doenca: str | None = Doenca):
    return queries.qualidade(doenca)


@app.get("/sintomas", dependencies=dep)
def get_sintomas(doenca: str | None = Doenca, uf: str | None = Uf,
                 inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.principais_sintomas(doenca, uf, inicio, fim)


@app.get("/sintomas/categorias", dependencies=dep)
def get_categorias(doenca: str | None = Doenca, uf: str | None = Uf,
                   inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.categorias_sintomas(doenca, uf, inicio, fim)


@app.get("/estabelecimentos/tipos", dependencies=dep)
def get_tipos(doenca: str | None = Doenca, uf: str | None = Uf,
              inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.tipos_estabelecimento(doenca, uf, inicio, fim)


@app.get("/bairros/{cod_ibge}", dependencies=dep)
def get_bairros(cod_ibge: int, doenca: str | None = Doenca,
                inicio: date | None = Inicio, fim: date | None = Fim):
    return queries.bairros(cod_ibge, doenca, inicio, fim)


@app.get("/doencas", dependencies=dep)
def get_doencas():
    return queries.listar_doencas()


@app.get("/ufs", dependencies=dep)
def get_ufs():
    return queries.listar_ufs()
