from __future__ import annotations

import time as _time
from datetime import date
from functools import lru_cache, wraps

from google.cloud import bigquery

from arbovis.config import FATO_TABELA, get_bq_client
from arbovis.definicoes import INICIO_DADOS, POP_MIN_INCIDENCIA, sql_notificacoes

_CACHE_TTL = 1800

FATO = f"`gold.{FATO_TABELA}`"
DIM_DOENCA = "`gold.dim_doenca`"
DIM_MUNICIPIO = "`gold.dim_municipio`"
DIM_ESTAB = "`gold.dim_estabelecimento`"
CONTROLE_CARGA = "`bronze.controle_carga`"

NOTIF = f"({sql_notificacoes(FATO)})"

BASE_JOIN = f"""
FROM {NOTIF} f
JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
LEFT JOIN {DIM_MUNICIPIO} m ON f.cod_ibge = m.cod_ibge
"""

BASE_RESIDENCIA = f"""
FROM {NOTIF} f
JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
JOIN {DIM_MUNICIPIO} r ON f.cod_ibge_resi = r.cod_ibge
"""

_GRAOS = {
    "dia": "FORMAT_DATE('%Y-%m-%d', f.dt_notificacao)",
    "ano": "FORMAT_DATE('%Y', f.dt_notificacao)",
    "mes": "FORMAT_DATE('%Y-%m', f.dt_notificacao)",
    "semana": "FORMAT_DATE('%Y-%m-%d', DATE_TRUNC(f.dt_notificacao, WEEK(MONDAY)))",
}

_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

_EXPR_EVOLUCAO_IGNORADA = "(f.evolucao IS NULL OR f.evolucao NOT IN (1, 2, 3, 4))"

_INICIO_PADRAO = date(2000, 1, 1)
_FIM_PADRAO = date(2025, 12, 31)

_FRACAO_MIN_SINTOMAS = 0.01

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


def _filtros(*, doenca=None, uf=None, inicio=None, fim=None, mesorregiao=None, mun="m"):
    clausulas = [
        "f.dt_notificacao BETWEEN DATE '2000-01-01' AND DATE '2026-12-31'",
        "f.eh_provavel",
    ]
    params: list[bigquery.ScalarQueryParameter] = []
    if mesorregiao:
        clausulas.append(f"{mun}.mesorregiao = @meso")
        params.append(bigquery.ScalarQueryParameter("meso", "STRING", mesorregiao))
    if doenca:
        clausulas.append("d.nome = @doenca")
        params.append(bigquery.ScalarQueryParameter("doenca", "STRING", doenca.lower()))
    if uf:
        clausulas.append(f"{mun}.uf = @uf")
        params.append(bigquery.ScalarQueryParameter("uf", "STRING", uf.upper()))
    if inicio:
        clausulas.append("f.dt_notificacao >= @inicio")
        params.append(bigquery.ScalarQueryParameter("inicio", "DATE", inicio))
    if fim:
        clausulas.append("f.dt_notificacao <= @fim")
        params.append(bigquery.ScalarQueryParameter("fim", "DATE", fim))
    return "WHERE " + " AND ".join(clausulas), params


def anos_no_periodo(inicio=None, fim=None, doenca=None) -> float:
    inicio = inicio or _INICIO_PADRAO
    primeiro = INICIO_DADOS.get((doenca or "").lower())
    if primeiro and inicio < primeiro:
        inicio = primeiro
    dias = ((fim or _FIM_PADRAO) - inicio).days + 1
    return max(1.0, dias / 365.25)


def _param_anos(inicio, fim, doenca=None):
    return bigquery.ScalarQueryParameter("anos", "FLOAT64", anos_no_periodo(inicio, fim, doenca))


@_cacheado
def indicadores(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT d.nome AS doenca, COUNT(*) AS casos, COUNTIF(f.eh_obito) AS mortes {BASE_JOIN} {where} GROUP BY d.nome ORDER BY casos DESC",
        params,
    )


@_cacheado
def serie_temporal(doenca=None, uf=None, inicio=None, fim=None, granularidade="mes"):
    expr = _GRAOS.get(granularidade, _GRAOS["mes"])
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT {expr} AS periodo, COUNT(*) AS casos, COUNTIF(f.eh_obito) AS mortes {BASE_JOIN} {where} GROUP BY periodo ORDER BY periodo",
        params,
    )


