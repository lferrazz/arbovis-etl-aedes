from __future__ import annotations

import pandas as pd


def _uf_de(no: dict | None) -> dict | None:
    if not no:
        return None
    for caminho in (("mesorregiao", "UF"), ("regiao-intermediaria", "UF")):
        atual: dict | None = no
        for chave in caminho:
            atual = atual.get(chave) if isinstance(atual, dict) else None
            if atual is None:
                break
        if isinstance(atual, dict):
            return atual
    return None


def _campo_uf(micro: dict | None, imediata: dict | None, campo: str) -> str | None:
    uf = _uf_de(micro) or _uf_de(imediata)
    if not uf:
        return None
    if campo == "sigla":
        return uf.get("sigla")
    if campo == "nome":
        return uf.get("nome")
    if campo == "regiao":
        return (uf.get("regiao") or {}).get("nome")
    return None


def _mesorregiao(micro: dict | None) -> str | None:
    if isinstance(micro, dict):
        meso = micro.get("mesorregiao")
        if isinstance(meso, dict):
            return meso.get("nome")
    return None


def transformar_municipios(
    df_bruto: pd.DataFrame, df_populacao: pd.DataFrame | None = None
) -> pd.DataFrame:
    micro = df_bruto["microrregiao"]
    imediata = df_bruto["regiao-imediata"]

    df = pd.DataFrame()
    df["cod_ibge"] = df_bruto["id"].astype("int64")
    df["nome_municipio"] = df_bruto["nome"].str.strip()
    df["uf"] = [_campo_uf(m, i, "sigla") for m, i in zip(micro, imediata)]
    df["estado"] = [_campo_uf(m, i, "nome") for m, i in zip(micro, imediata)]
    df["regiao"] = [_campo_uf(m, i, "regiao") for m, i in zip(micro, imediata)]
    df["mesorregiao"] = [_mesorregiao(m) for m in micro]

    # 6 dígitos (sem dígito verificador) para casar com o SINAN
    df["cod_ibge_6"] = df["cod_ibge"] // 10

    df = df.drop_duplicates(subset=["cod_ibge"]).reset_index(drop=True)

    # LEFT a partir da dimensão: ela tem 5.571 municípios e o Censo 2022 tem 5.570
    # (os criados depois ficam sem população, e precisam continuar na dimensão).
    if df_populacao is not None:
        pop = df_populacao.drop_duplicates(subset=["cod_ibge"])
        df = df.merge(pop[["cod_ibge", "populacao"]], on="cod_ibge", how="left")
    else:
        df["populacao"] = pd.NA

    # Int64 (nullable) e não int64: com um nulo o NumPy converteria para float,
    # e a coluna chegaria ao BigQuery como FLOAT.
    df["populacao"] = df["populacao"].astype("Int64")
    return df
