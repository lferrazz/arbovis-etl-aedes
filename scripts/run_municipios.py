from arbovis.config import DATASET_GOLD
from arbovis.extract.ibge import extrair_municipios
from arbovis.load.bigquery import carregar_dataframe, testar_conexao
from arbovis.transform.municipios import transformar_municipios


def main() -> None:
    print("Testando conexão com o BigQuery...")
    testar_conexao()

    print("Extraindo municípios da API do IBGE...")
    df_bruto = extrair_municipios()
    print(f"  {len(df_bruto):,} municípios recebidos.")

    print("Transformando...")
    df = transformar_municipios(df_bruto)

    print("Carregando em gold.dim_municipio...")
    n = carregar_dataframe(df, tabela="dim_municipio", dataset=DATASET_GOLD)
    print(f"Concluído: {n:,} municípios.")


if __name__ == "__main__":
    main()
