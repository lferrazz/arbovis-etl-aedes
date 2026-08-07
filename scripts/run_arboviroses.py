from __future__ import annotations

import argparse
import time

import pandas as pd

from arbovis.config import DATASET_BRONZE, DATASET_SILVER, ROOT_DIR
from arbovis.extract.sinan import (
    GRUPOS_SINAN,
    baixar_arbovirose_ano,
    iter_lotes,
)
from arbovis.load.bigquery import carregar_dataframe, executar_arquivo_sql, testar_conexao
from arbovis.transform.arboviroses import COLUNAS_ORIGEM, transformar_arbovirose

ANOS_DISPONIVEIS = {
    "dengue": list(range(2000, 2026)),
    "zika": list(range(2016, 2025)),
    "chikungunya": list(range(2015, 2025)),
}

TAMANHO_LOTE = 400_000
PAUSA_ENTRE_ANOS = 8


def _para_bronze(df: pd.DataFrame) -> pd.DataFrame:
    return df.reindex(columns=COLUNAS_ORIGEM).astype("string")


def processar(
    doencas: list[str],
    anos_por_doenca: dict[str, list[int]],
    salvar_bronze: bool = True,
    construir_gold: bool = True,
    resetar: bool = True,
) -> None:
    print("Testando conexão com o BigQuery...")
    testar_conexao()

    silver_iniciado = not resetar
    bronze_iniciado: set[str] = set()
    total_silver = 0
    falhas: list[str] = []

    for doenca in doencas:
        for ano in anos_por_doenca.get(doenca, []):
            rotulo = f"{doenca}/{ano}"
            try:
                print(f"\n=== {rotulo} ===")
                print("  Baixando do SINAN...")
                caminho = baixar_arbovirose_ano(doenca, ano)

                n_ano = 0
                for i, lote in enumerate(iter_lotes(caminho, COLUNAS_ORIGEM, TAMANHO_LOTE)):
                    if salvar_bronze:
                        modo_b = "replace" if (resetar and doenca not in bronze_iniciado) else "append"
                        carregar_dataframe(_para_bronze(lote), tabela=doenca,
                                           dataset=DATASET_BRONZE, modo=modo_b)
                        bronze_iniciado.add(doenca)

                    silver = transformar_arbovirose(lote, doenca)
                    modo_s = "replace" if not silver_iniciado else "append"
                    carregar_dataframe(silver, tabela="notificacoes",
                                       dataset=DATASET_SILVER, modo=modo_s)
                    silver_iniciado = True
                    n_ano += len(silver)
                    total_silver += len(silver)
                    print(f"    lote {i + 1}: +{len(silver):,} (silver {modo_s})")
                    del lote, silver

                print(f"  {rotulo}: {n_ano:,} registros carregados.")
            except Exception as exc:
                print(f"  FALHA em {rotulo}: {type(exc).__name__}: {exc}")
                falhas.append(rotulo)

            time.sleep(PAUSA_ENTRE_ANOS)

    print(f"\nSilver: ~{total_silver:,} linhas acrescentadas nesta execução.")

    if construir_gold and silver_iniciado:
        print("Reconstruindo o Gold a partir da Silver...")
        executar_arquivo_sql(ROOT_DIR / "sql" / "30_gold_notificacoes.sql")
        print("  Gold atualizado.")

    if falhas:
        print(f"\nAnos que falharam ({len(falhas)}): {', '.join(falhas)}")
    print("\nConcluído.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--doencas", nargs="+", default=list(GRUPOS_SINAN),
                        choices=list(GRUPOS_SINAN))
    parser.add_argument("--anos", nargs="+", type=int)
    parser.add_argument("--full", action="store_true")
    parser.add_argument("--sem-bronze", action="store_true")
    parser.add_argument("--sem-gold", action="store_true")
    parser.add_argument("--append", action="store_true")
    args = parser.parse_args()

    if args.full:
        anos_por_doenca = {d: ANOS_DISPONIVEIS[d] for d in args.doencas}
    elif args.anos:
        anos_por_doenca = {d: args.anos for d in args.doencas}
    else:
        parser.error("informe --anos ou --full.")

    processar(
        doencas=args.doencas,
        anos_por_doenca=anos_por_doenca,
        salvar_bronze=not args.sem_bronze,
        construir_gold=not args.sem_gold,
        resetar=not args.append,
    )


if __name__ == "__main__":
    main()
