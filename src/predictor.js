'use strict';

/**
 * Desfaz o filtro PNG Predictor aplicado antes do Flate.
 *
 * PDFs geram imagens com /DecodeParms << /Predictor 15 ... >>, que aplica os
 * filtros de linha do PNG (None/Sub/Up/Average/Paeth) para melhorar a
 * compressao. Sem desfazer isso, os bytes inflados nao sao pixels.
 *
 * @param {Buffer} dados bytes ja inflados
 * @param {number} colunas largura em pixels
 * @param {number} canais componentes por pixel
 * @param {number} bits bits por componente
 * @returns {Buffer} pixels crus, sem os bytes de tipo de filtro
 */
function desfazerPredictorPng(dados, colunas, canais, bits) {
  const bytesPorPixel = Math.max(1, Math.ceil((canais * bits) / 8));
  const bytesPorLinha = Math.ceil((colunas * canais * bits) / 8);
  const linhas = Math.floor(dados.length / (bytesPorLinha + 1));

  const saida = Buffer.alloc(linhas * bytesPorLinha);
  let anterior = Buffer.alloc(bytesPorLinha);

  for (let linha = 0; linha < linhas; linha += 1) {
    const inicio = linha * (bytesPorLinha + 1);
    const tipo = dados[inicio];
    const atual = Buffer.from(dados.subarray(inicio + 1, inicio + 1 + bytesPorLinha));

    for (let i = 0; i < bytesPorLinha; i += 1) {
      const esquerda = i >= bytesPorPixel ? atual[i - bytesPorPixel] : 0;
      const acima = anterior[i];
      const diagonal = i >= bytesPorPixel ? anterior[i - bytesPorPixel] : 0;

      switch (tipo) {
        case 0:
          break;
        case 1:
          atual[i] = (atual[i] + esquerda) & 0xff;
          break;
        case 2:
          atual[i] = (atual[i] + acima) & 0xff;
          break;
        case 3:
          atual[i] = (atual[i] + ((esquerda + acima) >> 1)) & 0xff;
          break;
        case 4: {
          const p = esquerda + acima - diagonal;
          const pa = Math.abs(p - esquerda);
          const pb = Math.abs(p - acima);
          const pc = Math.abs(p - diagonal);
          const melhor = pa <= pb && pa <= pc ? esquerda : pb <= pc ? acima : diagonal;
          atual[i] = (atual[i] + melhor) & 0xff;
          break;
        }
        default:
          throw new Error(`tipo de filtro PNG desconhecido: ${tipo}`);
      }
    }

    atual.copy(saida, linha * bytesPorLinha);
    anterior = atual;
  }

  return saida;
}

module.exports = { desfazerPredictorPng };
