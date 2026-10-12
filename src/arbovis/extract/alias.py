from __future__ import annotations

import json
from pathlib import Path

import requests

URL_BUCKET = "https://nbg1.your-objectstorage.com/pysus"
TAMANHO_MAX_STUB = 4096


def _alvo_do_alias(caminho: Path) -> str | None:
    if caminho.stat().st_size > TAMANHO_MAX_STUB:
        return None
    try:
        conteudo = json.loads(caminho.read_bytes())
    except (ValueError, UnicodeDecodeError):
        return None
    if isinstance(conteudo, dict):
        return conteudo.get("pysus-alias")
    return None


def resolver_alias(caminho: Path, timeout: int = 120) -> Path:
    caminho = Path(caminho)
    alvo = _alvo_do_alias(caminho)
    if alvo is None:
        return caminho

    url = f"{URL_BUCKET}/{alvo.lstrip('/')}"
    print(f"    alias do pysus detectado; baixando {url}")
    resposta = requests.get(url, timeout=timeout)
    resposta.raise_for_status()

    caminho.write_bytes(resposta.content)
    return caminho
