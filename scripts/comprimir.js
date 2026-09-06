'use strict';

/**
 * Recomprime as imagens embutidas do PDF final, gerando um segundo arquivo.
 *
 * Muitos certificados chegam como imagem sem perda (Flate + PNG Predictor) em
 * resolucao alta — otimo para arquivamento, exagerado para envio por sistemas
 * academicos com limite de upload. Converter para JPEG mantendo a resolucao
 * corta a maior parte do peso sem mexer no layout.
 *
 * O original NUNCA e sobrescrito: a saida vai para outro arquivo.
 *
 * Regra de seguranca sobre transparencia: uma imagem com /SMask so e
 * convertida se o canal alfa for *inteiramente opaco*. Nesse caso descartar o
 * alfa e identico ao original. Havendo transparencia real, a imagem fica
 * intacta.
 *
 * Uso: node scripts/comprimir.js [qualidade] [dpiMaximo]
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const sharp = require('sharp');
const { PDFDocument, PDFName, PDFNumber, PDFRawStream } = require('pdf-lib');

const { desfazerPredictorPng } = require('../src/predictor');
const config = require('../src/config');

const RAIZ = path.join(__dirname, '..');
const ENTRADA = path.join(RAIZ, config.arquivoSaida);
const SAIDA = path.join(RAIZ, config.arquivoSaida.replace(/\.pdf$/i, '-compacto.pdf'));

const QUALIDADE = Number(process.argv[2] ?? 82);
const DPI_MAXIMO = Number(process.argv[3] ?? 200);

/** Maior lado de uma pagina A4, em polegadas — base do calculo de DPI. */
const LADO_A4_POLEGADAS = 841.89 / 72;

function valor(dict, chave) {
  const v = dict.get(PDFName.of(chave));
  return v === undefined ? undefined : String(v);
}

/** Componentes por pixel do espaco de cor, ou null se nao for seguro converter. */
function canaisDe(documento, colorSpace) {
  const nome = String(colorSpace);
  if (nome === '/DeviceRGB') return 3;
  if (nome === '/DeviceGray') return 1;

  const alvo = documento.context.lookup(colorSpace);
  const lista = alvo?.asArray?.();
  if (lista && String(lista[0]) === '/ICCBased') {
    const perfil = documento.context.lookup(lista[1]);
    const n = Number(String(perfil?.dict?.get(PDFName.of('N')) ?? ''));
    if (n === 1 || n === 3) return n;
  }
  return null; // Indexed, CMYK, Separation: fora do escopo
}

/** Inflaciona um stream de imagem e desfaz o PNG Predictor, se houver. */
function pixelsCrus(documento, stream, largura, altura, canais) {
  let dados = zlib.inflateSync(stream.contents);

  const parms = documento.context.lookup(stream.dict.get(PDFName.of('DecodeParms')));
  const preditor = Number(String(parms?.get?.(PDFName.of('Predictor')) ?? 1));

  if (preditor >= 10) {
    dados = desfazerPredictorPng(dados, largura, canais, 8);
  } else if (preditor !== 1) {
    return null; // TIFF predictor: fora do escopo
  }

  return dados.length === largura * altura * canais ? dados : null;
}

/** true se o /SMask referenciado for inteiramente opaco. */
function mascaraTotalmenteOpaca(documento, refMascara, largura, altura) {
  const mascara = documento.context.lookup(refMascara);
  if (!(mascara instanceof PDFRawStream)) return false;

  const d = mascara.dict;
  if (Number(String(d.get(PDFName.of('Width')))) !== largura) return false;
  if (Number(String(d.get(PDFName.of('Height')))) !== altura) return false;
  if (Number(String(d.get(PDFName.of('BitsPerComponent')) ?? 8)) !== 8) return false;
  if (String(d.get(PDFName.of('Filter'))) !== '/FlateDecode') return false;

  try {
    const alfa = pixelsCrus(documento, mascara, largura, altura, 1);
    return alfa !== null && alfa.every((b) => b === 255);
  } catch {
    return false;
  }
}