@_cacheado
def limites_periodo():
    where, params = _filtros()
    linhas = _run(
        f"SELECT FORMAT_DATE('%Y-%m-%d', MIN(f.dt_notificacao)) AS inicio, "
        f"FORMAT_DATE('%Y-%m-%d', MAX(f.dt_notificacao)) AS fim FROM {NOTIF} f {where}",
        params,
    )
    return linhas[0]


@_cacheado
def metadados():
    por_doenca = _run(
        f"""
        SELECT doenca, MIN(ano_arquivo) AS ano_inicio, MAX(ano_arquivo) AS ano_fim,
               COUNT(*) AS arquivos, COUNTIF(status != 'ok') AS arquivos_com_problema,
               FORMAT_TIMESTAMP('%Y-%m-%d', MIN(extraido_em)) AS extraido_de,
               FORMAT_TIMESTAMP('%Y-%m-%d', MAX(extraido_em)) AS extraido_ate,
               FORMAT_TIMESTAMP('%Y-%m-%d', MAX(carregado_em)) AS carregado_em
        FROM {CONTROLE_CARGA}
        GROUP BY doenca ORDER BY doenca
        """,
        [],
    )
    return {
        "fontes": ["DATASUS/SINAN", "CNES", "IBGE"],
        "extraido_de": min((d["extraido_de"] for d in por_doenca if d["extraido_de"]), default=None),
        "extraido_ate": max((d["extraido_ate"] for d in por_doenca if d["extraido_ate"]), default=None),
        "por_doenca": por_doenca,
    }


DOENCAS_COMPARACAO = ("dengue", "zika", "chikungunya")


def _por_100mil_ano(quantidade, populacao, anos):
    return round(quantidade / populacao * 100_000 / anos, 1) if populacao else None


def _incidencia(confirmados, populacao, anos):
    if not populacao or populacao < POP_MIN_INCIDENCIA:
        return None
    return _por_100mil_ano(confirmados, populacao, anos)


def _letalidade(obitos, confirmados):
    return round(obitos / confirmados * 100, 3) if confirmados else None


def _montar_comparacao(cods, linhas, inicio, fim):
    anos = anos_no_periodo(inicio, fim)
    por_municipio: dict[int, dict] = {}
    campos = ("casos", "confirmados", "mortes", "provaveis_resi", "confirmados_resi", "obitos_resi")
    for linha in linhas:
        cod = int(linha["cod_ibge"])
        municipio = por_municipio.setdefault(cod, {
            "cod_ibge": cod,
            "municipio": linha["municipio"],
            "uf": linha["uf"],
            "populacao": int(linha["populacao"]) if linha["populacao"] is not None else None,
            "casos": 0, "confirmados": 0, "obitos": 0,
            "provaveis_resi": 0, "confirmados_resi": 0, "obitos_resi": 0,
            "por_doenca": {d: {c: 0 for c in campos} for d in DOENCAS_COMPARACAO},
        })
        valores = {c: int(linha[c] or 0) for c in campos}
        municipio["casos"] += valores["casos"]
        municipio["confirmados"] += valores["confirmados"]
        municipio["obitos"] += valores["mortes"]
        for c in ("provaveis_resi", "confirmados_resi", "obitos_resi"):
            municipio[c] += valores[c]
        nome = (linha["doenca"] or "").lower()
        if nome in municipio["por_doenca"]:
            municipio["por_doenca"][nome] = valores

    saida = []
    for cod in cods:
        municipio = por_municipio.get(int(cod))
        if not municipio:
            continue
        populacao = municipio["populacao"]
        municipio["letalidade"] = _letalidade(municipio["obitos"], municipio["confirmados"])
        municipio["incidencia"] = _incidencia(municipio["confirmados_resi"], populacao, anos)
        municipio["obitos_100mil"] = _por_100mil_ano(municipio["obitos_resi"], populacao, anos)
        municipio["pct_populacao"] = (
            round(municipio["provaveis_resi"] / populacao * 100, 1) if populacao else None
        )
        for nome, dados in municipio["por_doenca"].items():
            dados["incidencia"] = _incidencia(
                dados["confirmados_resi"], populacao, anos_no_periodo(inicio, fim, nome)
            )
        saida.append(municipio)
    return saida


