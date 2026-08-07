from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from google.cloud import bigquery

ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"

load_dotenv(ROOT_DIR / ".env")

DATASET_BRONZE = "bronze"
DATASET_SILVER = "silver"
DATASET_GOLD = "gold"


def _env(chave: str, padrao: str | None = None) -> str:
    valor = os.getenv(chave, padrao)
    if valor is None:
        raise RuntimeError(
            f"Variável de ambiente '{chave}' não definida. "
            f"Copie .env.example para .env e preencha os valores."
        )
    return valor


PROJECT_ID = _env("GCP_PROJECT_ID")
LOCATION = _env("BQ_LOCATION", "southamerica-east1")
API_KEY = os.getenv("API_KEY")


def _resolver_credenciais() -> None:
    cred = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if not cred:
        return

    caminho = Path(cred)
    if not caminho.is_absolute():
        caminho = (ROOT_DIR / caminho).resolve()

    if caminho.exists():
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(caminho)
    else:
        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)


def get_bq_client() -> bigquery.Client:
    import warnings

    import google.auth

    _resolver_credenciais()
    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", message=".*quota project.*")
        credenciais, _ = google.auth.default(
            scopes=["https://www.googleapis.com/auth/cloud-platform"]
        )
    if hasattr(credenciais, "with_quota_project"):
        credenciais = credenciais.with_quota_project(PROJECT_ID)

    return bigquery.Client(
        project=PROJECT_ID, credentials=credenciais, location=LOCATION
    )


def dataset_ref(dataset: str) -> str:
    return f"{PROJECT_ID}.{dataset}"


def tabela_ref(dataset: str, tabela: str) -> str:
    return f"{PROJECT_ID}.{dataset}.{tabela}"
