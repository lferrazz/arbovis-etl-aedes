CREATE OR REPLACE TABLE `gold.fato_notificacao`
CLUSTER BY id_doenca, cod_ibge AS
SELECT * FROM `gold.fato_notificacao_nova`;
