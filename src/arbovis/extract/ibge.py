from __future__ import annotations

import pandas as pd
import requests

URL_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"

# Agregado 4714 / variável 93 = população residente do Censo. A API de localidades
# é só cadastral e não traz população.
URL_POPULACAO = (
    "https://servicodados.ibge.gov.br/api/v3/agregados/4714"
    "/periodos/{periodo}/variaveis/93?localidades=N6[all]"
)


def extrair_municipios(timeout: int = 30) -> pd.DataFrame:
    resposta = requests.get(URL_MUNICIPIOS, timeout=timeout)
    resposta.raise_for_status()
    return pd.DataFrame(resposta.json())


def extrair_populacao(periodo: int = 2022, timeout: int = 60) -> pd.DataFrame:
    """População residente por município (Censo 2022). Uma chamada traz os 5.570."""
    resposta = requests.get(URL_POPULACAO.format(periodo=periodo), timeout=timeout)
    resposta.raise_for_status()
    series = resposta.json()[0]["resultados"][0]["series"]

    df = pd.DataFrame(
        {"cod_ibge": int(s["localidade"]["id"]), "populacao": s["serie"].get(str(periodo))}
        for s in series
    )
    # O SIDRA devolve "-", "..." e "X" para ausente/sigiloso; viram nulo em vez de erro.
    df["populacao"] = pd.to_numeric(df["populacao"], errors="coerce").astype("Int64")
    return df
