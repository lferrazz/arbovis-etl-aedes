from __future__ import annotations

import time as _time
from functools import lru_cache, wraps

from google.cloud import bigquery

from arbovis.config import get_bq_client

_CACHE_TTL = 1800

FATO = "`gold.fato_notificacao`"
DIM_DOENCA = "`gold.dim_doenca`"
DIM_MUNICIPIO = "`gold.dim_municipio`"
DIM_ESTAB = "`gold.dim_estabelecimento`"

BASE_JOIN = f"""
FROM {FATO} f
JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
LEFT JOIN {DIM_MUNICIPIO} m ON f.cod_ibge = m.cod_ibge
"""

_GRAOS = {
    "ano": "FORMAT_DATE('%Y', f.dt_notificacao)",
    "mes": "FORMAT_DATE('%Y-%m', f.dt_notificacao)",
    "semana": "FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f.dt_notificacao, WEEK(MONDAY)))",
}

_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

_SINTOMAS = {
    "Febre": "febre",
    "Mialgia": "mialgia",
    "Cefaleia": "cefaleia",
    "Exantema": "exantema",
    "Artralgia": "artralgia",
    "Dor retro-orbital": "dor_retro",
}


def _cacheado(fn):
    cache: dict = {}

    @wraps(fn)
    def wrapper(*args, **kwargs):
        chave = (args, tuple(sorted(kwargs.items())))
        agora = _time.monotonic()
        hit = cache.get(chave)
        if hit and agora - hit[0] < _CACHE_TTL:
            return hit[1]
        resultado = fn(*args, **kwargs)
        cache[chave] = (agora, resultado)
        return resultado

    return wrapper


@lru_cache(maxsize=1)
def _client() -> bigquery.Client:
    return get_bq_client()


def _run(sql: str, params: list[bigquery.ScalarQueryParameter]) -> list[dict]:
    cfg = bigquery.QueryJobConfig(query_parameters=params)
    return [dict(r) for r in _client().query(sql, job_config=cfg).result()]


def _filtros(*, doenca=None, uf=None, inicio=None, fim=None, mesorregiao=None):
    clausulas = ["f.dt_notificacao BETWEEN DATE '2000-01-01' AND DATE '2026-12-31'"]
    params: list[bigquery.ScalarQueryParameter] = []
    if mesorregiao:
        clausulas.append("m.mesorregiao = @meso")
        params.append(bigquery.ScalarQueryParameter("meso", "STRING", mesorregiao))
    if doenca:
        clausulas.append("d.nome = @doenca")
        params.append(bigquery.ScalarQueryParameter("doenca", "STRING", doenca.lower()))
    if uf:
        clausulas.append("m.uf = @uf")
        params.append(bigquery.ScalarQueryParameter("uf", "STRING", uf.upper()))
    if inicio:
        clausulas.append("f.dt_notificacao >= @inicio")
        params.append(bigquery.ScalarQueryParameter("inicio", "DATE", inicio))
    if fim:
        clausulas.append("f.dt_notificacao <= @fim")
        params.append(bigquery.ScalarQueryParameter("fim", "DATE", fim))
    return "WHERE " + " AND ".join(clausulas), params


# Notificações 

@_cacheado
def indicadores(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT d.nome AS doenca, COUNT(*) AS casos, SUM(f.obito) AS mortes {BASE_JOIN} {where} GROUP BY d.nome ORDER BY casos DESC",
        params,
    )


@_cacheado
def serie_temporal(doenca=None, uf=None, inicio=None, fim=None, granularidade="mes"):
    expr = _GRAOS.get(granularidade, _GRAOS["mes"])
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT {expr} AS periodo, COUNT(*) AS casos, SUM(f.obito) AS mortes {BASE_JOIN} {where} GROUP BY periodo ORDER BY periodo",
        params,
    )


@_cacheado
def mapa(doenca=None, uf=None, inicio=None, fim=None, mesorregiao=None, limite=5570):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim, mesorregiao=mesorregiao)
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"""
        SELECT m.cod_ibge, m.nome_municipio AS municipio, m.uf,
               COUNT(*) AS casos, SUM(f.obito) AS mortes
        {BASE_JOIN} {where}
        AND m.cod_ibge IS NOT NULL
        GROUP BY m.cod_ibge, m.nome_municipio, m.uf
        ORDER BY casos DESC LIMIT @limite
        """,
        params,
    )


