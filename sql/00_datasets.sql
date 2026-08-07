-- =====================================================================
-- ArboVis - Data Warehouse no Google BigQuery
-- Criação das camadas (datasets) Bronze / Silver / Gold.
-- Execute no projeto GCP definido em GCP_PROJECT_ID.
-- Ajuste a location conforme BQ_LOCATION do seu .env.
-- =====================================================================

-- Bronze: dados exatamente como chegaram do ETL (histórico bruto).
CREATE SCHEMA IF NOT EXISTS `bronze`
    OPTIONS (location = 'southamerica-east1');

-- Silver: dados limpos, padronizados e prontos para análises gerais.
CREATE SCHEMA IF NOT EXISTS `silver`
    OPTIONS (location = 'southamerica-east1');

-- Gold: estruturas analíticas (fato e dimensão) para o dashboard.
CREATE SCHEMA IF NOT EXISTS `gold`
    OPTIONS (location = 'southamerica-east1');
