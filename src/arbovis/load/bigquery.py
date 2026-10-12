from __future__ import annotations

import pandas as pd
from google.cloud import bigquery
from google.cloud.exceptions import NotFound

from arbovis.config import LOCATION, get_bq_client, tabela_ref


def _garantir_dataset(client: bigquery.Client, dataset: str) -> None:
    ref = bigquery.Dataset(f"{client.project}.{dataset}")
    ref.location = LOCATION
    ref.default_table_expiration_ms = None
    ref.default_partition_expiration_ms = None
    try:
        client.get_dataset(f"{client.project}.{dataset}")
    except NotFound:
        client.create_dataset(ref, exists_ok=True)


def remover_expiracao(dataset: str) -> None:
    client = get_bq_client()
    ds = client.get_dataset(f"{client.project}.{dataset}")
    ds.default_table_expiration_ms = None
    ds.default_partition_expiration_ms = None
    client.update_dataset(ds, ["default_table_expiration_ms", "default_partition_expiration_ms"])


def apagar_doenca_ano(dataset: str, tabela: str, ano_arquivo: int, doenca: str | None = None) -> int:
    client = get_bq_client()
    destino = tabela_ref(dataset, tabela)
    try:
        tab = client.get_table(destino)
    except NotFound:
        return 0
    if "ano_arquivo" not in {c.name for c in tab.schema}:
        raise RuntimeError(
            f"{destino} está no esquema antigo (sem ano_arquivo); recrie a tabela antes de recarregar."
        )

    filtro = "ano_arquivo = @ano"
    params = [bigquery.ScalarQueryParameter("ano", "INT64", ano_arquivo)]
    if doenca is not None:
        filtro += " AND doenca = @doenca"
        params.append(bigquery.ScalarQueryParameter("doenca", "STRING", doenca))
    job = client.query(
        f"DELETE FROM `{destino}` WHERE {filtro}",
        job_config=bigquery.QueryJobConfig(query_parameters=params),
    )
    job.result()
    return job.num_dml_affected_rows or 0


def carregar_dataframe(
    df: pd.DataFrame,
    tabela: str,
    dataset: str = "bronze",
    modo: str = "replace",
) -> int:
    disposicao = {
        "replace": bigquery.WriteDisposition.WRITE_TRUNCATE,
        "append": bigquery.WriteDisposition.WRITE_APPEND,
    }[modo]

    client = get_bq_client()
    _garantir_dataset(client, dataset)

    destino = tabela_ref(dataset, tabela)
    job_config = bigquery.LoadJobConfig(
        write_disposition=disposicao,
        autodetect=True,
    )
    job = client.load_table_from_dataframe(df, destino, job_config=job_config)
    job.result()

    tabela_final = client.get_table(destino)
    return tabela_final.num_rows


def executar_query(sql: str):
    client = get_bq_client()
    return client.query(sql).result()


def executar_arquivo_sql(caminho) -> None:
    from pathlib import Path

    sql = Path(caminho).read_text(encoding="utf-8")
    executar_query(sql)


def testar_conexao() -> bool:
    client = get_bq_client()
    list(client.query("SELECT 1 AS ok").result())
    return True
