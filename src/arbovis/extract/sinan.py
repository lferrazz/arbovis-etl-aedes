from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

GRUPOS_SINAN = {"dengue": "DENG", "zika": "ZIKA", "chikungunya": "CHIK"}

_SCRIPT_DOWNLOAD = (
    "import sys, asyncio\n"
    "from pysus.api import PySUSClient\n"
    "async def go(group, ano):\n"
    "    c = PySUSClient()\n"
    "    arqs = await c.query(dataset='SINAN', group=group, year=ano)\n"
    "    if not arqs:\n"
    "        print('PYSUS_PATH::NONE'); return\n"
    "    local = await c.download(arqs[0])\n"
    "    print('PYSUS_PATH::' + str(local.path))\n"
    "asyncio.run(go(sys.argv[1], int(sys.argv[2])))\n"
)


def baixar_arbovirose_ano(doenca: str, ano: int, tentativas: int = 5) -> Path:
    doenca = doenca.lower()
    if doenca not in GRUPOS_SINAN:
        raise ValueError(f"Doença inválida: {doenca!r}. Use {list(GRUPOS_SINAN)}.")
    group = GRUPOS_SINAN[doenca]

    ultimo_erro = ""
    for t in range(1, tentativas + 1):
        proc = subprocess.run(
            [sys.executable, "-c", _SCRIPT_DOWNLOAD, group, str(ano)],
            capture_output=True, text=True,
        )
        for linha in proc.stdout.splitlines():
            if linha.startswith("PYSUS_PATH::"):
                caminho = linha.split("PYSUS_PATH::", 1)[1].strip()
                if caminho != "NONE" and Path(caminho).exists():
                    return Path(caminho)

        ultimo_erro = (proc.stderr or proc.stdout or "").strip()[-300:]
        if t < tentativas:
            espera = 30 * (2 ** (t - 1))
            print(f"    tentativa {t}/{tentativas} falhou; aguardando {espera}s...")
            time.sleep(espera)

    raise RuntimeError(f"Falha ao baixar {group}/{ano} após {tentativas} tentativas: {ultimo_erro}")


def iter_lotes(caminho: Path, colunas: list[str], tamanho_lote: int = 400_000):
    esquema = pq.read_schema(caminho)
    usar = [c for c in colunas if c in esquema.names]
    df = pd.read_parquet(caminho, columns=usar)
    for inicio in range(0, len(df), tamanho_lote):
        yield df.iloc[inicio : inicio + tamanho_lote]
