DROP TABLE IF EXISTS `gold.fato_notificacao_nova`;
CREATE TABLE `gold.fato_notificacao_nova`
CLUSTER BY id_doenca, cod_ibge AS
SELECT
    COALESCE(dim.cod_ibge, dim_cnes.cod_ibge) AS cod_ibge,
    CASE
        WHEN dim.cod_ibge IS NOT NULL THEN 'notificacao'
        WHEN dim_cnes.cod_ibge IS NOT NULL THEN 'cnes'
        ELSE 'sem_info'
    END AS cod_ibge_origem,
    res.cod_ibge           AS cod_ibge_resi,
    n.co_cnes              AS co_cnes,
    n.id_doenca            AS id_doenca,
    DATE(n.dt_notificacao) AS dt_notificacao,
    DATE(n.dt_sintomas)    AS dt_sintomas,
    n.ano                  AS ano,
    n.ano_arquivo          AS ano_arquivo,
    n.sexo                 AS sexo,
    n.idade                AS idade,
    n.classificacao        AS classificacao,
    n.evolucao             AS evolucao,
    CASE WHEN n.evolucao = 2 THEN 1 ELSE 0 END AS obito,
    CASE
        WHEN COALESCE(n.febre, n.mialgia, n.cefaleia,
                      n.exantema, n.artralgia, n.dor_retro) IS NULL
            THEN 'Sem informação'
        WHEN 1 IN (n.febre, n.mialgia, n.cefaleia,
                   n.exantema, n.artralgia, n.dor_retro)
            THEN 'Sintomático'
        ELSE 'Assintomático'
    END AS categoria_sintomas,
    n.febre, n.mialgia, n.cefaleia, n.exantema, n.artralgia, n.dor_retro
FROM `silver.notificacoes` AS n
LEFT JOIN `gold.dim_municipio` AS dim
    ON n.cod_ibge_6 = dim.cod_ibge_6
LEFT JOIN `gold.dim_estabelecimento` AS est
    ON n.co_cnes = est.co_cnes
LEFT JOIN `gold.dim_municipio` AS dim_cnes
    ON est.cod_ibge_6 = dim_cnes.cod_ibge_6
LEFT JOIN `gold.dim_municipio` AS res
    ON IF(DIV(n.cod_ibge_resi_6, 100) = 5399, 530010, n.cod_ibge_resi_6) = res.cod_ibge_6;
