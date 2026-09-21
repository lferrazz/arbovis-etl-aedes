from __future__ import annotations

import json
from pathlib import Path

import requests

# O ducklake do pysus às vezes entrega, no lugar do parquet, um stub JSON de
# poucos bytes apontando para o objeto real no bucket ({"pysus-alias": "..."}).
# O pandas não segue esse ponteiro e quebra com "Parquet magic bytes not found".
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
    """Baixa o parquet real quando o cache do pysus guardou só um alias."""
    caminho = Path(caminho)
    alvo = _alvo_do_alias(caminho)
    if alvo is None:
        return caminho

    url = f"{URL_BUCKET}/{alvo.lstrip('/')}"
    print(f"    alias do pysus detectado; baixando {url}")
    resposta = requests.get(url, timeout=timeout)
    resposta.raise_for_status()

    # Regrava no próprio cache para as próximas execuções já acharem o arquivo.
    caminho.write_bytes(resposta.content)
    return caminho