@_cacheado
def comparar_municipios(cods: tuple[int, ...], inicio=None, fim=None):
    if not cods:
        return []

    params = [
        bigquery.ArrayQueryParameter("cods", "INT64", list(cods)),
        _param_anos(inicio, fim),
    ]
    clausulas = [
        "f.dt_notificacao BETWEEN DATE '2000-01-01' AND DATE '2026-12-31'",
        "f.eh_provavel",
    ]
    if inicio:
        clausulas.append("f.dt_notificacao >= @inicio")
        params.append(bigquery.ScalarQueryParameter("inicio", "DATE", inicio))
    if fim:
        clausulas.append("f.dt_notificacao <= @fim")
        params.append(bigquery.ScalarQueryParameter("fim", "DATE", fim))
    where = "WHERE " + " AND ".join(clausulas)

    linhas = _run(
        f"""
        WITH alvo AS (
            SELECT cod_ibge, nome_municipio, uf, populacao
            FROM {DIM_MUNICIPIO} WHERE cod_ibge IN UNNEST(@cods)
        ),
        atendidos AS (
            SELECT f.cod_ibge, d.nome AS doenca, COUNT(*) AS casos,
                   COUNTIF(f.eh_confirmado) AS confirmados, COUNTIF(f.eh_obito) AS mortes
            FROM {NOTIF} f JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
            {where} AND f.cod_ibge IN UNNEST(@cods)
            GROUP BY 1, 2
        ),
        residentes AS (
            SELECT f.cod_ibge_resi AS cod_ibge, d.nome AS doenca, COUNT(*) AS provaveis_resi,
                   COUNTIF(f.eh_confirmado) AS confirmados_resi, COUNTIF(f.eh_obito) AS obitos_resi
            FROM {NOTIF} f JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
            {where} AND f.cod_ibge_resi IN UNNEST(@cods)
            GROUP BY 1, 2
        ),
        fatos AS (SELECT * FROM atendidos FULL JOIN residentes USING (cod_ibge, doenca))
        SELECT a.cod_ibge, a.nome_municipio AS municipio, a.uf, a.populacao, fa.doenca,
               IFNULL(fa.casos, 0) AS casos, IFNULL(fa.confirmados, 0) AS confirmados,
               IFNULL(fa.mortes, 0) AS mortes, IFNULL(fa.provaveis_resi, 0) AS provaveis_resi,
               IFNULL(fa.confirmados_resi, 0) AS confirmados_resi, IFNULL(fa.obitos_resi, 0) AS obitos_resi
        FROM alvo a
        LEFT JOIN fatos fa ON fa.cod_ibge = a.cod_ibge
        ORDER BY a.cod_ibge, fa.doenca
        """,
        params,
    )
    return _montar_comparacao(cods, linhas, inicio, fim)


_SQL_INCIDENCIA = (
    f"IF(populacao >= {POP_MIN_INCIDENCIA}, "
    "ROUND(SAFE_DIVIDE(confirmados_resi, populacao) * 100000 / @anos, 1), NULL)"
)


def _agregado(colunas, doenca=None, uf=None, inicio=None, fim=None):
    where_m, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    where_r, _ = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim, mun="r")
    params.append(_param_anos(inicio, fim, doenca))
    chave = ", ".join(colunas)
    sel_m = ", ".join(f"m.{c}" for c in colunas)
    sel_r = ", ".join(f"r.{c}" for c in colunas)
    nao_nulo = " AND ".join(f"m.{c} IS NOT NULL" for c in colunas)
    return _run(
        f"""
        WITH pop AS (SELECT {chave}, SUM(populacao) AS populacao FROM {DIM_MUNICIPIO} GROUP BY {chave}),
        atendidos AS (
            SELECT {sel_m}, COUNT(*) AS casos, COUNTIF(f.eh_confirmado) AS confirmados,
                   COUNTIF(f.eh_obito) AS mortes
            {BASE_JOIN} {where_m} AND {nao_nulo}
            GROUP BY {chave}
        ),
        residentes AS (
            SELECT {sel_r}, COUNTIF(f.eh_confirmado) AS confirmados_resi
            {BASE_RESIDENCIA} {where_r}
            GROUP BY {chave}
        )
        SELECT *, {_SQL_INCIDENCIA} AS incidencia
        FROM (
            SELECT a.*, p.populacao, IFNULL(rs.confirmados_resi, 0) AS confirmados_resi
            FROM atendidos a
            LEFT JOIN pop p USING ({chave})
            LEFT JOIN residentes rs USING ({chave})
        )
        ORDER BY casos DESC
        """,
        params,
    )


