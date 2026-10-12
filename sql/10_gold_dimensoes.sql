CREATE TABLE IF NOT EXISTS `gold.dim_municipio` (
    cod_ibge        INT64 NOT NULL,
    cod_ibge_6      INT64 NOT NULL,
    nome_municipio  STRING NOT NULL,
    uf              STRING,
    estado          STRING,
    regiao          STRING,
    mesorregiao     STRING,
    populacao       INT64,
    PRIMARY KEY (cod_ibge) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `gold.dim_doenca` (
    id_doenca     INT64 NOT NULL,
    nome          STRING NOT NULL,
    cid10         STRING,
    grupo_sinan   STRING,
    PRIMARY KEY (id_doenca) NOT ENFORCED
);

CREATE TABLE IF NOT EXISTS `gold.dim_estabelecimento` (
    co_cnes               INT64 NOT NULL,
    cod_ibge_6            INT64,
    tp_unid               INT64,
    tipo_estabelecimento  STRING,
    vinculo_sus           BOOL,
    PRIMARY KEY (co_cnes) NOT ENFORCED
);
