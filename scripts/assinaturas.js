'use strict';

/**
 * Verifica se algum PDF de origem carrega assinatura digital ou anotacoes.
 *
 * Assinatura digital vive em /AcroForm com campo /FT /Sig, e o carimbo visivel
 * costuma ser uma anotacao (/Annots). Merge e normalizacao descartam ambos: a
 * assinatura *desenhada* continua visivel, mas a validade criptografica se
 * perde. Se algum documento depender disso, ele precisa ser entregue a parte.
 *
 * Uso: node scripts/assinaturas.js
 */

const fs = require('fs');
const path = require('path');
const { PDFDocument, PDFName } = require('pdf-lib');

const { coletarCategorias } = require('../src/coletar');

const DIRETORIO_CERTIFICADOS = path.join(__dirname, '..', 'ACC', 'certificados');

function inspecionar(documento) {
  const acroForm = documento.catalog.lookup(PDFName.of('AcroForm'));
  let camposAssinatura = 0;

  if (acroForm) {
    const campos = acroForm.lookup(PDFName.of('Fields'));
    const lista = campos?.asArray?.() ?? [];
    for (const referencia of lista) {
      const campo = documento.context.lookup(referencia);
      if (String(campo?.get?.(PDFName.of('FT'))) === '/Sig') camposAssinatura += 1;
    }
  }

  const anotacoes = documento.getPages().reduce((soma, pagina) => {
    const lista = pagina.node.Annots();
    return soma + (lista?.size?.() ?? 0);
  }, 0);

  return { temAcroForm: Boolean(acroForm), camposAssinatura, anotacoes };
}

async function main() {
  const categorias = coletarCategorias(DIRETORIO_CERTIFICADOS);
  let achou = false;

  for (const categoria of categorias) {
    for (const certificado of categoria.certificados) {
      if (path.extname(certificado.caminho).toLowerCase() !== '.pdf') continue;

      const documento = await PDFDocument.load(fs.readFileSync(certificado.caminho), {
        ignoreEncryption: true,
      });
      const { temAcroForm, camposAssinatura, anotacoes } = inspecionar(documento);
      if (!temAcroForm && anotacoes === 0) continue;

      achou = true;
      const marcas = [
        camposAssinatura > 0 ? `ASSINATURA DIGITAL x${camposAssinatura}` : null,
        temAcroForm && camposAssinatura === 0 ? 'AcroForm (sem campo /Sig)' : null,
        anotacoes > 0 ? `${anotacoes} anotacao(oes)` : null,
      ].filter(Boolean);

      console.log(`${certificado.titulo.padEnd(34)} ${marcas.join(' | ')}`);
    }
  }

  if (!achou) {
    console.log('Nenhum PDF de origem tem AcroForm ou anotacoes.');
  }
}

main().catch((erro) => {
  console.error(`Falhou: ${erro.message}`);
  process.exit(1);
});
