# Biblioteca modular NATIVOS — coleção 01

## Conteúdo e uso

18 desenhos originais, com seis adaptações geométricas por desenho (108 GLBs): três olhos, três bocas, três cabelos, três camisas, três calças e três acessórios. As seis bases fornecidas permanecem intactas. O estado inicial é a base sem peças; **Experimentar conjunto inicial** monta uma combinação, e **Restaurar base sem peças** limpa a montagem. Cada categoria permite remover a peça e alterar sua cor. Rosto oferece três combinações de olhos/boca, sem impedir trocas independentes.

Execute na raiz do workspace:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/nativos-character-studio dev
pnpm --filter @workspace/nativos-character-studio typecheck
pnpm --filter @workspace/nativos-character-studio library:generate
pnpm --filter @workspace/nativos-character-studio library:validate
pnpm --filter @workspace/nativos-character-studio build
```

O servidor local usa a porta 5173 e `/`; `PORT` e `BASE_PATH` continuam aceitos. A geração é offline, determinística e usa apenas as bases locais. Não é necessário Blender nem serviço de geração remoto. A biblioteca pronta está versionada: não é preciso regenerar para abrir o editor.

## Estrutura

```text
src/assets/models/                      seis arquivos originais + licença
src/studio/modular/
  library.generated.json                contrato tipado usado pelo editor
  registry.ts                           seleção, validação e compatibilidade
src/components/
  BaseCharacter.tsx                     corpo original e escala comum
  ModularParts.tsx                       carregamento e materiais por instância
  LibraryPanel.tsx                       seleção de peças e cores
scripts/
  generate-modular.mjs                   geração, fitting, booleanas e GLB
  validate-modular.mjs                   validação independente dos artefatos
  modular/catalog.mjs                    definições autorais e expressões
  modular/geometry.mjs                   superfícies, projeção e cascas
public/assets/collectible/
  face/eyes/<id>/<base>.glb
  face/mouths/<id>/<base>.glb
  hair/<id>/<base>.glb
  clothing/shirts/<id>/<base>.glb
  clothing/pants/<id>/<base>.glb
  accessories/glasses/<id>/<base>.glb
  accessories/hats/<id>/<base>.glb
  metadata/library.json                  contrato e dimensões de todas as bases
  metadata/validation.json               topologia por malha
  metadata/fit-validation.json           amostras de contato com o corpo
  thumbnails/<id>.svg                    projeção da geometria real em 3HT F
