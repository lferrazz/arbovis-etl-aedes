from __future__ import annotations

import argparse

import pandas as pd
from google.cloud import bigquery

from arbovis.config import ROOT_DIR, get_bq_client
from arbovis.definicoes import sql_notificacoes

PASTA = ROOT_DIR / "validacao"
ANOS = (2000, 2025)
LIMITE_DIFERENCA = 1.0
ARQUIVOS_TABNET_CHIK = (2016, 2023, 2024)


def _consultar(client: bigquery.Client, sql: str) -> pd.DataFrame:
    cfg = bigquery.QueryJobConfig(maximum_bytes_billed=20 * 1024**3)
    return client.query(sql, job_config=cfg).result().to_dataframe()


def contagens(client: bigquery.Client, fato: str) -> pd.DataFrame:
    return _consultar(client, f"""
    WITH n AS ({sql_notificacoes(fato)})
    SELECT d.nome AS doenca, n.ano,
           COUNT(*) AS total,
           COUNTIF(n.eh_provavel) AS provaveis,
           COUNTIF(n.eh_confirmado) AS confirmados,
           COUNTIF(n.categoria_caso = 'descartado') AS descartados,
           COUNTIF(n.categoria_caso = 'inconclusivo') AS inconclusivos,
           COUNTIF(n.categoria_caso = 'sem_classificacao') AS sem_classificacao,
           COUNTIF(n.eh_obito) AS obitos_agravo_confirmados,
           COUNTIF(n.obito = 1 AND n.eh_provavel) AS obitos_agravo_provaveis,
           COUNTIF(n.obito = 1) AS obitos_agravo_todos
    FROM n JOIN `gold.dim_doenca` d USING (id_doenca)
    WHERE n.ano BETWEEN {ANOS[0]} AND {ANOS[1]}
    GROUP BY 1, 2 ORDER BY 1, 2
    """)


def por_codigo(client: bigquery.Client, fato: str) -> pd.DataFrame:
    return _consultar(client, f"""
    WITH n AS ({sql_notificacoes(fato)})
    SELECT d.nome AS doenca, n.ano, n.classificacao AS codigo, n.categoria_caso AS categoria,
           COUNT(*) AS n, COUNTIF(n.obito = 1) AS obitos_agravo
    FROM n JOIN `gold.dim_doenca` d USING (id_doenca)
    WHERE n.ano BETWEEN {ANOS[0]} AND {ANOS[1]}
    GROUP BY 1, 2, 3, 4 ORDER BY 1, 2, 3
    """)


def chik_arquivos_tabnet(client: bigquery.Client, fato: str) -> pd.DataFrame:
    arquivos = ", ".join(map(str, ARQUIVOS_TABNET_CHIK))
    return _consultar(client, f"""
    SELECT f.ano,
           COUNT(*) AS total_por_evolucao,
           COUNTIF(f.classificacao IS NULL OR f.classificacao IN (0, 5, 13)) AS total_por_classificacao,
           COUNTIF(f.classificacao IS NULL OR f.classificacao = 0) AS ign_branco,
           COUNTIF(f.classificacao = 5) AS descartados,
           COUNTIF(f.classificacao = 13) AS confirmado_codigo_13
    FROM {fato} f
    WHERE f.id_doenca = 3 AND f.ano_arquivo IN ({arquivos}) AND f.ano IN ({arquivos})
    GROUP BY 1 ORDER BY 1
    """)


def comparar(cont: pd.DataFrame, chik: pd.DataFrame, ref: pd.DataFrame) -> pd.DataFrame:
    equivalencia = {
        ("dengue", "provaveis"): "provaveis",
        ("dengue", "obitos_agravo"): "obitos_agravo_provaveis",
        ("chikungunya", "todos_casos"): "total",
        ("chikungunya", "obitos_agravo"): "obitos_agravo_todos",
    }
    linhas = []
    for r in ref.itertuples():
        if r.arquivos_selecionados == "todos":
            coluna = equivalencia.get((r.doenca, r.metrica))
            achado = cont[(cont.doenca == r.doenca) & (cont.ano == r.ano)]
            arbovis = int(achado[coluna].iloc[0]) if coluna and not achado.empty else None
        else:
            coluna = r.metrica
            achado = chik[chik.ano == r.ano]
            arbovis = int(achado[coluna].iloc[0]) if not achado.empty else None
        dif = None if arbovis is None else 100 * (arbovis - r.valor) / r.valor
        linhas.append({
            "doenca": r.doenca, "ano": r.ano, "metrica": r.metrica,
            "arquivos": r.arquivos_selecionados, "coluna_arbovis": coluna,
            "tabnet": r.valor, "arbovis": arbovis,
            "diferenca_pct": None if dif is None else round(dif, 3),
            "acima_1pct": dif is None or abs(dif) > LIMITE_DIFERENCA,
            "consultado_em": r.consultado_em,
        })
    return pd.DataFrame(linhas)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tabela", default="fato_notificacao")
    args = parser.parse_args()
    fato = f"`gold.{args.tabela}`"

    client = get_bq_client()
    PASTA.mkdir(exist_ok=True)

    cont = contagens(client, fato)
    cont.to_csv(PASTA / "contagens_por_ano.csv", index=False)
    por_codigo(client, fato).to_csv(PASTA / "confirmados_por_codigo.csv", index=False)
    chik = chik_arquivos_tabnet(client, fato)

    ref = pd.read_csv(PASTA / "tabnet_referencia.csv")
    comp = comparar(cont, chik, ref)
    comp.to_csv(PASTA / "comparacao_tabnet.csv", index=False)

    pd.set_option("display.width", 200)
    print(f"Tabela: gold.{args.tabela}\n")
    print(cont.to_string(index=False))
    print("\nComparação com o TabNet (* = diferença acima de 1% ou sem valor no ArboVis):")
    for r in comp.itertuples():
        marca = "*" if r.acima_1pct else " "
        arbovis = "—" if r.arbovis is None or pd.isna(r.arbovis) else f"{int(r.arbovis):,}"
        dif = "—" if r.diferenca_pct is None or pd.isna(r.diferenca_pct) else f"{r.diferenca_pct:+.2f}%"
        print(f" {marca} {r.doenca:12s} {r.ano} {r.metrica:22s} [{r.arquivos:14s}] "
              f"TabNet {r.tabnet:>10,}  ArboVis {arbovis:>10}  {dif}")


if __name__ == "__main__":
    main()
