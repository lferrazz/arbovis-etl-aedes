"""ArboVis - Pipeline ETL para vigilância de arboviroses (Dengue, Zika, Chikungunya).

Pacote organizado nas três etapas do processo ETL:
    - extract:   coleta de dados das fontes (IBGE, DATASUS/SINAN, CNES)
    - transform: limpeza, padronização e tratamento de inconsistências
    - load:      persistência no Data Warehouse PostgreSQL
"""

__version__ = "0.1.0"
