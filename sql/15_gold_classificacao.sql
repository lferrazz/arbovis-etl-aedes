CREATE OR REPLACE TABLE `gold.de_para_classificacao` AS
SELECT * FROM UNNEST([
    STRUCT(1 AS id_doenca, 2000 AS ano_ini, 2006 AS ano_fim, 1 AS codigo,
           'Dengue clássico' AS rotulo, 'confirmado' AS categoria,
           'SINAN Windows (CON_CLASSI); esquema antigo do MS' AS fonte, FALSE AS a_confirmar),
    (1, 2000, 2006, 2, 'Dengue com complicações', 'confirmado', 'SINAN Windows (CON_CLASSI); esquema antigo do MS', FALSE),
    (1, 2000, 2006, 3, 'Febre hemorrágica da dengue', 'confirmado', 'SINAN Windows (CON_CLASSI); esquema antigo do MS', FALSE),
    (1, 2000, 2006, 4, 'Síndrome do choque da dengue', 'confirmado', 'SINAN Windows (CON_CLASSI); esquema antigo do MS', FALSE),
    (1, 2000, 2006, 5, 'Descartado', 'descartado', 'SINAN Windows (CON_CLASSI); esquema antigo do MS', FALSE),
    (1, 2000, 2006, 8, 'Inconclusivo', 'inconclusivo', 'SINAN Windows (CON_CLASSI); esquema antigo do MS', FALSE),

    (1, 2007, 2013, 1, 'Dengue clássico', 'confirmado', 'Dicionário SINAN Net v4.0 - Dengue', FALSE),
    (1, 2007, 2013, 2, 'Dengue com complicações', 'confirmado', 'Dicionário SINAN Net v4.0 - Dengue', FALSE),
    (1, 2007, 2013, 3, 'Febre hemorrágica da dengue', 'confirmado', 'Dicionário SINAN Net v4.0 - Dengue', FALSE),
    (1, 2007, 2013, 4, 'Síndrome do choque da dengue', 'confirmado', 'Dicionário SINAN Net v4.0 - Dengue', FALSE),
    (1, 2007, 2013, 5, 'Descartado', 'descartado', 'Dicionário SINAN Net v4.0 - Dengue', FALSE),
    (1, 2007, 2013, 8, 'Inconclusivo', 'inconclusivo', 'Presente nos dados; não consta no dicionário v4.0', FALSE),
    (1, 2007, 2013, 10, 'Dengue', 'confirmado', 'Classificação OMS (MS, 2014), já em uso na transição', FALSE),
    (1, 2007, 2013, 11, 'Dengue com sinais de alarme', 'confirmado', 'Classificação OMS (MS, 2014), já em uso na transição', FALSE),
    (1, 2007, 2013, 12, 'Dengue grave', 'confirmado', 'Classificação OMS (MS, 2014), já em uso na transição', FALSE),

    (1, 2014, 2099, 5, 'Descartado', 'descartado', 'Classificação OMS (MS, 2014)', FALSE),
    (1, 2014, 2099, 8, 'Inconclusivo', 'inconclusivo', 'Classificação OMS (MS, 2014)', FALSE),
    (1, 2014, 2099, 10, 'Dengue', 'confirmado', 'Classificação OMS (MS, 2014)', FALSE),
    (1, 2014, 2099, 11, 'Dengue com sinais de alarme', 'confirmado', 'Classificação OMS (MS, 2014)', FALSE),
    (1, 2014, 2099, 12, 'Dengue grave', 'confirmado', 'Classificação OMS (MS, 2014)', FALSE),

    (2, 2016, 2099, 1, 'Confirmado', 'confirmado', 'Ficha de Notificação/Conclusão SINAN Net', FALSE),
    (2, 2016, 2099, 2, 'Descartado', 'descartado', 'Ficha de Notificação/Conclusão SINAN Net', TRUE),
    (2, 2016, 2099, 8, 'Inconclusivo', 'inconclusivo', 'Presente nos dados; não consta na ficha', FALSE),

    (3, 2015, 2099, 13, 'Chikungunya', 'confirmado', 'TabNet Chikungunya (Classificação), conferido em 10/10/2026', FALSE),
    (3, 2015, 2099, 5, 'Descartado', 'descartado', 'TabNet Chikungunya (Classificação), conferido em 10/10/2026', FALSE),
    (3, 2015, 2099, 8, 'Inconclusivo', 'inconclusivo', 'Presente só em 2015–2016; o .def do TabNet não rotula', TRUE),
    (3, 2015, 2016, 1, 'Código da ficha de 2015–2016 (a confirmar)', 'sem_classificacao', 'O .def do TabNet não rotula (ver docs/definicoes.md)', TRUE),
    (3, 2015, 2016, 2, 'Código da ficha de 2015–2016 (a confirmar)', 'sem_classificacao', 'O .def do TabNet não rotula (ver docs/definicoes.md)', TRUE)
]);
