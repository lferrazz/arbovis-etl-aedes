from __future__ import annotations

import ftplib
import os
import zipfile
from pathlib import Path

import pandas as pd

from arbovis.config import RAW_DIR

FTP_HOST = "ftp.datasus.gov.br"
FTP_DIR = "/cnes"

COLUNAS = {
    "CO_CNES": "co_cnes",
    "NO_FANTASIA": "nome",
    "NO_LOGRADOURO": "logradouro",
    "NU_ENDERECO": "numero",
    "NO_BAIRRO": "bairro",
    "CO_CEP": "cep",
}


def _caminho_zip(ano: int, mes: int) -> Path:
    pasta = RAW_DIR / "cnes_base"
    pasta.mkdir(parents=True, exist_ok=True)
    return pasta / f"BASE_DE_DADOS_CNES_{ano}{mes:02d}.ZIP"


def baixar_base(ano: int, mes: int) -> Path:
    destino = _caminho_zip(ano, mes)
    if destino.exists() and destino.stat().st_size > 0:
        return destino

    arquivo = destino.name
    ftp = ftplib.FTP(FTP_HOST, timeout=120)
    ftp.login()
    ftp.cwd(FTP_DIR)
    with open(destino, "wb") as f:
        ftp.retrbinary(f"RETR {arquivo}", f.write, blocksize=1024 * 256)
    ftp.quit()
    return destino


def _achar_csv(zf: zipfile.ZipFile) -> str:
    for nome in zf.namelist():
        base = nome.split("/")[-1].lower()
        if base.startswith("tbestabelecimento"):
            return nome
    raise FileNotFoundError("tbEstabelecimento não encontrado dentro do ZIP.")


def extrair_enderecos_cnes(ano: int = 2024, mes: int = 12) -> pd.DataFrame:
    zip_path = baixar_base(ano, mes)
    with zipfile.ZipFile(zip_path) as zf:
        nome_csv = _achar_csv(zf)
        with zf.open(nome_csv) as fh:
            df = pd.read_csv(
                fh,
                sep=";",
                encoding="latin-1",
                dtype=str,
                usecols=lambda c: c in COLUNAS,
            )
    return df.rename(columns=COLUNAS)
