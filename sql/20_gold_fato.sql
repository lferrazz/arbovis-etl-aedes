CREATE TABLE IF NOT EXISTS `gold.fato_notificacao` (
    cod_ibge         INT64,
    cod_ibge_origem  STRING,
    cod_ibge_resi    INT64,
    co_cnes          INT64,
    id_doenca        INT64,
    dt_notificacao   DATE,
    dt_sintomas      DATE,
    ano              INT64,
    ano_arquivo      INT64,
    sexo             STRING,
    idade            INT64,
    classificacao    INT64,
    evolucao         INT64,
    obito            INT64,
    categoria_sintomas STRING,

    febre            INT64,
    mialgia          INT64,
    cefaleia         INT64,
    exantema         INT64,
    artralgia        INT64,
    dor_retro        INT64
)
CLUSTER BY id_doenca, cod_ibge;
