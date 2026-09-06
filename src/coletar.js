'use strict';

const fs = require('fs');
const path = require('path');

const EXTENSOES_PDF = new Set(['.pdf']);
const EXTENSOES_IMAGEM = new Set(['.jpg', '.jpeg', '.png']);

/**
 * Extrai o prefixo numerico de um nome no padrao "<n> - <descricao>".
 * Sem prefixo, devolve Infinity para que o item caia no fim da ordenacao.
 */
function prefixoNumerico(nome) {
  const casamento = /^(\d+)\s*-\s*/.exec(nome);
  return casamento ? Number.parseInt(casamento[1], 10) : Number.POSITIVE_INFINITY;
}

/**
 * Ordena pelo prefixo numerico e, em empate, pelo nome em ordem alfabetica
 * sensivel a acentuacao (pt-BR).
 */
function ordenarPorPrefixo(nomes) {
  return [...nomes].sort((a, b) => {
    const diferenca = prefixoNumerico(a) - prefixoNumerico(b);
    if (diferenca !== 0) return diferenca;
    return a.localeCompare(b, 'pt-BR');
  });
}

function ehSuportado(nomeArquivo) {
  const extensao = path.extname(nomeArquivo).toLowerCase();
  return EXTENSOES_PDF.has(extensao) || EXTENSOES_IMAGEM.has(extensao);
}

/**
 * Remove o prefixo numerico e a extensao para gerar o titulo do marcador.
 */
function titulo(nome) {
  return nome.replace(/^\d+\s*-\s*/, '').replace(/\.[^.]+$/, '').trim();
}

/**
 * Percorre o diretorio de certificados e devolve as categorias na ordem da
 * planilha, com seus certificados tambem ordenados.
 *
 * @returns {Array<{titulo: string, certificados: Array<{titulo: string, caminho: string}>}>}
 */
function coletarCategorias(diretorioCertificados) {
  const entradas = fs.readdirSync(diretorioCertificados, { withFileTypes: true });
  const pastas = ordenarPorPrefixo(entradas.filter((e) => e.isDirectory()).map((e) => e.name));

  return pastas.map((pasta) => {
    const caminhoPasta = path.join(diretorioCertificados, pasta);
    const arquivos = fs
      .readdirSync(caminhoPasta, { withFileTypes: true })
      .filter((e) => e.isFile() && ehSuportado(e.name))
      .map((e) => e.name);

    return {
      titulo: titulo(pasta),
      certificados: ordenarPorPrefixo(arquivos).map((arquivo) => ({
        titulo: titulo(arquivo),
        caminho: path.join(caminhoPasta, arquivo),
      })),
    };
  });
}

module.exports = { coletarCategorias, EXTENSOES_IMAGEM };
