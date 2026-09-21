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
    "dia": "FORMAT_DATE('%Y-%m-%d', f.dt_notificacao)",
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
def limites_periodo():
    """Primeira e última data com notificação — define o que o calendário deixa escolher."""
    where, params = _filtros()
    linhas = _run(
        f"SELECT FORMAT_DATE('%Y-%m-%d', MIN(f.dt_notificacao)) AS inicio, "
        f"FORMAT_DATE('%Y-%m-%d', MAX(f.dt_notificacao)) AS fim FROM {FATO} f {where}",
        params,
    )
    return linhas[0]


DOENCAS_COMPARACAO = ("dengue", "zika", "chikungunya")


def _por_100mil(quantidade, populacao):
    """Nunca devolve 0 quando falta população: 0 seria uma afirmação falsa."""
    return round(quantidade / populacao * 100_000, 1) if populacao else None


def _montar_comparacao(cods, linhas):
    por_municipio: dict[int, dict] = {}
    for linha in linhas:
        cod = int(linha["cod_ibge"])
        municipio = por_municipio.setdefault(cod, {
            "cod_ibge": cod,
            "municipio": linha["municipio"],
            "uf": linha["uf"],
            "populacao": int(linha["populacao"]) if linha["populacao"] is not None else None,
            "casos": 0,
            "obitos": 0,
            "por_doenca": {d: {"casos": 0, "mortes": 0} for d in DOENCAS_COMPARACAO},
        })
        casos = int(linha["casos"] or 0)
        mortes = int(linha["mortes"] or 0)
        municipio["casos"] += casos
        municipio["obitos"] += mortes
        nome = (linha["doenca"] or "").lower()
        if nome in municipio["por_doenca"]:
            municipio["por_doenca"][nome] = {"casos": casos, "mortes": mortes}

    saida = []
    for cod in cods:  # preserva a ordem em que o usuário escolheu
        municipio = por_municipio.get(int(cod))
        if not municipio:
            continue
        populacao = municipio["populacao"]
        casos = municipio["casos"]
        municipio["letalidade"] = round(municipio["obitos"] / casos * 100, 3) if casos else 0.0
        municipio["casos_100mil"] = _por_100mil(casos, populacao)
        municipio["obitos_100mil"] = _por_100mil(municipio["obitos"], populacao)
        municipio["pct_populacao"] = round(casos / populacao * 100, 1) if populacao else None
        for dados in municipio["por_doenca"].values():
            dados["casos_100mil"] = _por_100mil(dados["casos"], populacao)
        saida.append(municipio)
    return saida