@_cacheado
def mapa(doenca=None, uf=None, inicio=None, fim=None, mesorregiao=None, limite=5570, ordem="casos"):
    where_m, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim, mesorregiao=mesorregiao)
    where_r, _ = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim, mesorregiao=mesorregiao, mun="r")
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    params.append(_param_anos(inicio, fim, doenca))
    por_incidencia = ordem == "incidencia"
    filtro_pop = f"WHERE populacao >= {POP_MIN_INCIDENCIA}" if por_incidencia else ""
    ordenacao = "incidencia DESC, casos DESC" if por_incidencia else "casos DESC"
    return _run(
        f"""
        WITH atendidos AS (
            SELECT m.cod_ibge, COUNT(*) AS casos, COUNTIF(f.eh_confirmado) AS confirmados,
                   COUNTIF(f.eh_obito) AS mortes
            {BASE_JOIN} {where_m} AND m.cod_ibge IS NOT NULL
            GROUP BY m.cod_ibge
        ),
        residentes AS (
            SELECT r.cod_ibge, COUNTIF(f.eh_confirmado) AS confirmados_resi
            {BASE_RESIDENCIA} {where_r}
            GROUP BY r.cod_ibge
        )
        SELECT *, {_SQL_INCIDENCIA} AS incidencia
        FROM (
            SELECT mm.cod_ibge, mm.nome_municipio AS municipio, mm.uf, mm.populacao,
                   IFNULL(a.casos, 0) AS casos, IFNULL(a.confirmados, 0) AS confirmados,
                   IFNULL(a.mortes, 0) AS mortes, IFNULL(rs.confirmados_resi, 0) AS confirmados_resi
            FROM atendidos a
            FULL JOIN residentes rs USING (cod_ibge)
            JOIN {DIM_MUNICIPIO} mm USING (cod_ibge)
        )
        {filtro_pop}
        ORDER BY {ordenacao} LIMIT @limite
        """,
        params,
    )


@_cacheado
def resumo(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    linha = _run(
        f"""
        SELECT COUNT(*) AS casos,
               COUNTIF(f.eh_obito) AS obitos,
               COUNTIF(f.evolucao = 1 AND f.eh_confirmado) AS curas,
               COUNTIF(f.categoria_sintomas = 'Assintomático') AS assintomaticos,
               COUNTIF(f.categoria_sintomas = 'Sem informação') AS sem_informacao,
               ROUND(AVG(f.idade)) AS idade_media,
               COUNTIF(f.eh_confirmado) AS confirmados
        {BASE_JOIN} {where}
        """,
        params,
    )[0]
    casos = linha.get("casos") or 0
    obitos = linha.get("obitos") or 0
    confirmados = linha.get("confirmados") or 0
    linha["letalidade"] = _letalidade(obitos, confirmados)
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
    return _agregado(["regiao"], doenca, uf, inicio, fim)


@_cacheado
def desfecho(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"""
        SELECT CASE f.evolucao
                 WHEN 1 THEN 'Cura'
                 WHEN 2 THEN 'Óbito pelo agravo'
                 WHEN 3 THEN 'Óbito por outras causas'
                 WHEN 4 THEN 'Óbito em investigação'
                 ELSE 'Ignorado / sem informação'
               END AS desfecho,
               COUNT(*) AS casos
        {BASE_JOIN} {where}
        AND f.eh_confirmado
        GROUP BY desfecho ORDER BY casos DESC
        """,
        params,
    )


@_cacheado
def por_mesorregiao(doenca=None, uf=None, inicio=None, fim=None):
    return _agregado(["mesorregiao", "uf"], doenca, uf, inicio, fim)


@_cacheado
def por_uf(doenca=None, inicio=None, fim=None):
    return _agregado(["uf"], doenca, None, inicio, fim)


@_cacheado
def ranking_uf(doenca=None, inicio=None, fim=None, limite=10):
    where, params = _filtros(doenca=doenca, inicio=inicio, fim=fim)
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"SELECT m.uf, COUNT(*) AS casos, COUNTIF(f.eh_obito) AS mortes {BASE_JOIN} {where} AND m.uf IS NOT NULL GROUP BY m.uf ORDER BY casos DESC LIMIT @limite",
        params,
    )


