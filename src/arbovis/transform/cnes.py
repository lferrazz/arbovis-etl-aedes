from __future__ import annotations

import pandas as pd

TIPO_UNIDADE = {
    1: "Posto de Saúde",
    2: "Centro de Saúde/Unidade Básica de Saúde",
    4: "Policlínica",
    5: "Hospital Geral",
    7: "Hospital Especializado",
    15: "Unidade Mista",
    20: "Pronto Socorro Geral",
    21: "Pronto Socorro Especializado",
    22: "Consultório Isolado",
    36: "Clínica/Centro de Especialidade",
    39: "Unidade de Apoio Diagnose e Terapia (SADT)",
    40: "Unidade Móvel Terrestre",
    42: "Unidade Móvel Pré-Hospitalar (Urgência)",
    43: "Farmácia",
    45: "Unidade de Saúde da Família",
    50: "Unidade de Vigilância em Saúde",
    62: "Hospital/Dia",
    67: "Laboratório",
    68: "Secretaria de Saúde",
    69: "Centro de Atenção Hemoterápica/Hematológica",
    70: "Centro de Atenção Psicossocial (CAPS)",
    71: "Centro de Apoio à Saúde da Família",
    72: "Unidade de Atenção à Saúde Indígena",
    73: "Pronto Atendimento",
    76: "Central de Regulação Médica de Urgências",
    81: "Central de Regulação",
}


def transformar_cnes(df_bruto: pd.DataFrame) -> pd.DataFrame:
    df = pd.DataFrame()
    df["co_cnes"] = pd.to_numeric(df_bruto["CNES"], errors="coerce").astype("Int64")
    df["cod_ibge_6"] = pd.to_numeric(df_bruto["CODUFMUN"], errors="coerce").astype("Int64")
    df["tp_unid"] = pd.to_numeric(df_bruto["TP_UNID"], errors="coerce").astype("Int64")
    df["tipo_estabelecimento"] = (
        df["tp_unid"].map(TIPO_UNIDADE).fillna("Outros").astype("string")
    )
    df["vinculo_sus"] = df_bruto["VINC_SUS"].astype("string").str.strip() == "1"

    df = df.dropna(subset=["co_cnes", "cod_ibge_6"])
    df = df.drop_duplicates(subset=["co_cnes"]).reset_index(drop=True)
    return df


def transformar_enderecos_cnes(df_bruto: pd.DataFrame) -> pd.DataFrame:
    df = pd.DataFrame()
    df["co_cnes"] = pd.to_numeric(df_bruto["co_cnes"], errors="coerce").astype("Int64")
    df["nome"] = df_bruto["nome"].str.strip().astype("string")
    df["bairro"] = df_bruto["bairro"].str.strip().astype("string")

    logradouro = df_bruto["logradouro"].fillna("").str.strip()
    numero = df_bruto["numero"].fillna("").str.strip()
    df["logradouro"] = (
        (logradouro + ", " + numero).str.strip(", ").replace("", pd.NA).astype("string")
    )
    df["cep"] = df_bruto["cep"].str.strip().astype("string")

    df = df.dropna(subset=["co_cnes"])
    df = df.drop_duplicates(subset=["co_cnes"]).reset_index(drop=True)
    return df
