from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

import pandas as pd
import pyarrow.parquet as pq

from arbovis.extract.alias import resolver_alias

GRUPOS_SINAN = {"dengue": "DENG", "zika": "ZIKA", "chikungunya": "CHIK"}

PASTA_CACHE = Path.home() / "pysus" / "downloads" / "ducklake" / "sinan"

FRACAO_MINIMA_VIZINHOS = 0.10
JANELA_VIZINHOS = 2


class ArquivoInvalido(RuntimeError):
    pass


def caminho_cache(doenca: str, ano: int) -> Path:
    grupo = GRUPOS_SINAN[doenca.lower()]
    return PASTA_CACHE / grupo / f"{grupo}BR{ano % 100:02d}.parquet"


def _linhas(caminho: Path) -> int | None:
    try:
        return pq.read_metadata(caminho).num_rows
    except Exception:
        return None


def validar_arquivo(caminho: Path, doenca: str, ano: int) -> int:
    linhas = _linhas(caminho)
    if not linhas:
        raise ArquivoInvalido(f"{caminho.name}: não abre como parquet ou está vazio")

    vizinhos = []
    for outro in range(ano - JANELA_VIZINHOS, ano + JANELA_VIZINHOS + 1):
        arq = caminho_cache(doenca, outro)
        if outro != ano and arq.exists():
            n = _linhas(arq)
            if n:
                vizinhos.append(n)
    if vizinhos:
        media = sum(vizinhos) / len(vizinhos)
        if linhas < FRACAO_MINIMA_VIZINHOS * media:
            raise ArquivoInvalido(
                f"{caminho.name}: {linhas:,} linhas, menos de "
                f"{FRACAO_MINIMA_VIZINHOS:.0%} da média dos vizinhos ({media:,.0f})"
            )
    return linhas

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
        ultimo_erro = (proc.stderr or proc.stdout or "").strip()[-300:]
        for linha in proc.stdout.splitlines():
            if linha.startswith("PYSUS_PATH::"):
                caminho = linha.split("PYSUS_PATH::", 1)[1].strip()
                if caminho == "NONE":
                    raise FileNotFoundError(f"{group}/{ano} não existe no catálogo do pysus.")
                if Path(caminho).exists():
                    caminho = resolver_alias(Path(caminho))
                    try:
                        linhas = validar_arquivo(caminho, doenca, ano)
                        print(f"    arquivo validado: {caminho.name} ({linhas:,} linhas)")
                        return caminho
                    except ArquivoInvalido as exc:
                        print(f"    ARQUIVO INVÁLIDO, apagado do cache: {exc}")
                        caminho.unlink(missing_ok=True)
                        ultimo_erro = str(exc)

        if t < tentativas:
            espera = 30 * (2 ** (t - 1))
            print(f"    tentativa {t}/{tentativas} falhou ({ultimo_erro.splitlines()[-1] if ultimo_erro else 'sem detalhe'})")
            print(f"    aguardando {espera}s...")
            time.sleep(espera)

    raise RuntimeError(f"Falha ao baixar {group}/{ano} após {tentativas} tentativas: {ultimo_erro}")


def obter_arquivo(doenca: str, ano: int, rebaixar: bool = False) -> tuple[Path, bool]:
    cache = caminho_cache(doenca, ano)
    if rebaixar:
        cache.unlink(missing_ok=True)
    elif cache.exists():
        try:
            linhas = validar_arquivo(resolver_alias(cache), doenca, ano)
            print(f"    usando cache: {cache.name} ({linhas:,} linhas)")
            return cache, False
        except ArquivoInvalido as exc:
            print(f"    cache inválido, apagado: {exc}")
            cache.unlink(missing_ok=True)
    return baixar_arbovirose_ano(doenca, ano), True


def iter_lotes(caminho: Path, colunas: list[str], tamanho_lote: int = 400_000):
    esquema = pq.read_schema(caminho)
    usar = [c for c in colunas if c in esquema.names]
    df = pd.read_parquet(caminho, columns=usar)
    for inicio in range(0, len(df), tamanho_lote):
        yield df.iloc[inicio : inicio + tamanho_lote]
