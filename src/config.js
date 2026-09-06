'use strict';

const fs = require('fs');
const path = require('path');

const CAMINHO = path.join(__dirname, '..', 'config.js');

/**
 * Carrega a configuracao local.
 *
 * O `config.js` nao e versionado — ele guarda o nome do titular, que e dado
 * pessoal. Quem clona o repositorio precisa cria-lo a partir do template.
 */
if (!fs.existsSync(CAMINHO)) {
  console.error(
    '\nconfig.js nao encontrado.\n\n' +
      '  cp config.example.js config.js\n\n' +
      'Depois ajuste `nomesTitular` com as grafias do seu nome.\n',
  );
  process.exit(1);
}

module.exports = require(CAMINHO);