_CAMPOS_INCOMPLETOS = {
    "sem_sintomas": "f.categoria_sintomas = 'Sem informação'",
    "evolucao_ignorada": _EXPR_EVOLUCAO_IGNORADA,
    "classificacao_vazia": "f.categoria_caso = 'sem_classificacao'",
    "unidade_vazia": "f.co_cnes IS NULL",
    "sexo_ignorado": "(f.sexo IS NULL OR f.sexo NOT IN ('M', 'F'))",
    "idade_vazia": "f.idade IS NULL",
}


def _filtros_qualidade(doenca=None, uf=None, inicio=None, fim=None):
    clausulas: list[str] = []
    params: list[bigquery.ScalarQueryParameter] = []
    if doenca:
        clausulas.append("d.nome = @doenca")
        params.append(bigquery.ScalarQueryParameter("doenca", "STRING", doenca.lower()))
    if uf:
        clausulas.append("m.uf = @uf")
        params.append(bigquery.ScalarQueryParameter("uf", "STRING", uf.upper()))
    if inicio:
        clausulas.append(
            "(f.dt_notificacao >= @inicio OR (f.dt_notificacao IS NULL AND f.ano >= EXTRACT(YEAR FROM @inicio)))"
        )
        params.append(bigquery.ScalarQueryParameter("inicio", "DATE", inicio))
    if fim:
        clausulas.append(
            "(f.dt_notificacao <= @fim OR (f.dt_notificacao IS NULL AND f.ano <= EXTRACT(YEAR FROM @fim)))"
        )
        params.append(bigquery.ScalarQueryParameter("fim", "DATE", fim))
    return clausulas, params


@_cacheado
def qualidade(doenca=None, uf=None, inicio=None, fim=None):
    clausulas, params = _filtros_qualidade(doenca, uf, inicio, fim)
    where = ("WHERE " + " AND ".join(clausulas)) if clausulas else ""
    origem = f"""
        FROM {NOTIF} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        LEFT JOIN {DIM_MUNICIPIO} m ON f.cod_ibge = m.cod_ibge
    """
    campos_sql = ",\n".join(f"COUNTIF({cond}) AS {nome}" for nome, cond in _CAMPOS_INCOMPLETOS.items())

    linha = _run(
        f"""
        SELECT
            COUNT(*) AS total,
            COUNTIF(f.eh_provavel) AS provaveis,
            COUNTIF(f.categoria_caso = 'descartado') AS descartados,
            COUNTIF(f.dt_notificacao IS NOT NULL AND f.cod_ibge IS NOT NULL) AS aproveitaveis,
            COUNTIF(f.dt_notificacao IS NULL) AS sem_data,
            COUNTIF(f.cod_ibge IS NULL) AS sem_municipio,
            COUNTIF(f.cod_ibge_resi IS NULL) AS sem_residencia,
            COUNTIF(f.cod_ibge_origem = 'cnes') AS municipio_via_cnes,
            {campos_sql}
        {origem} {where}
        """,
        params,
    )[0]

    where_ano = "WHERE " + " AND ".join([*clausulas, "f.ano BETWEEN 2000 AND 2026"])
    por_ano = _run(
        f"""
        SELECT f.ano,
               COUNT(*) AS total,
               COUNTIF(f.categoria_caso = 'descartado') AS descartados,
               COUNTIF(f.dt_notificacao IS NOT NULL AND f.cod_ibge IS NOT NULL) AS aproveitaveis,
               COUNTIF(f.categoria_sintomas != 'Sem informação') AS com_sintomas,
               COUNTIF(f.categoria_caso != 'sem_classificacao') AS com_classificacao
        {origem} {where_ano}
        GROUP BY f.ano ORDER BY f.ano
        """,
        params,
    )

    total = linha["total"] or 0

    def pct(x, base=total):
        return round((x or 0) / base * 100, 1) if base else 0.0

    contagens = ("provaveis", "descartados", "aproveitaveis", "sem_data", "sem_municipio",
                 "sem_residencia", "municipio_via_cnes")
    return {
        "total": total,
        **{chave: linha[chave] or 0 for chave in contagens},
        "pct": {chave: pct(linha[chave]) for chave in contagens},
        "campos": {
            nome: {"faltando": linha[nome] or 0, "pct": pct(linha[nome])}
            for nome in _CAMPOS_INCOMPLETOS
        },
        "por_ano": [
            {
                "ano": r["ano"],
                "total": r["total"],
                "descartados": r["descartados"],
                "pct_aproveitaveis": pct(r["aproveitaveis"], r["total"]),
                "pct_com_sintomas": pct(r["com_sintomas"], r["total"]),
                "pct_com_classificacao": pct(r["com_classificacao"], r["total"]),
            }
            for r in por_ano
        ],
    }


