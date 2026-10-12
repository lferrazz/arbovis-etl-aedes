# Definições dos indicadores do ArboVis

Fonte dos microdados: SINAN (DATASUS), arquivos `DENGBRaa`, `CHIKBRaa` e `ZIKABRaa` obtidos pelo
pysus 2.0. Unidade de registro: uma notificação. Ano: `NU_ANO` (ano de notificação, o mesmo usado
pelo TabNet). A data de extração de cada arquivo fica em `bronze.controle_carga`, porque o DATASUS
revisa a base retroativamente.

As definições estão implementadas em um único lugar: a tabela `gold.de_para_classificacao`
(`sql/15_gold_classificacao.sql`) e a função `sql_notificacoes` (`src/arbovis/definicoes.py`).

## Classificação do caso

A classificação final (`CLASSI_FIN`; `CON_CLASSI` na ficha antiga) é mapeada por doença e por versão
da ficha, identificada pelo ano do arquivo:

| Doença | Arquivos | Confirmado | Descartado | Inconclusivo | Fonte |
|---|---|---|---|---|---|
| Dengue | 2000–2006 | 1, 2, 3, 4 | 5 | 8 | Esquema antigo do MS (1 clássico, 2 com complicações, 3 FHD, 4 SCD, 5 descartado), aplicado ao `CON_CLASSI` do SINAN Windows |
| Dengue | 2007–2013 | 1, 2, 3, 4 (e 10, 11, 12 da transição) | 5 | 8 | Dicionário de dados SINAN Net v4.0 – Dengue |
| Dengue | 2014 em diante | 10, 11, 12 | 5 | 8 | Classificação da OMS adotada pelo MS em 2014 |
| Chikungunya | 2015 em diante | 13 | 5 | 8 | TabNet (coluna Classificação), conferido em 10/10/2026 |
| Zika | 2016 em diante | 1 | 2 (a confirmar) | 8 | Ficha de Notificação/Conclusão do SINAN Net |

Código em branco, `0` ou ausente da tabela = **sem classificação**.

## Indicadores

- **Caso provável**: toda notificação, exceto as descartadas. É a definição do Ministério da Saúde
  e a métrica principal do dashboard.
- **Confirmado**: classificação final de caso confirmado (tabela acima). O percentual de
  confirmados é calculado sobre os casos prováveis.
- **Óbito**: `EVOLUCAO = 2` (óbito pelo agravo notificado) **entre os casos confirmados**. O mesmo
  número aparece no card de óbitos, no desfecho e no numerador da letalidade.
- **Letalidade**: óbitos entre confirmados ÷ confirmados × 100.
- **Incidência**: o numerador são os casos **confirmados** (não os prováveis), contados pelo
  **município de residência** (`ID_MN_RESI`); o denominador é a população do Censo 2022; o resultado
  é multiplicado por 100 mil. Em períodos com mais de um ano, é a incidência média anual, dividida
  também pelo número de anos do período **em que a doença tem dado**: chikungunya a partir de 2015 e
  Zika a partir de 2016 (no período 2000–2025, 11 e 10 anos, e não 26). O consolidado das três doenças
  usa o período inteiro. Só é calculada para municípios com 100 mil habitantes ou
  mais. Municípios sem população no Censo 2022 aparecem como "sem população". O SINAN registra a
  residência no DF pelas regiões administrativas (códigos 5399xx), que o IBGE não tem; todas são
  atribuídas a Brasília.
- **Onde os casos foram atendidos**: contagem pelo município de notificação (`ID_MUNICIP`, com
  recuperação pelo CNES quando vem em branco). Não é usada para incidência.

## Limitações conhecidas

- **Dengue 2000–2006**: a ficha antiga tem só "2 = óbito", sem separar óbito pelo agravo de óbito
  por outras causas. Dos 3.050 óbitos desses arquivos, 1.722 estão em casos descartados. Por isso o
  óbito é contado só entre confirmados em toda a série.
- **Descartados na origem**: os arquivos atuais de dengue não trazem os descartados de 2007 a 2020
  nem de 2022 em diante; trazem só os de 2000–2006 e 2021. Chikungunya e Zika trazem em todos os
  anos. O total bruto de notificações, portanto, não é comparável entre anos; o de casos prováveis é.
- **Sintomas**: ausentes na dengue de 2007 a 2014 (a ficha não tinha os campos) e em toda a Zika.
  Na ficha antiga, o código 9 (ignorado) é tratado como sem informação.
- **Sem arquivo na fonte**: não há arquivo de chikungunya para 2014 nem de Zika antes de 2016 no
  catálogo do pysus; esses anos aparecem como ausentes, não como zero.
- **Chikungunya 2015–2016, códigos 1, 2 e 8**: o arquivo de definição (.def) do TabNet só rotula
  branco/0, 5 (Descartado) e 13 (Chikungunya), e omite as demais linhas quando a classificação é a
  variável tabulada. Evidência (arquivos 2016, 2023 e 2024, ano de notificação 2016, consulta de
  10/10/2026): tabulado por Evolução, o TabNet dá 310.746 casos; por Classificação, 174.320
  (40.836 Ign/Branco + 44.796 Descartado + 88.688 Chikungunya). A diferença de 136.426 é
  exatamente a soma dos códigos 1 (68.884), 2 (31.082), 8 (36.459) e 10 (1 registro) no
  `CHIKBR16`. No ArboVis, 1 e 2 ficam como sem classificação e 8 como inconclusivo, todos marcados
  "a confirmar" e mantidos entre os casos prováveis.
- **A confirmar**: Zika código 2 = descartado.
