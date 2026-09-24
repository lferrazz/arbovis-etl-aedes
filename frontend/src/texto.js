// Busca sem acento e sem maiúscula: "chapeu" precisa achar "Chapéu",
// "jatai" precisa achar "Jataí". Usada na lista de cidades e na busca da comparação.
export const normalizar = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
