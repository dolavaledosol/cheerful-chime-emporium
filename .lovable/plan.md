

## Ajuste no Cadastro de Produto: Separar Peso da Venda

### Situacao atual
O campo "Unidade" (unidade_medida) mistura unidades de peso (kg, g) com unidades de venda (un, cx, pct, etc.). O peso bruto/liquido usa esse campo para definir o rotulo.

### Regra de negocio correta
- **Unidade de medida** = apenas para peso do produto (kg ou g)
- **Venda** = sempre por quantidade (unidade)
- **Aceita fracionado** = permite vender fracoes (0.5, 0.3, etc.)

### Plano de implementacao

**Arquivo: `src/pages/admin/Produtos.tsx`**

1. **Renomear o campo "Unidade"** para **"Unidade de peso"** com opcoes apenas `kg` e `g`
2. **Remover** as opcoes `un, l, ml, cx, pct, par, m, cm` do select de unidade de medida
3. **Ajustar o default** de `unidade_medida` no `emptyForm` para `"kg"` em vez de `"un"`
4. **Reorganizar o formulario**: mover o campo "Unidade de peso" para ficar ao lado dos campos de peso bruto/liquido (3 colunas: Unidade de peso | Peso bruto | Peso liquido)
5. **Manter** o campo "Preco" em linha separada ou junto com "Quantidade padrao"
6. **Manter** o switch "Aceita fracionado" como esta — ele controla se o cliente pode comprar fracoes

### Detalhes tecnicos
- O campo `unidade_medida` no banco continua como esta (enum), apenas limitamos as opcoes no UI
- O `weightUnit` pode ser simplificado para usar diretamente `form.unidade_medida` ja que so tera kg/g
- Sem mudancas no banco de dados