@_cacheado
def resumo(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    linha = _run(
        f"""
        SELECT COUNT(*) AS casos,
               SUM(f.obito) AS obitos,
               COUNTIF(f.evolucao = 1) AS curas,
               COUNTIF(f.categoria_sintomas = 'Assintomático') AS assintomaticos,
               COUNTIF(f.categoria_sintomas = 'Sem informação') AS sem_informacao,
               ROUND(AVG(f.idade)) AS idade_media,
               COUNTIF(f.classificacao IN (10, 11, 12)) AS confirmados
        {BASE_JOIN} {where}
        """,
        params,
    )[0]
    casos = linha.get("casos") or 0
    obitos = linha.get("obitos") or 0
    confirmados = linha.get("confirmados") or 0
    linha["letalidade"] = round(obitos / casos * 100, 3) if casos else 0.0
    linha["pct_confirmados"] = round(confirmados / casos * 100, 1) if casos else 0.0
    return linha


@_cacheado
def demografia(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    por_sexo = _run(
        f"SELECT COALESCE(f.sexo, 'I') AS sexo, COUNT(*) AS casos {BASE_JOIN} {where} GROUP BY sexo ORDER BY casos DESC",
        params,
    )
    por_faixa = _run(
        f"""
        SELECT CASE
            WHEN f.idade IS NULL THEN 'Sem info'
            WHEN f.idade < 10 THEN '0-9'
            WHEN f.idade < 20 THEN '10-19'
            WHEN f.idade < 30 THEN '20-29'
            WHEN f.idade < 40 THEN '30-39'
            WHEN f.idade < 50 THEN '40-49'
            WHEN f.idade < 60 THEN '50-59'
            ELSE '60+' END AS faixa,
            COUNT(*) AS casos
        {BASE_JOIN} {where}
        GROUP BY faixa ORDER BY faixa
        """,
        params,
    )
    return {"por_sexo": por_sexo, "por_faixa": por_faixa}


@_cacheado
def sazonalidade(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    rows = _run(
        f"SELECT EXTRACT(MONTH FROM f.dt_notificacao) AS m, COUNT(*) AS casos {BASE_JOIN} {where} GROUP BY m ORDER BY m",
        params,
    )
    return [{"mes": _MESES[int(r["m"]) - 1], "casos": r["casos"]} for r in rows]


@_cacheado
def por_regiao(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT m.regiao AS regiao, COUNT(*) AS casos {BASE_JOIN} {where} AND m.regiao IS NOT NULL GROUP BY regiao ORDER BY casos DESC",
        params,
    )


@_cacheado
def desfecho(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"""
        SELECT CASE f.evolucao
                 WHEN 1 THEN 'Cura'
                 WHEN 2 THEN 'Óbito pelo agravo'
                 WHEN 3 THEN 'Óbito por outras causas'
                 WHEN 4 THEN 'Em investigação'
                 ELSE 'Ignorado / sem informação'
               END AS desfecho,
               COUNT(*) AS casos
        {BASE_JOIN} {where}
        GROUP BY desfecho ORDER BY casos DESC
        """,
        params,
    )


@_cacheado
def por_mesorregiao(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"""
        SELECT m.mesorregiao, m.uf, COUNT(*) AS casos, SUM(f.obito) AS mortes
        {BASE_JOIN} {where}
        AND m.mesorregiao IS NOT NULL
        GROUP BY m.mesorregiao, m.uf ORDER BY casos DESC
        """,
        params,
    )


@_cacheado
def por_uf(doenca=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, inicio=inicio, fim=fim)
    return _run(
        f"SELECT m.uf, COUNT(*) AS casos, SUM(f.obito) AS mortes {BASE_JOIN} {where} AND m.uf IS NOT NULL GROUP BY m.uf",
        params,
    )


@_cacheado
def ranking_uf(doenca=None, inicio=None, fim=None, limite=10):
    where, params = _filtros(doenca=doenca, inicio=inicio, fim=fim)
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"SELECT m.uf, COUNT(*) AS casos, SUM(f.obito) AS mortes {BASE_JOIN} {where} AND m.uf IS NOT NULL GROUP BY m.uf ORDER BY casos DESC LIMIT @limite",
        params,
    )


# ── Qualidade dos dados: indivíduo (data + cidade) vs "sem informação" ──
# Um registro é um indivíduo identificado quando tem data E município Faltando qualquer um, vira "sem informação",
# mas continua contado — não descarta nenhum registro.
# Só filtra por doença: filtrar por UF/período excluiria os próprios registros
# sem cidade/data que queremos enxergar aqui.

@_cacheado
def qualidade(doenca=None):
    params = []
    where = ""
    if doenca:
        where = "WHERE d.nome = @doenca"
        params.append(bigquery.ScalarQueryParameter("doenca", "STRING", doenca.lower()))
    linha = _run(
        f"""
        SELECT
            COUNT(*) AS total,
            COUNTIF(f.dt_notificacao IS NOT NULL AND f.cod_ibge IS NOT NULL) AS identificados,
            COUNTIF(f.dt_notificacao IS NULL OR f.cod_ibge IS NULL) AS sem_informacao,
            COUNTIF(f.dt_notificacao IS NULL) AS sem_data,
            COUNTIF(f.cod_ibge IS NULL) AS sem_municipio,
            COUNTIF(f.cod_ibge_origem = 'cnes') AS municipio_via_cnes,
            COUNTIF(f.categoria_sintomas = 'Sem informação') AS sem_sintomas
        FROM {FATO} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        {where}
        """,
        params,
    )[0]
    total = linha.get("total") or 0

    def pct(x):
        return round((x or 0) / total * 100, 1) if total else 0.0

    ident = linha.get("identificados") or 0
    sem = linha.get("sem_informacao") or 0
    return {
        "total": total,
        "identificados": ident,
        "pct_identificados": pct(ident),
        "sem_informacao": sem,
        "pct_sem_informacao": pct(sem),
        "sem_data": linha.get("sem_data") or 0,
        "sem_municipio": linha.get("sem_municipio") or 0,
        "municipio_via_cnes": linha.get("municipio_via_cnes") or 0,
        "sem_sintomas": linha.get("sem_sintomas") or 0,
        "pct_sem_sintomas": pct(linha.get("sem_sintomas") or 0),
    }


# Sintomas 

@_cacheado
def principais_sintomas(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    selects = ", ".join(f"COUNTIF(f.{col} = 1) AS `{rotulo}`" for rotulo, col in _SINTOMAS.items())
    linha = _run(f"SELECT {selects} {BASE_JOIN} {where}", params)
    if not linha:
        return []
    return [{"sintoma": k, "qtd": v} for k, v in linha[0].items()]


@_cacheado
def categorias_sintomas(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT f.categoria_sintomas AS categoria, COUNT(*) AS qtd {BASE_JOIN} {where} GROUP BY categoria ORDER BY qtd DESC",
        params,
    )


# Estabelecimentos

@_cacheado
def tipos_estabelecimento(doenca=None, uf=None, inicio=None, fim=None, limite=10):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"""
        SELECT COALESCE(e.tipo_estabelecimento, 'Não informado') AS tipo, COUNT(*) AS casos
        FROM {FATO} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        LEFT JOIN {DIM_MUNICIPIO} m ON f.cod_ibge = m.cod_ibge
        LEFT JOIN {DIM_ESTAB} e ON f.co_cnes = e.co_cnes
        {where}
        GROUP BY tipo ORDER BY casos DESC LIMIT @limite
        """,
        params,
    )


@_cacheado
def bairros(cod_ibge, doenca=None, inicio=None, fim=None, limite=15):
    where, params = _filtros(doenca=doenca, inicio=inicio, fim=fim)
    params.append(bigquery.ScalarQueryParameter("cod_ibge", "INT64", cod_ibge))
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"""
        SELECT COALESCE(e.nome, 'Não informado') AS ubs,
               COALESCE(e.bairro, 'Não informado') AS bairro,
               COUNT(*) AS casos, SUM(f.obito) AS mortes
        FROM {FATO} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        JOIN {DIM_ESTAB} e ON f.co_cnes = e.co_cnes
        {where} AND e.cod_ibge_6 = DIV(@cod_ibge, 10)
        GROUP BY ubs, bairro ORDER BY casos DESC LIMIT @limite
        """,
        params,
    )


# ── Referência ────────────────────────────────────────────────

@_cacheado
def listar_doencas():
    return _run(f"SELECT nome, cid10 FROM {DIM_DOENCA} ORDER BY nome", [])


@_cacheado
def listar_ufs():
    linhas = _run(f"SELECT DISTINCT uf FROM {DIM_MUNICIPIO} WHERE uf IS NOT NULL ORDER BY uf", [])
    return [linha["uf"] for linha in linhas]
