from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone

import pandas as pd

from arbovis.config import DATASET_BRONZE, DATASET_SILVER, ROOT_DIR
from arbovis.extract.sinan import GRUPOS_SINAN, iter_lotes, obter_arquivo, validar_arquivo
from arbovis.load.bigquery import (
    apagar_doenca_ano,
    carregar_dataframe,
    executar_arquivo_sql,
    testar_conexao,
)
from arbovis.transform.arboviroses import COLUNAS_ORIGEM, transformar_arbovirose

ANOS_DISPONIVEIS = {
    "dengue": list(range(2000, 2026)),
    "zika": list(range(2016, 2026)),
    "chikungunya": list(range(2015, 2026)),
}

TAMANHO_LOTE = 400_000
PAUSA_ENTRE_DOWNLOADS = 8
TABELA_CONTROLE = "controle_carga"


def _para_bronze(df: pd.DataFrame, ano_arquivo: int) -> pd.DataFrame:
    bronze = df.reindex(columns=COLUNAS_ORIGEM).astype("string")
    bronze["ano_arquivo"] = pd.Series(ano_arquivo, index=bronze.index, dtype="Int64")
    return bronze


def _registrar_carga(doenca: str, ano: int, **campos) -> None:
    apagar_doenca_ano(DATASET_BRONZE, TABELA_CONTROLE, ano, doenca=doenca)
    linha = {
        "doenca": doenca,
        "ano_arquivo": ano,
        "arquivo": None,
        "extraido_em": None,
        "carregado_em": datetime.now(timezone.utc),
        "linhas_origem": None,
        "linhas_bronze": None,
        "linhas_silver": None,
        "status": None,
        "detalhe": None,
        **campos,
    }
    df = pd.DataFrame([linha]).astype({
        "ano_arquivo": "Int64", "linhas_origem": "Int64", "linhas_bronze": "Int64",
        "linhas_silver": "Int64", "arquivo": "string", "status": "string", "detalhe": "string",
    })
    df["extraido_em"] = pd.to_datetime(df["extraido_em"], utc=True)
    carregar_dataframe(df, tabela=TABELA_CONTROLE, dataset=DATASET_BRONZE, modo="append")


def processar(
    doencas: list[str],
    anos_por_doenca: dict[str, list[int]],
    salvar_bronze: bool = True,
    construir_gold: bool = True,
    rebaixar: bool = False,
) -> None:
    print("Testando conexão com o BigQuery...")
    testar_conexao()

    falhas: list[str] = []
    for doenca in doencas:
        for ano in anos_por_doenca.get(doenca, []):
            rotulo = f"{doenca}/{ano}"
            print(f"\n=== {rotulo} ===")
            baixou = False
            try:
                caminho, baixou = obter_arquivo(doenca, ano, rebaixar=rebaixar)
                linhas_origem = validar_arquivo(caminho, doenca, ano)
                extraido_em = datetime.fromtimestamp(caminho.stat().st_mtime, tz=timezone.utc)

                if salvar_bronze:
                    n = apagar_doenca_ano(DATASET_BRONZE, doenca, ano)
                    print(f"  bronze: {n:,} linhas antigas de {ano} apagadas")
                n = apagar_doenca_ano(DATASET_SILVER, "notificacoes", ano, doenca=doenca)
                print(f"  silver: {n:,} linhas antigas de {rotulo} apagadas")

                n_bronze = n_silver = 0
                for i, lote in enumerate(iter_lotes(caminho, COLUNAS_ORIGEM, TAMANHO_LOTE)):
                    if salvar_bronze:
                        carregar_dataframe(_para_bronze(lote, ano), tabela=doenca,
                                           dataset=DATASET_BRONZE, modo="append")
                        n_bronze += len(lote)
                    silver = transformar_arbovirose(lote, doenca, ano_arquivo=ano)
                    carregar_dataframe(silver, tabela="notificacoes",
                                       dataset=DATASET_SILVER, modo="append")
                    n_silver += len(silver)
                    print(f"    lote {i + 1}: +{len(silver):,}")
                    del lote, silver

                confere = n_silver == linhas_origem and (not salvar_bronze or n_bronze == linhas_origem)
                status = "ok" if confere else "divergente"
                print(f"  {rotulo}: origem {linhas_origem:,} | bronze {n_bronze:,} | silver {n_silver:,} -> {status}")
                _registrar_carga(
                    doenca, ano, arquivo=caminho.name, extraido_em=extraido_em,
                    linhas_origem=linhas_origem,
                    linhas_bronze=n_bronze if salvar_bronze else None,
                    linhas_silver=n_silver, status=status,
                )
                if not confere:
                    falhas.append(rotulo)
            except Exception as exc:
                print(f"  FALHA em {rotulo}: {type(exc).__name__}: {exc}")
                falhas.append(rotulo)
                try:
                    _registrar_carga(doenca, ano, status="falha",
                                     detalhe=f"{type(exc).__name__}: {exc}"[:1000])
                except Exception as exc_reg:
                    print(f"  (não consegui registrar a falha: {exc_reg})")

            if baixou:
                time.sleep(PAUSA_ENTRE_DOWNLOADS)

    if construir_gold:
        print("\nConstruindo gold.fato_notificacao_nova a partir da Silver...")
        executar_arquivo_sql(ROOT_DIR / "sql" / "30_gold_notificacoes.sql")
        print("  Pronto. Confira e promova com sql/31_gold_promover_fato.sql.")

    if falhas:
        print(f"\nAnos com falha ou divergência ({len(falhas)}): {', '.join(falhas)}")
    print("\nConcluído.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Carga idempotente do SINAN: cada doença + ano substitui o que já existia."
    )
    parser.add_argument("--doencas", nargs="+", default=list(GRUPOS_SINAN),
                        choices=list(GRUPOS_SINAN))
    parser.add_argument("--anos", nargs="+", type=int)
    parser.add_argument("--full", action="store_true", help="todos os anos de ANOS_DISPONIVEIS")
    parser.add_argument("--sem-bronze", action="store_true")
    parser.add_argument("--sem-gold", action="store_true")
    parser.add_argument("--rebaixar", action="store_true",
                        help="ignora o cache local e baixa de novo do espelho")
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
        rebaixar=args.rebaixar,
    )


if __name__ == "__main__":
    main()
