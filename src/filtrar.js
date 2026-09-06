'use strict';

const fs = require('fs');

/**
 * Reduz o texto a letras e digitos minusculos sem acento.
 *
 * Os PDFs de certificado em lote sao gerados com kerning agressivo e o
 * extrator devolve o nome quebrado, como "Ma ria d a Sil va San tos".
 * Descartar espacos e acentos torna a busca imune a isso.
 */
function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Extrai o texto de cada pagina de um PDF.
 *
 * @returns {Promise<string[]>} texto por pagina, na ordem do documento
 */
async function textoPorPagina(caminho) {
  const { PDFParse } = await import('pdf-parse');
  const leitor = new PDFParse({ data: fs.readFileSync(caminho) });
  try {
    const resultado = await leitor.getText();
    return (resultado.pages ?? []).map((pagina) => pagina.text ?? '');
  } finally {
    await leitor.destroy();
  }
}

/**
 * Localiza as paginas de um PDF que mencionam o titular.
 *
 * Aceita varias grafias porque os emissores nao sao consistentes: o mesmo
 * aluno aparece com o nome completo em um certificado e com o nome curto
 * em outro.
 *
 * PDFs escaneados nao tem camada de texto e devolvem lista vazia — cabe a
 * quem chama decidir o que fazer nesse caso.
 *
 * @param {string} caminho
 * @param {string|string[]} nomes
 * @returns {Promise<number[]>} indices de pagina base zero
 */
async function paginasDoTitular(caminho, nomes) {
  const alvos = (Array.isArray(nomes) ? nomes : [nomes]).map(normalizar).filter(Boolean);
  const paginas = await textoPorPagina(caminho);

  return paginas
    .map((texto, indice) => {
      const normalizado = normalizar(texto);
      return alvos.some((alvo) => normalizado.includes(alvo)) ? indice : -1;
    })
    .filter((indice) => indice !== -1);
}

module.exports = { paginasDoTitular, textoPorPagina, normalizar };
