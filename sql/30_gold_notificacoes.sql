-- =====================================================================
-- Camada GOLD - Construção da fato a partir da Silver
--
-- Star schema (Kimball): uma linha por notificação, com os sintomas como
-- colunas 0/1 na própria fato (desnormalizado, de propósito — é o padrão
-- para Data Warehouse/dashboard). Junta silver + dim_municipio por cod_ibge_6.
--
-- obito = 1 quando EVOLUCAO = 2 (óbito pelo agravo notificado, ou seja, morte
-- causada pela própria arbovirose). SUM(obito) = número de mortes.
--
-- Município: usa o cod_ibge da notificação (ID_MUNICIP do SINAN). Quando esse
-- vem em branco/inválido, recupera o município a partir do estabelecimento que
-- notificou (co_cnes -> dim_estabelecimento -> dim_municipio). A coluna
-- cod_ibge_origem registra de onde veio: 'notificacao', 'cnes' ou 'sem_info'.
-- =====================================================================

DROP TABLE IF EXISTS `gold.fato_notificacao`;
CREATE OR REPLACE TABLE `gold.fato_notificacao`
CLUSTER BY id_doenca, cod_ibge AS
SELECT
    COALESCE(dim.cod_ibge, dim_cnes.cod_ibge) AS cod_ibge,
    CASE
        WHEN dim.cod_ibge IS NOT NULL THEN 'notificacao'
        WHEN dim_cnes.cod_ibge IS NOT NULL THEN 'cnes'
        ELSE 'sem_info'
    END AS cod_ibge_origem,
    n.co_cnes              AS co_cnes,
    n.id_doenca            AS id_doenca,
    DATE(n.dt_notificacao) AS dt_notificacao,
    DATE(n.dt_sintomas)    AS dt_sintomas,
    n.ano                  AS ano,
    n.sexo                 AS sexo,
    n.idade                AS idade,
    n.classificacao        AS classificacao,
    n.evolucao             AS evolucao,
    CASE WHEN n.evolucao = 2 THEN 1 ELSE 0 END AS obito,
    -- Categoriza a pessoa quanto aos sintomas (separa "sem dado" de "sem sintoma").
    CASE
        WHEN COALESCE(n.febre, n.mialgia, n.cefaleia,
                      n.exantema, n.artralgia, n.dor_retro) IS NULL
            THEN 'Sem informação'
        WHEN 1 IN (n.febre, n.mialgia, n.cefaleia,
                   n.exantema, n.artralgia, n.dor_retro)
            THEN 'Sintomático'
        ELSE 'Assintomático'
    END AS categoria_sintomas,
    -- Sintomas como flags (1 = teve, 2 = não teve, conforme SINAN; nulo = ignorado)
    n.febre, n.mialgia, n.cefaleia, n.exantema, n.artralgia, n.dor_retro
FROM `silver.notificacoes` AS n
LEFT JOIN `gold.dim_municipio` AS dim
    ON n.cod_ibge_6 = dim.cod_ibge_6
-- Fallback do município: estabelecimento notificador (CNES) -> município.
LEFT JOIN `gold.dim_estabelecimento` AS est
    ON n.co_cnes = est.co_cnes
LEFT JOIN `gold.dim_municipio` AS dim_cnes
    ON est.cod_ibge_6 = dim_cnes.cod_ibge_6;
