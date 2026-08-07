"""Reconstrói silver.notificacoes a partir da camada bronze (sem rebaixar do DATASUS).

Usa a bronze (dados brutos já no BigQuery) como fonte e aplica o transform novo,
que NÃO descarta registros sem data/município. Ao final, reconstrói a gold.
"""

from __future__ import annotations

import pandas as pd
from google.cloud import bigquery_storage

from arbovis.config import DATASET_SILVER, PROJECT_ID, ROOT_DIR, get_bq_client
from arbovis.load.bigquery import carregar_dataframe, executar_arquivo_sql
from arbovis.transform.arboviroses import transformar_arbovirose

DOENCAS = ["dengue", "zika", "chikungunya"]
LOTE = 500_000


def _flush(paginas: list[pd.DataFrame], doenca: str, primeiro: bool) -> int:
    df = pd.concat(paginas, ignore_index=True)
    silver = transformar_arbovirose(df, doenca)
    carregar_dataframe(
        silver, tabela="notificacoes", dataset=DATASET_SILVER,
        modo="replace" if primeiro else "append",
    )
    return len(silver)


def main() -> None:
    client = get_bq_client()
    bqstorage = bigquery_storage.BigQueryReadClient(credentials=client._credentials)
    primeiro = True
    total = 0

    for doenca in DOENCAS:
        print(f"Lendo bronze.{doenca}...", flush=True)
        job = client.query(f"SELECT * FROM `{PROJECT_ID}.bronze.{doenca}`")
        buffer: list[pd.DataFrame] = []
        acumulado = 0
        n_doenca = 0

        for pagina in job.result().to_dataframe_iterable(bqstorage_client=bqstorage):
            buffer.append(pagina)
            acumulado += len(pagina)
            if acumulado >= LOTE:
                n = _flush(buffer, doenca, primeiro)
                primeiro = False
                n_doenca += n
                total += n
                print(f"  {doenca}: +{n:,} (acumulado {n_doenca:,})", flush=True)
                buffer, acumulado = [], 0

        if buffer:
            n = _flush(buffer, doenca, primeiro)
            primeiro = False
            n_doenca += n
            total += n
            print(f"  {doenca}: +{n:,} (acumulado {n_doenca:,})", flush=True)

        print(f"  {doenca}: {n_doenca:,} registros na silver.", flush=True)

    print(f"\nSilver reconstruída: {total:,} registros.", flush=True)
    print("Reconstruindo gold.fato_notificacao...", flush=True)
    executar_arquivo_sql(ROOT_DIR / "sql" / "30_gold_notificacoes.sql")
    print("Concluído.", flush=True)


if __name__ == "__main__":
    main()