```

Não há uma cópia extra de corpos ou cabeças: são referenciados os arquivos originais. As sobrancelhas fazem parte do módulo de olhos nesta coleção; a categoria independente pode ser acrescentada futuramente.

## Sistema de coordenadas e encaixes

A modelagem e os metadados usam milímetros. Todas as bases têm **120 mm de altura do corpo**, da sola ao topo da cabeça, antes dos ajustes do editor; cabelo e chapéu aumentam a altura total. A conversão é medida a partir da bounding box de cada arquivo. Não se aplicam números aproximados diferentes ao corpo e à roupa. `+Y` é para cima, `+Z` é a frente e `+X` é a direita da cena. A origem global é o chão, no plano de simetria.

Cada GLB usa metros, conforme o formato glTF, com um fator explícito de 0,001 no nó raiz. O montador converte para milímetros ao carregar. Cada GLB tem origem local no anchor declarado. Transform padrão: translação e rotação zero, escala `[1,1,1]`. A posição do anchor é aplicada pelo montador; a escala do personagem é aplicada a um único ancestral de corpo e peças, evitando desvios quando altura ou largura mudam. As normais e materiais seguem a mesma transformação.

| Anchor | Função |
| --- | --- |
| HEAD | volume do crânio e cabelo |
| FACE_EYES | centro entre os olhos, projetado na face |
| FACE_MOUTH | centro da boca, projetado na face |
| HEAD_TOP | topo da cabeça para chapéus |
| NECK | limite anatômico do pescoço |
| TORSO | centro do tronco para camisas |
| WAIST | plano da cintura para calças |

O manifesto registra largura, altura e profundidade da cabeça, cintura, pescoço, centro do rosto, escala de importação e SHA-256 da base. A calibração de regiões anatômicas em `landmarks` delimita as áreas; os pontos da superfície são obtidos por interseção com triângulos da base. Assim, as adaptações feminina e masculina não são a mesma peça redimensionada arbitrariamente.

## Construção

- **Olhos:** relevos fechados amostrados na curvatura real, em pares simétricos. Esclera, íris, pupila e brilho têm materiais separados. A cor primária controla íris e sobrancelhas. São volumes e não imagens planas.
- **Bocas:** curvas fechadas nas extremidades, projetadas na face; o sorriso aberto usa relevo com detalhe claro. A linha facial pode ser ampliada por novos módulos e presets.
- **Cabelos:** casca contínua com interior e borda fechada; superfície projetada, suavizada e esculpida, com franja, contorno bob ou extensão posterior contínua. A versão longa não é uma peça retangular anexada a uma tampa.
- **Camisas:** recorte anatômico com envelope do tronco para suavizar detalhes corporais, mangas com comprimentos próprios, gola/aberturas fechadas e acabamentos independentes. Camisa com gola possui abas e botões; blusa possui manga longa e costura de bolso.
- **Calças:** cascas das regiões de quadril e pernas, com comprimentos e folgas distintos, barras fechadas e costuras na opção casual.
- **Acessórios:** óculos com armação, ponte e hastes; boné com aba frontal curva; bucket com aba ao redor. As copas acompanham a cabeça específica.
- **Contato:** diferenças booleanas com a base removem volumes que atravessariam o corpo, incluindo a região entre as pernas e sob as orelhas. O motor [Manifold](https://manifoldcad.org/docs/jsuser/classes/Manifold.html) é usado somente na geração, não aumenta o runtime do editor.
- **Tempo real:** GLBs são carregados sob demanda e reutilizados pelo loader. Materiais são clonados por instância; trocar uma cor não altera o cache ou outra peça. As geometrias compartilhadas não são descartadas pelo desmontador de instâncias.

## Compatibilidade

Todas as peças têm uma variante para cada combinação de 2HT/3HT/4HT e feminino/masculino. Trocar a base seleciona automaticamente o arquivo correspondente. As peças valem para a T-pose original; não têm rig, pesos ou garantia para poses deformadas.

| Combinação | Regra |
| --- | --- |
| Olhos + qualquer boca | Permitida |
| Camisas + calças | Permitida; folgas e cintura partilhadas |
| Óculos + cabelos | Permitida; hastes externas |
| Boné/bucket + cabelo | Bloqueada nesta coleção; retirar cabelo antes |
| Mais de um item da mesma categoria | Substituição do anterior |
| Identificador desconhecido ou categoria errada | Ignorado pelo validador de estado |

O conflito é verificado nos dois sentidos: selecionar cabelo com chapéu e selecionar chapéu com cabelo têm a mesma regra. O editor mostra o motivo e não remove peças silenciosamente. A renderização também sanitiza as seleções, para não depender apenas de botões desativados.

## Impressão 3D: preparação e limites

Esta entrega contém volumes fechados para renderização e preparação de fabricação; não declara o personagem montado pronto para impressão. A espessura nominal das roupas é 1,2 mm; cabelo e copas ficam aproximadamente entre 1,4 e 1,6 mm; armações e curvas usam diâmetros de 1,2–1,5 mm. Recortes de contato podem reduzir espessuras locais. Os pequenos brilhos e detalhes faciais são de renderização e podem exigir engrossamento ou união na preparação física.

Antes de fabricar: definir material, processo e tamanho final; medir a espessura mínima real após todas as booleanas; unir as subpeças que devem formar uma única peça; remover interfaces internas; definir pinos/tolerâncias se o objetivo for montagem física; orientar, gerar suportes e validar no fatiador. As folgas atuais são para encaixe virtual, não tolerâncias universais de fabricação. Escala não uniforme pode reduzir a espessura em um eixo. Não há pinos, rig ou exportador de personagem montado nesta etapa.

O relatório de topologia avalia cada submalha. Ele não certifica a união final, não substitui teste físico nem prova ausência de todas as interseções entre todas as combinações possíveis. A checagem de encaixe usa amostras das faces interna e externa contra o corpo, com tolerância de contato de 0,08 mm; a inspeção visual cobre exemplos das seis bases e vistas do editor.

A licença original permanece em `src/assets/models/LICENSE.txt`. Corpos e superfícies derivadas não recebem automaticamente uma nova licença de redistribuição. O projeto mantém a restrição local já registrada em `.agents/memory/dreamloft3d-asset-license.md`: não oferecer downloads de bases nem exportação de personagens derivados sem esclarecer a autorização correspondente.

## Como ampliar a coleção

1. Registrar ID estável, categoria, anchor, cor, notas e conflitos em `scripts/modular/catalog.mjs`.
2. Implementar a forma no gerador, usando projeção/superfície da base e os mesmos helpers de geometria.
3. Gerar variantes para as seis bases; não reutilizar uma variante de outra proporção.
4. Rodar geração, validação, TypeScript e build. Conferir frontal/lateral/traseira, ajustes extremos e conflitos no editor.
5. Manter relatórios e manifesto junto aos GLBs. Alterar a base requer regenerar: o hash permite detectar variantes desatualizadas.

Novos desenhos nas seis categorias são descobertos pelo catálogo e não precisam de um novo renderer. Uma categoria nova exige acrescentar seu campo ao contrato de estado e a seção de seleção; os carregadores, transformações e materiais continuam os mesmos.
