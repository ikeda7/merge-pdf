'use strict';

/**
 * Diagnostico: identifica quais arquivos sao certificados individuais e quais
 * sao documentos de evento inteiro (anais, listas de participantes).
 *
 * Uso: node scripts/analisar.js "<termo de busca>"
 * Sem termo, apenas lista o tamanho e o inicio do texto de cada arquivo.
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const { coletarCategorias } = require('../src/coletar');

const DIRETORIO_CERTIFICADOS = path.join(__dirname, '..', 'ACC', 'certificados');
const LIMITE_PAGINAS_CERTIFICADO = 4;

async function extrairTexto(caminho) {
  const { PDFParse } = await import('pdf-parse');
  const leitor = new PDFParse({ data: fs.readFileSync(caminho) });
  try {
    const resultado = await leitor.getText();
    return resultado.text ?? '';
  } finally {
    await leitor.destroy();
  }
}

async function contarPaginas(caminho) {
  const documento = await PDFDocument.load(fs.readFileSync(caminho), {
    ignoreEncryption: true,
  });
  return documento.getPageCount();
}

async function main() {
  const termo = (process.argv[2] ?? '').trim().toLowerCase();
  const categorias = coletarCategorias(DIRETORIO_CERTIFICADOS);

  for (const categoria of categorias) {
    for (const certificado of categoria.certificados) {
      if (path.extname(certificado.caminho).toLowerCase() !== '.pdf') continue;

      const paginas = await contarPaginas(certificado.caminho);
      if (paginas <= LIMITE_PAGINAS_CERTIFICADO) continue;

      const texto = await extrairTexto(certificado.caminho);
      const cabecalho = texto.replace(/\s+/g, ' ').slice(0, 160).trim();

      console.log(`\n=== ${certificado.titulo} (${paginas} pag.) ===`);
      console.log(`  inicio: ${cabecalho}`);

      if (termo) {
        const ocorrencias = [...texto.toLowerCase().matchAll(new RegExp(termo, 'g'))];
        console.log(`  ocorrencias de "${termo}": ${ocorrencias.length}`);
        for (const ocorrencia of ocorrencias.slice(0, 3)) {
          const trecho = texto
            .slice(Math.max(0, ocorrencia.index - 90), ocorrencia.index + 110)
            .replace(/\s+/g, ' ');
          console.log(`    ...${trecho}...`);
        }
      }
    }
  }
}

main().catch((erro) => {
  console.error(`Falhou: ${erro.message}`);
  process.exit(1);
});
