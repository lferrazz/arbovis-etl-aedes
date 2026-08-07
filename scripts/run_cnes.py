from __future__ import annotations

import argparse

from arbovis.config import DATASET_GOLD
from arbovis.extract.cnes import extrair_cnes
from arbovis.extract.cnes_base import extrair_enderecos_cnes
from arbovis.load.bigquery import carregar_dataframe, testar_conexao
from arbovis.transform.cnes import transformar_cnes, transformar_enderecos_cnes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--ano", type=int, default=2024)
    parser.add_argument("--mes", type=int, default=12)
    parser.add_argument("--ufs", nargs="+")
    parser.add_argument("--sem-enderecos", action="store_true")
    args = parser.parse_args()

    print("Testando conexão com o BigQuery...")
    testar_conexao()

    print(f"Extraindo CNES/ST {args.ano}-{args.mes:02d}...")
    df = transformar_cnes(extrair_cnes(args.ano, args.mes, ufs=args.ufs))
    print(f"  {len(df):,} estabelecimentos.")

    if not args.sem_enderecos:
        print("Extraindo endereços da Base CNES...")
        enderecos = transformar_enderecos_cnes(extrair_enderecos_cnes(args.ano, args.mes))
        print(f"  {len(enderecos):,} endereços.")
        df = df.merge(enderecos, on="co_cnes", how="left")
        com_bairro = df["bairro"].notna().mean() * 100
        print(f"  {com_bairro:.1f}% com bairro preenchido.")

    print("Carregando em gold.dim_estabelecimento...")
    n = carregar_dataframe(df, tabela="dim_estabelecimento", dataset=DATASET_GOLD)
    print(f"Concluído: {n:,} estabelecimentos.")


if __name__ == "__main__":
    main()
