-- =====================================================================
-- Camada GOLD - Tabela Fato (BigQuery)
-- Grão: uma linha por NOTIFICAÇÃO individual (grão atômico),
-- conforme decisão de granularidade descrita na seção 2.5.1 do TCC.
--
-- Clusterizada por doença e município para otimizar as consultas do dashboard.
-- (No BigQuery Sandbox, sem billing, o particionamento via CTAS apresenta
--  comportamento inconsistente; por isso usamos apenas clustering.)
--
-- Observação: esta tabela é recriada pelo ETL a partir da Silver
-- (ver sql/30_gold_notificacoes.sql). O CREATE abaixo é documentação do esquema.
-- =====================================================================

CREATE TABLE IF NOT EXISTS `gold.fato_notificacao` (
    cod_ibge         INT64,
    cod_ibge_origem  STRING,  -- de onde veio o município: 'notificacao' | 'cnes' | 'sem_info'
    co_cnes          INT64,   -- unidade que atendeu/notificou (liga a dim_estabelecimento)
    id_doenca        INT64,
    dt_notificacao   DATE NOT NULL,
    dt_sintomas      DATE,
    ano              INT64,
    sexo             STRING,
    idade            INT64,
    classificacao    INT64,   -- CLASSI_FIN
    evolucao         INT64,   -- EVOLUCAO (1=cura, 2=óbito agravo, 3=óbito outras, 4=investig., 9=ign)
    obito            INT64,   -- flag 0/1: 1 = óbito pelo agravo (EVOLUCAO=2). SUM(obito)=nº mortes
    categoria_sintomas STRING, -- 'Sintomático' | 'Assintomático' | 'Sem informação'
    -- Sintomas (1 = sim, 2 = não, conforme SINAN)
    febre            INT64,
    mialgia          INT64,
    cefaleia         INT64,
    exantema         INT64,
    artralgia        INT64,
    dor_retro        INT64
)
CLUSTER BY id_doenca, cod_ibge;
