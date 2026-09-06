'use strict';

// A4 retrato, em pontos PostScript.
const LARGURA_A4 = 595.28;
const ALTURA_A4 = 841.89;

/** Abaixo disso a diferenca de escala e ruido de arredondamento. */
const TOLERANCIA_ESCALA = 0.001;

/**
 * Reescreve todas as paginas do documento em A4, no lugar.
 *
 * O acervo mistura Letter, A3 e tamanhos avulsos, o que faz o leitor de PDF
 * reajustar o zoom a cada pagina. Cada pagina vira A4 na *sua propria*
 * orientacao — paisagem continua paisagem — com o conteudo escalado
 * proporcionalmente e centralizado. Nada e rotacionado nem cortado.
 *
 * IMPORTANTE: a operacao e feita no proprio documento, via `scale` +
 * `setMediaBox`, e nao reconstruindo o PDF com `embedPages`. `embedPages`
 * converte a pagina em XObject e **descarta as anotacoes** — que e onde vivem
 * os selos visuais de assinatura digital (gov.br e afins). Costumam depender
 * disso os termos, atestados e declaracoes assinados via
 * gov.br ou ICP-Brasil.
 *
 * `page.scale` reposiciona conteudo e anotacoes juntos; o deslocamento de
 * centralizacao vai na origem do MediaBox, para nao mover nada de novo.
 *
 * @param {import('pdf-lib').PDFDocument} documento
 * @returns {import('pdf-lib').PDFDocument} o mesmo documento, normalizado
 */
function normalizarParaA4(documento) {
  for (const pagina of documento.getPages()) {
    const caixa = pagina.getMediaBox();
    const paisagem = caixa.width > caixa.height;

    const larguraAlvo = paisagem ? ALTURA_A4 : LARGURA_A4;
    const alturaAlvo = paisagem ? LARGURA_A4 : ALTURA_A4;

    const escala = Math.min(larguraAlvo / caixa.width, alturaAlvo / caixa.height);
    if (Math.abs(escala - 1) > TOLERANCIA_ESCALA) {
      pagina.scale(escala, escala);
    }

    // Centraliza deslocando a janela de visualizacao, nao o conteudo.
    const origemX = caixa.x * escala - (larguraAlvo - caixa.width * escala) / 2;
    const origemY = caixa.y * escala - (alturaAlvo - caixa.height * escala) / 2;

    pagina.setMediaBox(origemX, origemY, larguraAlvo, alturaAlvo);
    pagina.setCropBox(origemX, origemY, larguraAlvo, alturaAlvo);
  }

  return documento;
}

module.exports = { normalizarParaA4, LARGURA_A4, ALTURA_A4 };
