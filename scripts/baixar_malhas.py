from __future__ import annotations

import json
import time
from pathlib import Path

import requests

BASE = "https://servicodados.ibge.gov.br/api"
GEO = "?formato=application/vnd.geo+json&qualidade=intermediaria"
DESTINO = Path(__file__).resolve().parents[1] / "frontend" / "public" / "malhas"

COD_UF = (
    "11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53"
).split()


def _baixar(url: str, destino: Path, tentativas: int = 4) -> None:
    for tentativa in range(1, tentativas + 1):
        try:
            resposta = requests.get(url, timeout=60)
            resposta.raise_for_status()
            dados = resposta.json()
            break
        except (requests.RequestException, ValueError):
            if tentativa == tentativas:
                raise
            time.sleep(5 * tentativa)
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{destino.relative_to(DESTINO)}: {destino.stat().st_size / 1024:,.0f} KB")


def main() -> None:
    _baixar(f"{BASE}/v3/malhas/paises/BR{GEO}&intrarregiao=mesorregiao", DESTINO / "br-meso.json")
    _baixar(f"{BASE}/v1/localidades/mesorregioes", DESTINO / "mesorregioes.json")
    for cod in COD_UF:
        _baixar(f"{BASE}/v3/malhas/estados/{cod}{GEO}&intrarregiao=mesorregiao", DESTINO / "uf" / f"{cod}-meso.json")
        _baixar(f"{BASE}/v3/malhas/estados/{cod}{GEO}&intrarregiao=municipio", DESTINO / "uf" / f"{cod}-mun.json")

    total = sum(p.stat().st_size for p in DESTINO.rglob("*.json"))
    print(f"Total: {total / 1024 / 1024:,.1f} MB em {DESTINO}")


if __name__ == "__main__":
    main()
