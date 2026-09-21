from __future__ import annotations

import asyncio

import pandas as pd
from pysus.api import PySUSClient

from arbovis.extract.alias import resolver_alias

UFS = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
    "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
    "SP", "SE", "TO",
]

COLUNAS_CNES = ["CNES", "CODUFMUN", "TP_UNID", "NAT_JUR", "VINC_SUS", "ESFERA_A"]


async def _baixar_uf(client: PySUSClient, uf: str, ano: int, mes: int) -> pd.DataFrame | None:
    arquivos = await client.query(dataset="CNES", group="ST", state=uf, year=ano, month=mes)
    if not arquivos:
        return None
    local = await client.download(arquivos[0])
    df = pd.read_parquet(resolver_alias(local.path))
    return df[[c for c in COLUNAS_CNES if c in df.columns]]


def extrair_cnes(ano: int, mes: int, ufs: list[str] | None = None) -> pd.DataFrame:
    ufs = ufs or UFS

    async def _coletar() -> pd.DataFrame:
        client = PySUSClient()
        partes: list[pd.DataFrame] = []
        for uf in ufs:
            print(f"  CNES ST {uf} {ano}-{mes:02d}...")
            df = await _baixar_uf(client, uf, ano, mes)
            if df is not None:
                partes.append(df)
        if not partes:
            raise RuntimeError("Nenhum arquivo CNES encontrado para a competência.")
        return pd.concat(partes, ignore_index=True)

    return asyncio.run(_coletar())
