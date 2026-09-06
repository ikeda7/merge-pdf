'use strict';

/**
 * Conferencia do documento final: imprime, para cada pagina de certificado,
 * o titular e a carga horaria declarada. Serve para cruzar manualmente com
 * as linhas da planilha antes do envio.
 *
 * Uso: node scripts/conferir.js
 */

const path = require('path');
const { textoPorPagina, normalizar } = require('../src/filtrar');
const config = require('../src/config');

const SAIDA = path.join(__dirname, '..', config.arquivoSaida);
const PAGINAS_PLANILHA = 6;

/** Extrai a mencao de carga horaria, tolerando o kerning quebrado do PDF. */
function cargaHoraria(texto) {
  const limpo = texto.replace(/\s+/g, ' ');
  const casamento =
    /carga\s*hor[aá]ria\s*(?:de\s*)?([\d.,]+)\s*horas?/i.exec(limpo) ??
    /totalizando\s*([\d.,]+)\s*horas?/i.exec(limpo) ??
    /([\d.,]+)\s*horas?\s*de\s*atividade/i.exec(limpo);
  return casamento ? casamento[1] : '?';
}

async function main() {
  const paginas = await textoPorPagina(SAIDA);
  const alvos = config.nomesTitular.map(normalizar);

  console.log('pag | titular | carga | trecho');
  console.log('-'.repeat(74));

  paginas.forEach((texto, indice) => {
    if (indice < PAGINAS_PLANILHA) return;

    const vazio = texto.trim().length === 0;
    const normalizado = normalizar(texto);
    const titular = alvos.some((alvo) => normalizado.includes(alvo));

    const marca = vazio ? 'ESCANEADO' : titular ? 'ok' : 'SEM NOME ';
    const trecho = texto.replace(/\s+/g, ' ').slice(0, 88).trim();

    console.log(
      `${String(indice + 1).padStart(3)} | ${marca} | ${cargaHoraria(texto).padStart(6)} | ${trecho}`,
    );
  });
}

main().catch((erro) => {
  console.error(`Falhou: ${erro.message}`);
  process.exit(1);
});
