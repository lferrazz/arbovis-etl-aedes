from __future__ import annotations

import hmac

from fastapi import HTTPException, Security, status
from fastapi.security import APIKeyHeader

from arbovis.config import API_KEY

_cabecalho = APIKeyHeader(name="X-API-Key", auto_error=False)


def verificar_chave(chave: str | None = Security(_cabecalho)) -> None:
    if not API_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="API_KEY não configurada no servidor.",
        )
    if not chave or not hmac.compare_digest(chave, API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chave de API ausente ou inválida (header X-API-Key).",
        )
