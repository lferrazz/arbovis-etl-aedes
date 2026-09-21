from arbovis.config import DATASET_GOLD
from arbovis.extract.ibge import extrair_municipios, extrair_populacao
from arbovis.load.bigquery import carregar_dataframe, testar_conexao
from arbovis.transform.municipios import transformar_municipios


def main() -> None:
    print("Testando conexão com o BigQuery...")
    testar_conexao()

    print("Extraindo municípios da API do IBGE...")
    df_bruto = extrair_municipios()
    print(f"  {len(df_bruto):,} municípios recebidos.")

    print("Extraindo população (Censo 2022)...")
    df_pop = extrair_populacao()
    print(f"  {len(df_pop):,} municípios com população.")

    print("Transformando...")
    df = transformar_municipios(df_bruto, df_pop)

    sem_pop = int(df["populacao"].isna().sum())
    print(f"  população total: {int(df['populacao'].sum()):,} · sem população: {sem_pop}")
    # Barato, e evita subir a dimensão sem população se o IBGE mudar o formato.
    if sem_pop > 5:
        raise SystemExit(f"Cobertura de população suspeita: {sem_pop} municípios sem valor.")

    print("Carregando em gold.dim_municipio...")
    n = carregar_dataframe(df, tabela="dim_municipio", dataset=DATASET_GOLD)
    print(f"Concluído: {n:,} municípios.")


if __name__ == "__main__":
    main()
