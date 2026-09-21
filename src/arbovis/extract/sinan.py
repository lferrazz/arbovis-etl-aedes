from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from arbovis.extract.alias import resolver_alias

GRUPOS_SINAN = {"dengue": "DENG", "zika": "ZIKA", "chikungunya": "CHIK"}

# O catálogo lista o mesmo ano em dois caminhos: 'ftp' e 'dadosgov'. Desde a
# reorganização do bucket (ago/2026) o 'dadosgov' responde 403, então tenta-se
# primeiro o 'ftp' e só depois os demais.
_SCRIPT_DOWNLOAD = (
    "import sys, asyncio\n"
    "from pysus.api import PySUSClient\n"
    "def ordem(a):\n"
    "    return 0 if 'ftp' in str(a.path).replace('\\\\', '/').split('/') else 1\n"
    "async def go(group, ano):\n"
    "    c = PySUSClient()\n"
    "    arqs = await c.query(dataset='SINAN', group=group, year=ano)\n"
    "    if not arqs:\n"
    "        print('PYSUS_PATH::NONE'); return\n"
    "    erros = []\n"
    "    for arq in sorted(arqs, key=ordem):\n"
    "        try:\n"
    "            local = await c.download(arq)\n"
    "        except Exception as exc:\n"
    "            erros.append(f'{arq.path}: {exc}')\n"
    "            continue\n"
    "        print('PYSUS_PATH::' + str(local.path)); return\n"
    "    raise RuntimeError('nenhum arquivo baixou: ' + ' | '.join(erros))\n"
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
                    return resolver_alias(Path(caminho))

        ultimo_erro = (proc.stderr or proc.stdout or "").strip()[-300:]
        if t < tentativas:
            espera = 30 * (2 ** (t - 1))
            print(f"    tentativa {t}/{tentativas} falhou ({ultimo_erro.splitlines()[-1] if ultimo_erro else 'sem detalhe'})")
            print(f"    aguardando {espera}s...")
            time.sleep(espera)

    raise RuntimeError(f"Falha ao baixar {group}/{ano} após {tentativas} tentativas: {ultimo_erro}")


def iter_lotes(caminho: Path, colunas: list[str], tamanho_lote: int = 400_000):
    esquema = pq.read_schema(caminho)
    usar = [c for c in colunas if c in esquema.names]
    df = pd.read_parquet(caminho, columns=usar)
    for inicio in range(0, len(df), tamanho_lote):
        yield df.iloc[inicio : inicio + tamanho_lote]
