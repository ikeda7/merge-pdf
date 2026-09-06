'use strict';

const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const { coletarCategorias, EXTENSOES_IMAGEM } = require('./src/coletar');
const { adicionarMarcadores } = require('./src/marcadores');
const { paginasDoTitular } = require('./src/filtrar');
const { normalizarParaA4, LARGURA_A4, ALTURA_A4 } = require('./src/normalizar');
const config = require('./src/config');

const RAIZ = __dirname;
const DIRETORIO_DADOS = path.join(RAIZ, config.diretorioDados);
const DIRETORIO_CERTIFICADOS = path.join(DIRETORIO_DADOS, config.subdiretorioCertificados);
const PLANILHA_PDF = path.join(DIRETORIO_DADOS, config.planilha);
const SAIDA = path.join(RAIZ, config.arquivoSaida);

/** Avisos acumulados durante a montagem, exibidos no resumo final. */
const avisos = [];

const MARGEM = 28; // ~1 cm

/**
 * Decide quais paginas de um PDF entram no documento final.
 *
 * Muitas instituicoes emitem certificado em lote, com uma pagina por aluno
 * da turma. Nesses arquivos so a pagina do titular interessa. A regra e
 * deliberadamente conservadora: arquivos pequenos entram inteiros, e um
 * arquivo grande cujo titular nao foi localizado tambem entra inteiro, com
 * aviso — melhor sobrar pagina do que faltar comprovacao.
 *
 * @returns {Promise<{indices: number[], nota: string}>}
 */
async function selecionarPaginas(caminho, origem, rotulo) {
  const todas = origem.getPageIndices();
  if (todas.length <= config.limitePaginasSemFiltro) {
    return { indices: todas, nota: '' };
  }

  const encontradas = await paginasDoTitular(caminho, config.nomesTitular);
  if (encontradas.length > 0) {
    return { indices: encontradas, nota: `de ${todas.length} pag.` };
  }

  avisos.push(
    `${rotulo}: ${todas.length} paginas, titular nao localizado no texto ` +
      `(PDF escaneado?) — incluido integralmente, confira manualmente`,
  );
  return { indices: todas, nota: `INTEGRAL, ${todas.length} pag. — CONFERIR` };
}

/**
 * Copia as paginas relevantes de um PDF de origem para o documento final.
 * `ignoreEncryption` cobre certificados emitidos com protecao de impressao,
 * comum em plataformas de curso.
 */
async function anexarPdf(destino, caminho, rotulo) {
  const origem = await PDFDocument.load(fs.readFileSync(caminho), {
    ignoreEncryption: true,
  });
  const { indices, nota } = await selecionarPaginas(caminho, origem, rotulo);
  const paginas = await destino.copyPages(origem, indices);
  for (const pagina of paginas) destino.addPage(pagina);
  return { total: paginas.length, nota };
}

/**
 * Insere uma imagem como uma unica pagina A4, preservando a proporcao original
 * e centralizando dentro das margens.
 *
 * A pagina assume a orientacao da propria imagem: certificados digitalizados
 * costumam ser paisagem, e force-los em retrato desperdicaria metade da folha.
 */
async function anexarImagem(destino, caminho) {
  const bytes = fs.readFileSync(caminho);
  const extensao = path.extname(caminho).toLowerCase();
  const imagem =
    extensao === '.png' ? await destino.embedPng(bytes) : await destino.embedJpg(bytes);

  const paisagem = imagem.width > imagem.height;
  const larguraPagina = paisagem ? ALTURA_A4 : LARGURA_A4;
  const alturaPagina = paisagem ? LARGURA_A4 : ALTURA_A4;

  const escala = Math.min(
    (larguraPagina - MARGEM * 2) / imagem.width,
    (alturaPagina - MARGEM * 2) / imagem.height,
  );
  const largura = imagem.width * escala;
  const altura = imagem.height * escala;

  destino.addPage([larguraPagina, alturaPagina]).drawImage(imagem, {
    x: (larguraPagina - largura) / 2,
    y: (alturaPagina - altura) / 2,
    width: largura,
    height: altura,
  });
  return { total: 1, nota: `imagem ${paisagem ? 'paisagem' : 'retrato'}` };
}

async function anexar(destino, caminho, rotulo) {
  const extensao = path.extname(caminho).toLowerCase();
  return EXTENSOES_IMAGEM.has(extensao)
    ? anexarImagem(destino, caminho)
    : anexarPdf(destino, caminho, rotulo);
}

async function main() {
  if (!fs.existsSync(PLANILHA_PDF)) {
    throw new Error(`Planilha em PDF nao encontrada: ${PLANILHA_PDF}`);
  }

  const documento = await PDFDocument.create();
  const arvore = [];
  let paginaAtual = 0;

  // A planilha entra inteira: e o indice do documento, nao um certificado.
  const planilha = await PDFDocument.load(fs.readFileSync(PLANILHA_PDF));
  for (const pagina of await documento.copyPages(planilha, planilha.getPageIndices())) {
    documento.addPage(pagina);
  }
  arvore.push({ titulo: config.tituloPlanilha, pagina: paginaAtual });
  console.log(`  p.  1  ${config.tituloPlanilha} (${planilha.getPageCount()} pag.)`);
  paginaAtual += planilha.getPageCount();

  const categorias = coletarCategorias(DIRETORIO_CERTIFICADOS);

  for (const categoria of categorias) {
    console.log(`\n${categoria.titulo}`);
    const paginaCategoria = paginaAtual;
    const filhos = [];

    for (const certificado of categoria.certificados) {
      const { total, nota } = await anexar(documento, certificado.caminho, certificado.titulo);
      filhos.push({ titulo: certificado.titulo, pagina: paginaAtual });
      console.log(
        `  p.${String(paginaAtual + 1).padStart(3)}  ${certificado.titulo}` +
          (nota ? `  [${nota}]` : ''),
      );
      paginaAtual += total;
    }

    arvore.push({ titulo: categoria.titulo, pagina: paginaCategoria, filhos });
  }

  const final = config.padronizarTamanho ? normalizarParaA4(documento) : documento;
  if (config.padronizarTamanho) {
    console.log('\nPaginas reescritas em A4 (orientacao de cada uma preservada).');
  }

  const anotacoes = final
    .getPages()
    .reduce((soma, pagina) => soma + (pagina.node.Annots()?.size?.() ?? 0), 0);
  console.log(`Anotacoes preservadas: ${anotacoes} (selos de assinatura digital).`);

  adicionarMarcadores(final, arvore);

  final.setTitle(config.titulo);
  final.setCreationDate(new Date());

  fs.writeFileSync(SAIDA, await final.save());

  const tamanhoMb = (fs.statSync(SAIDA).size / 1024 / 1024).toFixed(1);
  console.log(`\n${'='.repeat(64)}`);
  console.log(`Gerado: ${SAIDA}`);
  console.log(`${final.getPageCount()} paginas  |  ${tamanhoMb} MB`);

  if (avisos.length > 0) {
    console.log(`\nAvisos (${avisos.length}):`);
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }
}

main().catch((erro) => {
  console.error(`\nFalhou: ${erro.message}`);
  process.exit(1);
});