async function main() {
  if (!fs.existsSync(ENTRADA)) throw new Error(`Nao encontrei ${ENTRADA}`);

  const documento = await PDFDocument.load(fs.readFileSync(ENTRADA), {
    ignoreEncryption: true,
  });

  const contagem = { recomprimidas: 0, reduzidas: 0, mantidas: 0, transparencia: 0 };
  let ganho = 0;

  for (const [ref, obj] of documento.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const dict = obj.dict;
    if (valor(dict, 'Subtype') !== '/Image') continue;

    const largura = Number(valor(dict, 'Width'));
    const altura = Number(valor(dict, 'Height'));
    const bits = Number(valor(dict, 'BitsPerComponent') ?? 8);
    const filtro = valor(dict, 'Filter');

    // /Mask (estencil) e ImageMask nao tem equivalente em JPEG.
    if (
      bits !== 8 ||
      !largura ||
      !altura ||
      dict.get(PDFName.of('Mask')) !== undefined ||
      valor(dict, 'ImageMask') === 'true'
    ) {
      contagem.mantidas += 1;
      continue;
    }

    const refMascara = dict.get(PDFName.of('SMask'));
    if (
      refMascara !== undefined &&
      !mascaraTotalmenteOpaca(documento, refMascara, largura, altura)
    ) {
      contagem.transparencia += 1;
      continue;
    }

    const original = obj.contents;
    let saida = null;

    try {
      if (filtro === '/FlateDecode') {
        const canais = canaisDe(documento, dict.get(PDFName.of('ColorSpace')));
        if (!canais) {
          contagem.mantidas += 1;
          continue;
        }

        const cru = pixelsCrus(documento, obj, largura, altura, canais);
        if (!cru) {
          contagem.mantidas += 1;
          continue;
        }

        saida = await sharp(cru, {
          raw: { width: largura, height: altura, channels: canais },
        })
          .jpeg({ quality: QUALIDADE, mozjpeg: true })
          .toBuffer();
      } else if (filtro === '/DCTDecode') {
        const dpi = Math.max(largura, altura) / LADO_A4_POLEGADAS;
        if (dpi <= DPI_MAXIMO) {
          contagem.mantidas += 1;
          continue;
        }
        const fator = DPI_MAXIMO / dpi;
        saida = await sharp(original)
          .resize(Math.round(largura * fator), Math.round(altura * fator))
          .jpeg({ quality: QUALIDADE, mozjpeg: true })
          .toBuffer();
      } else {
        contagem.mantidas += 1;
        continue;
      }
    } catch {
      contagem.mantidas += 1;
      continue;
    }

    // So troca se compensar de verdade.
    if (!saida || saida.length >= original.length * 0.9) {
      contagem.mantidas += 1;
      continue;
    }

    const meta = await sharp(saida).metadata();
    dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
    dict.set(PDFName.of('Width'), PDFNumber.of(meta.width));
    dict.set(PDFName.of('Height'), PDFNumber.of(meta.height));
    dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
    dict.set(
      PDFName.of('ColorSpace'),
      PDFName.of(meta.channels === 1 ? 'DeviceGray' : 'DeviceRGB'),
    );
    dict.set(PDFName.of('Length'), PDFNumber.of(saida.length));
    dict.delete(PDFName.of('DecodeParms'));
    dict.delete(PDFName.of('SMask')); // comprovadamente opaco

    if (filtro === '/DCTDecode') contagem.reduzidas += 1;
    else contagem.recomprimidas += 1;

    ganho += original.length - saida.length;
    documento.context.assign(ref, PDFRawStream.of(dict, saida));
  }

  fs.writeFileSync(SAIDA, await documento.save({ useObjectStreams: true }));

  const antes = fs.statSync(ENTRADA).size / 1024 / 1024;
  const depois = fs.statSync(SAIDA).size / 1024 / 1024;

  console.log(`qualidade ${QUALIDADE} | dpi maximo ${DPI_MAXIMO}`);
  console.log(
    `imagens: ${contagem.recomprimidas} recomprimidas, ${contagem.reduzidas} reduzidas, ` +
      `${contagem.mantidas} mantidas, ${contagem.transparencia} com transparencia real`,
  );
  console.log(`ganho nas imagens: ${(ganho / 1024 / 1024).toFixed(1)} MB`);
  console.log(
    `\n${antes.toFixed(1)} MB  ->  ${depois.toFixed(1)} MB  ` +
      `(${(100 - (depois / antes) * 100).toFixed(0)}% menor)`,
  );
  console.log(`Gerado: ${SAIDA}`);
}

main().catch((erro) => {
  console.error(`Falhou: ${erro.message}`);
  process.exit(1);
});