@_cacheado
def principais_sintomas(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    selects = ", ".join(
        f"COUNTIF(f.{col} = 1) AS {col}_qtd, COUNTIF(f.{col} IS NOT NULL) AS {col}_base"
        for col in _SINTOMAS.values()
    )
    linha = _run(f"SELECT COUNT(*) AS total, {selects} {BASE_JOIN} {where}", params)
    algum = " OR ".join(f"f.{col} IS NOT NULL" for col in _SINTOMAS.values())
    anos = _run(
        f"SELECT f.ano, COUNT(*) AS total, COUNTIF({algum}) AS com_sintomas {BASE_JOIN} {where} GROUP BY f.ano ORDER BY f.ano",
        params,
    )
    sintomas = []
    for rotulo, col in _SINTOMAS.items():
        qtd = linha[0][f"{col}_qtd"] or 0
        base = linha[0][f"{col}_base"] or 0
        sintomas.append({
            "sintoma": rotulo, "qtd": qtd, "base": base,
            "pct": round(qtd / base * 100, 1) if base else None,
        })
    return {
        "sintomas": sorted(sintomas, key=lambda s: s["pct"] or 0, reverse=True),
        "total": linha[0]["total"] or 0,
        "com_sintomas": sum(a["com_sintomas"] for a in anos),
        "anos_com_sintomas": [
            a["ano"] for a in anos
            if a["ano"] and 2000 <= a["ano"] <= 2026
            and a["total"] and a["com_sintomas"] / a["total"] >= _FRACAO_MIN_SINTOMAS
        ],
    }


@_cacheado
def categorias_sintomas(doenca=None, uf=None, inicio=None, fim=None):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    return _run(
        f"SELECT f.categoria_sintomas AS categoria, COUNT(*) AS qtd {BASE_JOIN} {where} GROUP BY categoria ORDER BY qtd DESC",
        params,
    )


@_cacheado
def tipos_estabelecimento(doenca=None, uf=None, inicio=None, fim=None, limite=10):
    where, params = _filtros(doenca=doenca, uf=uf, inicio=inicio, fim=fim)
    params.append(bigquery.ScalarQueryParameter("limite", "INT64", limite))
    return _run(
        f"""
        SELECT COALESCE(e.tipo_estabelecimento, 'Não informado') AS tipo, COUNT(*) AS casos
        {BASE_JOIN}
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
               COUNT(*) AS casos, COUNTIF(f.eh_obito) AS mortes
        FROM {NOTIF} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        JOIN {DIM_ESTAB} e ON f.co_cnes = e.co_cnes
        {where} AND e.cod_ibge_6 = DIV(@cod_ibge, 10)
        GROUP BY ubs, bairro ORDER BY casos DESC LIMIT @limite
        """,
        params,
    )


@_cacheado
def listar_doencas():
    return _run(f"SELECT nome, cid10 FROM {DIM_DOENCA} ORDER BY nome", [])


@_cacheado
def listar_municipios():
    return _run(
        f"SELECT cod_ibge, nome_municipio AS municipio, uf FROM {DIM_MUNICIPIO} ORDER BY nome_municipio",
        [],
    )


@_cacheado
def listar_ufs():
    linhas = _run(f"SELECT DISTINCT uf FROM {DIM_MUNICIPIO} WHERE uf IS NOT NULL ORDER BY uf", [])
    return [linha["uf"] for linha in linhas]
