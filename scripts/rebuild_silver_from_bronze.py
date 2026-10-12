from __future__ import annotations

import pandas as pd
from google.cloud import bigquery, bigquery_storage

from arbovis.config import DATASET_SILVER, PROJECT_ID, ROOT_DIR, get_bq_client
from arbovis.load.bigquery import apagar_doenca_ano, carregar_dataframe, executar_arquivo_sql
from arbovis.transform.arboviroses import transformar_arbovirose

DOENCAS = ["dengue", "zika", "chikungunya"]
LOTE = 500_000


def main() -> None:
    client = get_bq_client()
    bqstorage = bigquery_storage.BigQueryReadClient(credentials=client._credentials)
    total = 0

    for doenca in DOENCAS:
        anos = [r.ano_arquivo for r in client.query(
            f"SELECT DISTINCT ano_arquivo FROM `{PROJECT_ID}.bronze.{doenca}` ORDER BY 1"
        ).result()]
        for ano in anos:
            apagar_doenca_ano(DATASET_SILVER, "notificacoes", ano, doenca=doenca)
            job = client.query(
                f"SELECT * EXCEPT (ano_arquivo) FROM `{PROJECT_ID}.bronze.{doenca}` WHERE ano_arquivo = @ano",
                job_config=bigquery.QueryJobConfig(
                    query_parameters=[bigquery.ScalarQueryParameter("ano", "INT64", ano)]
                ),
            )
            buffer: list[pd.DataFrame] = []
            n_ano = 0

            def _flush() -> int:
                silver = transformar_arbovirose(pd.concat(buffer, ignore_index=True), doenca, ano_arquivo=ano)
                carregar_dataframe(silver, tabela="notificacoes", dataset=DATASET_SILVER, modo="append")
                return len(silver)

            for pagina in job.result().to_dataframe_iterable(bqstorage_client=bqstorage):
                buffer.append(pagina)
                if sum(len(p) for p in buffer) >= LOTE:
                    n_ano += _flush()
                    buffer = []
            if buffer:
                n_ano += _flush()
            total += n_ano
            print(f"  {doenca}/{ano}: {n_ano:,} registros na silver.", flush=True)

    print(f"\nSilver reconstruída: {total:,} registros.", flush=True)
    print("Construindo gold.fato_notificacao_nova...", flush=True)
    executar_arquivo_sql(ROOT_DIR / "sql" / "30_gold_notificacoes.sql")
    print("Concluído. Confira e promova com sql/31_gold_promover_fato.sql.", flush=True)


if __name__ == "__main__":
    main()
