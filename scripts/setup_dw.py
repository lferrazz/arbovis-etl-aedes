import pandas as pd

from arbovis.config import DATASET_GOLD
from arbovis.load.bigquery import carregar_dataframe, testar_conexao

DIM_DOENCA = pd.DataFrame(
    [
        {"id_doenca": 1, "nome": "dengue", "cid10": "A90", "grupo_sinan": "DENG"},
        {"id_doenca": 2, "nome": "zika", "cid10": "A928", "grupo_sinan": "ZIKA"},
        {"id_doenca": 3, "nome": "chikungunya", "cid10": "A920", "grupo_sinan": "CHIK"},
    ]
)

def main() -> None:
    print("Testando conexão com o BigQuery...")
    testar_conexao()

    print("Carregando gold.dim_doenca...")
    n = carregar_dataframe(DIM_DOENCA, tabela="dim_doenca", dataset=DATASET_GOLD)
    print(f"  {n} doenças em gold.dim_doenca.")


if __name__ == "__main__":
    main()
