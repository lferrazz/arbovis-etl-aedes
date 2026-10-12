from __future__ import annotations

from datetime import date

EVOLUCAO_OBITO_AGRAVO = 2
POP_MIN_INCIDENCIA = 100_000

INICIO_DADOS = {"chikungunya": date(2015, 1, 1), "zika": date(2016, 1, 1)}

CATEGORIAS = ("confirmado", "descartado", "inconclusivo", "sem_classificacao")


def sql_notificacoes(fato: str = "`gold.fato_notificacao`") -> str:
    return f"""
    SELECT
        f.*,
        COALESCE(dp.categoria, 'sem_classificacao') AS categoria_caso,
        COALESCE(dp.categoria, '') != 'descartado' AS eh_provavel,
        COALESCE(dp.categoria, '') = 'confirmado' AS eh_confirmado,
        f.evolucao = {EVOLUCAO_OBITO_AGRAVO} AND COALESCE(dp.categoria, '') = 'confirmado' AS eh_obito
    FROM {fato} f
    LEFT JOIN `gold.de_para_classificacao` dp
        ON dp.id_doenca = f.id_doenca
       AND dp.codigo = f.classificacao
       AND f.ano_arquivo BETWEEN dp.ano_ini AND dp.ano_fim
    """
