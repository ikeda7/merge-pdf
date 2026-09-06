# merge-pdf

Monta um PDF único a partir de uma planilha e uma pasta de certificados,
na ordem que você definir — extraindo automaticamente a sua página de
certificados emitidos em lote.

Feito para entrega de **atividades complementares** (ACC / AACC / ATPA / horas
extracurriculares), onde a secretaria pede "tudo num arquivo só, na ordem da
planilha".

## O problema

Muita instituição emite certificado **em lote**: um único PDF com uma página
por aluno da turma. Um certificado de mostra de trabalhos pode ter 140 páginas,
das quais só uma é sua.

Juntar os arquivos direto — em qualquer ferramenta de merge — produz um
documento com centenas de páginas de outras pessoas. Este projeto localiza a
sua página pelo nome e descarta o resto.

## Instalação

```bash
git clone <url-do-repositorio>
cd merge-pdf
npm install
cp config.example.js config.js
```

Edite o `config.js` com o seu nome e os caminhos. Ele **não é versionado**.

## Uso

```bash
node build.js
```

Gera o arquivo definido em `config.arquivoSaida`. É idempotente — rode quantas
vezes quiser.

## Estrutura dos documentos

```
dados/
├── planilha.pdf
└── certificados/
    ├── 1 - Participação em eventos/
    │   ├── 1 - Primeiro evento.pdf
    │   ├── 2 - Segundo evento.pdf
    │   └── 10 - Décimo evento.pdf
    ├── 2 - Cursos online/
    │   └── 1 - Algum curso.pdf
    └── 3 - Estágio/
        └── 1 - Termo de estágio.pdf
```

Os **prefixos numéricos** definem a ordem no documento final — pastas primeiro,
depois arquivos dentro de cada pasta. `10` vem depois de `9`, não depois de `1`.

Para inserir um certificado no meio, renumere os arquivos. Nada mais muda.

## O que ele faz

### Extrai a sua página de certificados em lote

PDFs acima de `limitePaginasSemFiltro` páginas são varridos em busca do seu
nome; só as páginas encontradas entram.

A busca ignora acentos, espaços e maiúsculas — necessário porque certificados
em lote costumam ter kerning agressivo, e o extrator devolve o nome quebrado
(`Ma ria d a Sil va San tos`). Também aceita várias grafias, já que emissores
diferentes escrevem o mesmo nome de formas diferentes.

A regra é conservadora, para nunca perder comprovação:

| Situação | O que acontece |
|---|---|
| PDF pequeno (≤ limite) | entra inteiro, sem filtro |
| PDF grande, nome encontrado | entram só as páginas do titular |
| PDF grande, nome ausente (escaneado) | entra inteiro **e emite aviso** |

### Padroniza o tamanho das páginas

Acervos misturam A4, Letter, A3 e tamanhos avulsos, o que faz o leitor de PDF
reajustar o zoom a cada página. Tudo vira A4, **preservando a orientação de
cada página** — paisagem continua paisagem. Nada é rotacionado ou cortado.

### Preserva selos de assinatura digital

Esta é a parte mais delicada do projeto.

Selos de assinatura digital (gov.br, ICP-Brasil) vivem em **anotações**
(`/Annots`) da página, não no conteúdo. Isso importa porque:

- `copyPages` **preserva** anotações
- `embedPages` **descarta** anotações

Por isso a normalização para A4 é feita no próprio documento, com
`scale` + `setMediaBox`, e **não** reconstruindo o PDF com `embedPages`. Uma
implementação ingênua faz documentos assinados saírem com as linhas de
assinatura em branco — comprovação sem assinatura nenhuma.

O `build.js` imprime a contagem de anotações ao final. Se cair, algo quebrou.

> **Limitação incontornável:** a validade *criptográfica* se perde em qualquer
> merge — a assinatura cobre o arquivo original inteiro, então juntar arquivos
> a invalida por definição. O que fica é o selo visual, com nome, data e link
> de verificação. Se alguém exigir a validação criptográfica, os originais
> precisam ser entregues à parte.

### Converte imagens

JPG e PNG viram página A4, na orientação da própria imagem.

### Gera índice navegável

O PDF sai com marcadores de dois níveis (categoria → certificado) e abre com o
painel visível. Não altera nada do conteúdo.

## Diagnóstico

```bash
node scripts/analisar.js "termo de busca"   # revela PDFs que são lote de turma
node scripts/assinaturas.js                 # lista documentos assinados digitalmente
node scripts/conferir.js                    # titular e carga horária, página a página
```

O `conferir.js` é o que se usa antes de enviar: ele lista cada página do
documento final com o titular detectado e a carga horária declarada, para
cruzar com a planilha.

## Arquitetura

```
build.js              receita: monta o documento na ordem das pastas
config.example.js     template de configuração
src/
  config.js           carrega o config.js local, com erro claro se faltar
  coletar.js          descobre e ordena pastas e arquivos
  filtrar.js          localiza as páginas do titular
  normalizar.js       converte para A4 sem destruir anotações
  marcadores.js       índice navegável
scripts/              diagnóstico
```

`src/` é genérico e reaproveitável. `build.js` é a receita específica — é o
arquivo a adaptar para outro tipo de dossiê.

## Privacidade

Certificados são dado pessoal, e os emitidos em lote contêm o nome de dezenas
ou centenas de **outras pessoas** — além de CPF em atestados e termos.

O `.gitignore` bloqueia o diretório de dados, PDFs, imagens, compactados e o
`config.js`. **Confira antes do primeiro push:**

```bash
git status --ignored --short | grep '^!!'   # o que está sendo ignorado
git ls-files                                 # o que será versionado
```

## Requisitos

Node.js 18+. Dependências: `pdf-lib` (manipulação) e `pdf-parse` (extração de
texto).

## Licença

MIT — veja [LICENSE](LICENSE).
