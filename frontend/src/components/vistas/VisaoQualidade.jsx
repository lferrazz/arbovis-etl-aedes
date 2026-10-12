import { AJUDA_PROVAVEIS, GraficoBarras, GraficoLinhas, Kpi, n, nd } from "../Graficos.jsx";

function pctDe(valor, total) {
  if (!valor || !total) return "0%";
  const p = valor / total * 100;
  return p < 0.1 ? "menos de 0,1%" : `${nd(p)}%`;
}

const CAMPOS = [
  {
    chave: "sem_sintomas", rotulo: "Sem sintoma registrado", icone: "sintomas", cor: "#8b5cf6",
    ajuda: "Nenhum dos seis sintomas (febre, dor muscular, dor de cabeça, manchas na pele, dor nas "
      + "articulações e dor atrás dos olhos) foi preenchido. Quase sempre é limitação da ficha, não "
      + "descuido: a de dengue de 2007 a 2014 e a de Zika não têm esses campos.",
  },
  {
    chave: "evolucao_ignorada", rotulo: "Evolução ignorada", icone: "obitos", cor: "#ef4444",
    ajuda: "Não se sabe como o caso terminou (cura, óbito ou outro), porque o campo está vazio, marcado "
      + "como ignorado ou com um código inválido. Esses casos nunca entram como óbito, então a "
      + "letalidade real pode ser um pouco maior que a mostrada.",
  },
  {
    chave: "classificacao_vazia", rotulo: "Sem classificação final", icone: "qualidade", cor: "#f59e0b",
    ajuda: "O caso não recebeu classificação final (confirmado, descartado ou inconclusivo), ou recebeu "
      + "um código que o SINAN não documenta. Geralmente é uma investigação que não foi encerrada.",
  },
  {
    chave: "unidade_vazia", rotulo: "Unidade (CNES) vazia", icone: "mapas", cor: "#0ea5e9",
    ajuda: "Não há o código da unidade de saúde que notificou. Esses casos ficam fora da análise "
      + "por unidade, por bairro e por tipo de estabelecimento.",
  },
  {
    chave: "sexo_ignorado", rotulo: "Sexo ignorado", icone: "demografia", cor: "#64748b",
    ajuda: "Sexo marcado como ignorado ou com valor que não é masculino nem feminino.",
  },
  {
    chave: "idade_vazia", rotulo: "Idade vazia", icone: "demografia", cor: "#64748b",
    ajuda: "Idade não informada, ou acima de 120 anos (tratada como erro de digitação). Esses casos "
      + "ficam fora da faixa etária e da idade média.",
  },
];

const SERIES_ANO = [
  { chave: "pct_aproveitaveis", nome: "Com data e município", cor: "#10b981" },
  { chave: "pct_com_classificacao", nome: "Com classificação final", cor: "#f59e0b" },
  { chave: "pct_com_sintomas", nome: "Com sintomas registrados", cor: "#8b5cf6" },
];

export default function VisaoQualidade({ qualidade }) {
  if (!qualidade || qualidade.carregando) {
    return <div className="card"><p className="dica">Carregando qualidade dos dados…</p></div>;
  }
  if (qualidade.erro) {
    return <div className="card"><p className="dica">Erro ao carregar: {qualidade.erro}</p></div>;
  }

  const q = qualidade;

  return (
    <>
      <div className="nota-ponte nota-intro">
        <b>O que esta aba mostra.</b> Os números das outras abas dependem de como as fichas foram
        preenchidas nos serviços de saúde e enviadas ao SINAN. Aqui aparece o retrato da base antes de
        qualquer filtro: quantas notificações chegaram, quantas foram descartadas e quais campos vieram
        em branco. Um campo vazio não apaga a notificação, mas limita o que dá para analisar com ela.
      </div>

      <div className="kpis kpis-4">
        <Kpi rotulo="Notificações recebidas" valor={q.total} icone="casos" cor="#0ea5e9"
             detalhe="tudo o que veio do SINAN"
             ajuda="Todas as notificações do recorte, inclusive as descartadas. Nenhuma linha é apagada pelo ETL: a contagem é igual à dos arquivos do DATASUS." />
        <Kpi rotulo="Casos prováveis" valor={q.provaveis} icone="curas" cor="#10b981"
             detalhe={`${pctDe(q.provaveis, q.total)} das notificações`}
             ajuda={`${AJUDA_PROVAVEIS} É o total usado em todas as outras abas.`} />
        <Kpi rotulo="Descartados" valor={q.descartados} icone="qualidade" cor="#f59e0b"
             detalhe={`${pctDe(q.descartados, q.total)} das notificações`}
             ajuda="Notificações que a investigação mostrou não serem a doença. Os arquivos de dengue publicados pelo DATASUS só trazem os descartados de 2000 a 2006 e de 2021; nos outros anos eles já vêm retirados." />
        <Kpi rotulo="Sem município de residência" valor={q.sem_residencia} icone="mapas" cor="#ef4444"
             detalhe={`${pctDe(q.sem_residencia, q.total)} das notificações`}
             ajuda="A ficha não informa a cidade onde a pessoa mora, ou informa um código que o IBGE não reconhece. Esses casos ficam fora da incidência, mas entram nos demais totais." />
      </div>

      <p className="nota-ponte">
        Só <b>{n(q.sem_municipio)}</b> notificações ficaram sem o município onde foram atendidas e{" "}
        <b>{n(q.sem_data)}</b> sem data de notificação.
        {q.municipio_via_cnes > 0 && (
          <> Em <b>{n(q.municipio_via_cnes)}</b> casos a ficha veio sem a cidade de atendimento e o ETL a
            recuperou pela unidade de saúde que notificou (CNES).</>
        )}
      </p>

      <h2 className="secao-titulo">Outros campos incompletos</h2>
      <p className="secao-sub">
        Cada cartão mostra quantas notificações vieram com o campo em branco. Passe o mouse sobre o cartão
        para ver o que isso afeta no painel.
      </p>
      <div className="kpis kpis-6 kpis-compactos">
        {CAMPOS.map((c) => (
          <Kpi key={c.chave} rotulo={c.rotulo} valor={q.campos[c.chave].faltando}
               detalhe={`${pctDe(q.campos[c.chave].faltando, q.total)} dos registros`} icone={c.icone} cor={c.cor}
               ajuda={c.ajuda} />
        ))}
      </div>

      <div className="grade2">
        <div className="card">
          <div className="card-topo"><h3>Completude por ano</h3></div>
          <p className="dica">
            Percentual das notificações de cada ano com data e município, com classificação final e com
            sintomas. Quedas bruscas costumam ser mudança na ficha do SINAN, como a falta dos campos de
            sintoma na dengue de 2007 a 2014 e na Zika.
          </p>
          <GraficoLinhas dados={q.por_ano} chaveX="ano" series={SERIES_ANO}
                         formatador={(v) => `${nd(v, 0)}%`} dominioY={[0, 100]} />
        </div>
        <div className="card">
          <div className="card-topo"><h3>Descartados por ano</h3></div>
          <p className="dica">
            Notificações descartadas em cada ano. Ano sem barra não quer dizer que nada foi descartado:
            nesses anos o arquivo do DATASUS já vem sem os descartados, e por isso o painel usa casos
            prováveis.
          </p>
          <GraficoBarras dados={q.por_ano} chaveX="ano" chaveY="descartados" cor="#f59e0b" nome="Descartados" />
        </div>
      </div>
    </>
  );
}
