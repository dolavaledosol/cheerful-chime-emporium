
# Melhorar exibição do card fracionado

## Problema atual
O card de produtos fracionados tem informações densas e confusas: peso, porção, badge "FRACIONADO" e preços ficam amontoados em linhas pequenas, dificultando a leitura rápida.

## Mudanças propostas

### Reorganização do layout do card (`ProductCard.tsx`)

1. **Peso com destaque** - Mover o peso total do produto para uma posição mais visível, logo abaixo do nome, com ícone e tamanho maior
2. **Porção como subtexto** - A informação de porção padrão fica como texto secundário abaixo do peso, sem o prefixo "·"
3. **Badge "Fracionado" ao lado do peso** - Manter o badge mas posicioná-lo na mesma linha do peso para melhor hierarquia visual
4. **Bloco de preço reorganizado** - Separar visualmente o preço da porção (destaque) do preço unitário (secundário), com mais espaçamento

### Layout proposto

```text
┌─────────────────────┐
│      [IMAGEM]    🛒 │
├─────────────────────┤
│ CHARCUTARIA         │
│ Copa lombo maturado │
│                     │
│ ⚖ 1un  FRACIONADO  │
│ Porção: 0.3un      │
│                     │
│ R$ 25.92           │
│ R$ 86.40 / un      │
└─────────────────────┘
```

Diferenças vs atual:
- Peso em texto maior (text-xs em vez de text-[11px])
- Badge "Fracionado" na mesma linha do peso
- Porção em linha própria, mais legível
- Mais espaço entre peso/porção e preço

### Arquivo alterado
- `src/components/catalog/ProductCard.tsx` - seção de info do card (linhas ~131-170)
