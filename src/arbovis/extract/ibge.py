from __future__ import annotations

import pandas as pd
import requests

URL_MUNICIPIOS = "https://servicodados.ibge.gov.br/api/v1/localidades/municipios"


def extrair_municipios(timeout: int = 30) -> pd.DataFrame:
    resposta = requests.get(URL_MUNICIPIOS, timeout=timeout)
    resposta.raise_for_status()
    return pd.DataFrame(resposta.json())
