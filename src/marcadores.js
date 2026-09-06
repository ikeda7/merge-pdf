'use strict';

const { PDFName, PDFNumber, PDFHexString, PDFDict } = require('pdf-lib');

/**
 * Monta um dicionario PDF a partir de pares chave/valor e o registra no
 * contexto sob a referencia informada.
 */
function registrarDicionario(contexto, referencia, pares) {
  const mapa = new Map();
  for (const [chave, valor] of pares) {
    if (valor !== undefined) mapa.set(PDFName.of(chave), valor);
  }
  contexto.assign(referencia, PDFDict.fromMapWithContext(mapa, contexto));
}

/**
 * Encadeia uma lista de itens de marcador (Prev/Next) e devolve suas referencias.
 */
function encadear(contexto, itens, referenciaPai, paginas) {
  const referencias = itens.map(() => contexto.nextRef());

  itens.forEach((item, indice) => {
    const filhos = item.filhos ?? [];
    const referenciasFilhos = filhos.length
      ? encadear(contexto, filhos, referencias[indice], paginas)
      : [];

    registrarDicionario(contexto, referencias[indice], [
      ['Title', PDFHexString.fromText(item.titulo)],
      ['Parent', referenciaPai],
      ['Dest', contexto.obj([paginas[item.pagina].ref, PDFName.of('Fit')])],
      ['Prev', indice > 0 ? referencias[indice - 1] : undefined],
      ['Next', indice < itens.length - 1 ? referencias[indice + 1] : undefined],
      ['First', referenciasFilhos[0]],
      ['Last', referenciasFilhos[referenciasFilhos.length - 1]],
      // Contagem negativa mantem o no fechado ao abrir o documento.
      ['Count', filhos.length ? PDFNumber.of(-filhos.length) : undefined],
    ]);
  });

  return referencias;
}

/**
 * Adiciona uma arvore de marcadores (bookmarks) ao documento.
 *
 * @param {import('pdf-lib').PDFDocument} documento
 * @param {Array<{titulo: string, pagina: number, filhos?: Array}>} arvore
 */
function adicionarMarcadores(documento, arvore) {
  if (arvore.length === 0) return;

  const contexto = documento.context;
  const paginas = documento.getPages();
  const referenciaRaiz = contexto.nextRef();
  const referencias = encadear(contexto, arvore, referenciaRaiz, paginas);

  registrarDicionario(contexto, referenciaRaiz, [
    ['Type', PDFName.of('Outlines')],
    ['First', referencias[0]],
    ['Last', referencias[referencias.length - 1]],
    ['Count', PDFNumber.of(arvore.length)],
  ]);

  documento.catalog.set(PDFName.of('Outlines'), referenciaRaiz);
  documento.catalog.set(PDFName.of('PageMode'), PDFName.of('UseOutlines'));
}

module.exports = { adicionarMarcadores };
