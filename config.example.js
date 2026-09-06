'use strict';

/**
 * Template de configuracao.
 *
 * Copie para `config.js` e ajuste. O `config.js` nao e versionado, porque o
 * nome do titular e dado pessoal.
 *
 *   cp config.example.js config.js
 */
module.exports = {
  /**
   * Onde estao os documentos. Nada dentro deste diretorio e versionado:
   * certificados sao dado pessoal, e os emitidos em lote trazem o nome de
   * dezenas ou centenas de outras pessoas.
   *
   * Estrutura esperada:
   *
   *   <diretorioDados>/
   *     <planilha>
   *     <subdiretorioCertificados>/
   *       1 - Primeira categoria/
   *         1 - Primeiro certificado.pdf
   *         2 - Segundo certificado.pdf
   *       2 - Segunda categoria/
   *         1 - Outro certificado.pdf
   *
   * Os prefixos numericos definem a ordem no documento final.
   */
  diretorioDados: 'dados',
  subdiretorioCertificados: 'certificados',

  /** Documento que abre o dossie, relativo a `diretorioDados`. */
  planilha: 'planilha.pdf',
  tituloPlanilha: 'Planilha',

  /**
   * Grafias do titular, usadas para localizar a pagina certa dentro de PDFs
   * que trazem o certificado de uma turma inteira.
   *
   * Acentos, espacos e maiusculas sao ignorados na comparacao. Inclua as
   * variacoes reais: emissores diferentes escrevem o mesmo nome de formas
   * diferentes (nome completo em um, nome curto em outro).
   */
  nomesTitular: ['Nome Completo Do Titular', 'Nome Curto'],

  /**
   * PDFs ate este numero de paginas entram integralmente, sem tentativa de
   * filtro. Cobre certificado de frente e verso.
   */
  limitePaginasSemFiltro: 4,

  /**
   * Reescreve todas as paginas em A4, preservando a orientacao de cada uma.
   * Acervos costumam misturar Letter, A3 e tamanhos avulsos, o que faz o
   * leitor de PDF reajustar o zoom a cada pagina.
   */
  padronizarTamanho: true,

  titulo: 'Atividades Complementares',
  arquivoSaida: 'dossie-completo.pdf',
};