@_cacheado
def comparar_municipios(cods: tuple[int, ...], inicio=None, fim=None):
    """Compara municípios lado a lado. Respeita o período, mas ignora o filtro de
    doença (a comparação já quebra por doença) e o de UF (os municípios são explícitos).

    `cods` precisa ser tupla: @_cacheado usa os argumentos como chave de dicionário.
    """
    if not cods:
        return []

    params = [bigquery.ArrayQueryParameter("cods", "INT64", list(cods))]
    clausulas = [
        "f.dt_notificacao BETWEEN DATE '2000-01-01' AND DATE '2026-12-31'",
        "f.cod_ibge IN UNNEST(@cods)",
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
        fatos AS (
            SELECT f.cod_ibge, d.nome AS doenca, COUNT(*) AS casos, SUM(f.obito) AS mortes
            FROM {FATO} f
            JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
            {where}
            GROUP BY f.cod_ibge, d.nome
        )
        -- LEFT JOIN: município sem nenhum caso no período continua aparecendo na
        -- comparação, em vez de sumir e parecer erro da tela.
        SELECT a.cod_ibge, a.nome_municipio AS municipio, a.uf, a.populacao,
               fa.doenca, IFNULL(fa.casos, 0) AS casos, IFNULL(fa.mortes, 0) AS mortes
        FROM alvo a
        LEFT JOIN fatos fa ON fa.cod_ibge = a.cod_ibge
        ORDER BY a.cod_ibge, fa.doenca
        """,
        params,
    )
    return _montar_comparacao(cods, linhas)


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


# ── Qualidade dos dados ──
# Um registro é aproveitável quando tem data de notificação E município: sem um
# deles, ele fica de fora de todas as outras abas (que filtram por data e lugar),
# mas continua contado aqui — nada é descartado.
#
# Respeita doença, UF e período como as outras abas, com duas ressalvas
# inevitáveis que a tela explica:
# - com UF selecionada, registro sem município não tem como entrar no recorte;
# - registro sem data entra no período pelo ano da notificação, que ele sempre tem.

# Campo incompleto → condição de "faltando". Evolução 9 = ignorado no SINAN.
_CAMPOS_INCOMPLETOS = {
    "sem_sintomas": "f.categoria_sintomas = 'Sem informação'",
    "evolucao_ignorada": "(f.evolucao IS NULL OR f.evolucao = 9)",
    "classificacao_vazia": "f.classificacao IS NULL",
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
        FROM {FATO} f
        JOIN {DIM_DOENCA} d ON f.id_doenca = d.id_doenca
        LEFT JOIN {DIM_MUNICIPIO} m ON f.cod_ibge = m.cod_ibge
    """
    campos_sql = ",\n".join(f"COUNTIF({cond}) AS {nome}" for nome, cond in _CAMPOS_INCOMPLETOS.items())

    linha = _run(
        f"""
        SELECT
            COUNT(*) AS total,
            COUNTIF(f.dt_notificacao IS NOT NULL AND f.cod_ibge IS NOT NULL) AS aproveitaveis,
            COUNTIF(f.dt_notificacao IS NULL) AS sem_data,
            COUNTIF(f.cod_ibge IS NULL) AS sem_municipio,
            COUNTIF(f.cod_ibge_origem = 'cnes') AS municipio_via_cnes,
            {campos_sql}
        {origem} {where}
        """,
        params,
    )[0]

    # Anos fora de 2000-2026 são erro de digitação do NU_ANO; não viram ponto no gráfico.
    where_ano = "WHERE " + " AND ".join([*clausulas, "f.ano BETWEEN 2000 AND 2026"])
    por_ano = _run(
        f"""
        SELECT f.ano,
               COUNT(*) AS total,
               COUNTIF(f.dt_notificacao IS NOT NULL AND f.cod_ibge IS NOT NULL) AS aproveitaveis,
               COUNTIF(f.categoria_sintomas != 'Sem informação') AS com_sintomas
        {origem} {where_ano}
        GROUP BY f.ano ORDER BY f.ano
        """,
        params,
    )

    total = linha["total"] or 0

    def pct(x, base=total):
        return round((x or 0) / base * 100, 1) if base else 0.0

    return {
        "total": total,
        "aproveitaveis": linha["aproveitaveis"] or 0,
        "sem_data": linha["sem_data"] or 0,
        "sem_municipio": linha["sem_municipio"] or 0,
        "municipio_via_cnes": linha["municipio_via_cnes"] or 0,
        "pct": {
            chave: pct(linha[chave])
            for chave in ("aproveitaveis", "sem_data", "sem_municipio", "municipio_via_cnes")
        },
        "campos": {
            nome: {"faltando": linha[nome] or 0, "pct": pct(linha[nome])}
            for nome in _CAMPOS_INCOMPLETOS
        },
        "por_ano": [
            {
                "ano": r["ano"],
                "total": r["total"],
                "pct_aproveitaveis": pct(r["aproveitaveis"], r["total"]),
                "pct_com_sintomas": pct(r["com_sintomas"], r["total"]),
            }
            for r in por_ano
        ],
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
def listar_municipios():
    """Todos os municípios (~5.571), para a busca da comparação no front."""
    return _run(
        f"SELECT cod_ibge, nome_municipio AS municipio, uf FROM {DIM_MUNICIPIO} ORDER BY nome_municipio",
        [],
    )


@_cacheado
def listar_ufs():
    linhas = _run(f"SELECT DISTINCT uf FROM {DIM_MUNICIPIO} WHERE uf IS NOT NULL ORDER BY uf", [])
    return [linha["uf"] for linha in linhas]
