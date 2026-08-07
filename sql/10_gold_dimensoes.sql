-- =====================================================================
-- Camada GOLD - Dimensões (BigQuery)
--
-- Observações:
--  * PRIMARY/FOREIGN KEY no BigQuery são apenas informativas (NOT ENFORCED);
--    a integridade referencial é garantida no ETL (Python).
--  * As dimensões deste projeto são carregadas via *load job* (pandas):
--      - gold.dim_municipio -> scripts/run_municipios.py
--      - gold.dim_doenca    -> scripts/setup_dw.py
--    (No BigQuery Sandbox não há billing, e DML como INSERT/MERGE é bloqueado.)
--  * Os CREATE TABLE abaixo servem como documentação do esquema esperado.
--    Não são obrigatórios: a carga do pandas cria as tabelas automaticamente.
-- =====================================================================

-- Dimensão Município (origem: API de Localidades do IBGE).
-- cod_ibge   : código oficial de 7 dígitos.
-- cod_ibge_6 : código de 6 dígitos (sem dígito verificador) usado pelo SINAN.
CREATE TABLE IF NOT EXISTS `gold.dim_municipio` (
    cod_ibge        INT64 NOT NULL,
    cod_ibge_6      INT64 NOT NULL,
    nome_municipio  STRING NOT NULL,
    uf              STRING,
    estado          STRING,
    regiao          STRING,
    PRIMARY KEY (cod_ibge) NOT ENFORCED
);

-- Dimensão Doença (Dengue, Zika, Chikungunya).
CREATE TABLE IF NOT EXISTS `gold.dim_doenca` (
    id_doenca     INT64 NOT NULL,
    nome          STRING NOT NULL,
    cid10         STRING,
    grupo_sinan   STRING,
    PRIMARY KEY (id_doenca) NOT ENFORCED
);

-- Dimensão Estabelecimento de Saúde (origem: CNES/ST do DATASUS).
-- co_cnes    : código CNES de 7 dígitos.
-- cod_ibge_6 : município (6 dígitos) — liga a gold.dim_municipio.cod_ibge_6.
-- Relaciona-se com dim_municipio por cod_ibge_6 (não é FK formal porque
-- cod_ibge_6 não é a chave primária de dim_municipio).
CREATE TABLE IF NOT EXISTS `gold.dim_estabelecimento` (
    co_cnes               INT64 NOT NULL,
    cod_ibge_6            INT64,
    tp_unid               INT64,
    tipo_estabelecimento  STRING,
    vinculo_sus           BOOL,
    PRIMARY KEY (co_cnes) NOT ENFORCED
);
