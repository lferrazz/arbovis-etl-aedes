from __future__ import annotations

import pandas as pd

ID_DOENCA = {"dengue": 1, "zika": 2, "chikungunya": 3}

RENOMEAR = {
    "DT_NOTIFIC": "dt_notificacao",
    "DT_SIN_PRI": "dt_sintomas",
    "NU_ANO": "ano",
    "ID_MUNICIP": "cod_ibge_6",
    "ID_UNIDADE": "co_cnes",
    "CS_SEXO": "sexo",
    "NU_IDADE_N": "idade",
    "CLASSI_FIN": "classificacao",
    "EVOLUCAO": "evolucao",
    "FEBRE": "febre",
    "MIALGIA": "mialgia",
    "CEFALEIA": "cefaleia",
    "EXANTEMA": "exantema",
    "ARTRALGIA": "artralgia",
    "DOR_RETRO": "dor_retro",
}

COLUNAS_ORIGEM = list(RENOMEAR)
COLUNAS_DATA = ["dt_notificacao", "dt_sintomas"]
COLUNAS_SINTOMAS = ["febre", "mialgia", "cefaleia", "exantema", "artralgia", "dor_retro"]
COLUNAS_INT = ["ano", "cod_ibge_6", "co_cnes", "classificacao", "evolucao"] + COLUNAS_SINTOMAS

COLUNAS_SILVER = [
    "cod_ibge_6", "co_cnes", "id_doenca", "doenca",
    "dt_notificacao", "dt_sintomas", "ano",
    "sexo", "idade", "classificacao", "evolucao",
    *COLUNAS_SINTOMAS,
]

IDADE_MAXIMA = 120


def _decodificar_idade(serie: pd.Series) -> pd.Series:
    v = pd.to_numeric(serie, errors="coerce")
    unidade = v // 1000
    valor = v % 1000
    idade = valor.where(unidade == 4, other=0)
    idade = idade.where(idade <= IDADE_MAXIMA)
    return idade.astype("Int64")


def transformar_arbovirose(df_bruto: pd.DataFrame, doenca: str) -> pd.DataFrame:
    doenca = doenca.lower()
    if doenca not in ID_DOENCA:
        raise ValueError(f"Doença inválida: {doenca!r}. Use {list(ID_DOENCA)}.")

    presentes = {orig: novo for orig, novo in RENOMEAR.items() if orig in df_bruto.columns}
    df = df_bruto[list(presentes)].rename(columns=presentes).copy()

    df["doenca"] = doenca
    df["id_doenca"] = ID_DOENCA[doenca]

    for col in COLUNAS_DATA:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], format="%Y%m%d", errors="coerce")

    if "idade" in df.columns:
        df["idade"] = _decodificar_idade(df["idade"])

    if "sexo" in df.columns:
        df["sexo"] = df["sexo"].astype("string").str.strip().str.upper().str[0]

    for col in COLUNAS_INT:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")

    # Não descartamos registros sem data/município: eles são preservados e, na
    # gold, classificados como "sem informação" 
    df = df.drop_duplicates().reset_index(drop=True)

    for col in COLUNAS_SILVER:
        if col not in df.columns:
            if col in COLUNAS_DATA:
                df[col] = pd.Series(pd.NaT, index=df.index, dtype="datetime64[ns]")
            elif col in COLUNAS_INT or col == "idade":
                df[col] = pd.Series(pd.NA, index=df.index, dtype="Int64")
            else:
                df[col] = pd.Series(pd.NA, index=df.index, dtype="string")

    return df[COLUNAS_SILVER]
