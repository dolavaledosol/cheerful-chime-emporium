

## Problem Analysis

There are **three places** creating `cliente` records, causing duplicates:

1. **`handle_new_user()` DB trigger** -- Creates a new cliente on every user signup. Uses `ON CONFLICT DO NOTHING`, but there is **no UNIQUE constraint** on `user_id` or `cpf_cnpj`, so the conflict clause never triggers and it **always inserts**.

2. **Perfil.tsx `loadAll()`** (line 134) -- If no cliente found by `user_id`, creates a new one. Doesn't check if a cliente with the same CPF already exists elsewhere.

3. **Perfil.tsx `saveProfile()`** (line 170) -- Updates `cpf_cnpj` on the current cliente record, but doesn't check if another cliente already has that CPF. Results in two records with the same CPF.

4. **Checkout.tsx `findOrCreateCliente()`** -- When `clienteId` is set, updates CPF on that record. When not set, calls `find_or_link_cliente_by_cpf` RPC which can find by CPF or user_id, but by this point duplicates may already exist.

**Root cause**: No UNIQUE constraints on `cliente.user_id` or `cliente.cpf_cnpj`, and multiple code paths that insert without checking for existing records.

---

## Plan

### 1. Database Migration -- Add UNIQUE constraints and fix trigger

- Add a **partial UNIQUE index** on `cliente.user_id` (WHERE `user_id IS NOT NULL`)
- Add a **partial UNIQUE index** on `cliente.cpf_cnpj` (WHERE `cpf_cnpj IS NOT NULL`)
- Update `handle_new_user()` trigger to use the `find_or_link_cliente_by_cpf` pattern: first search by `user_id`, then create only if not found. Remove the broken `ON CONFLICT DO NOTHING`.

Before adding constraints, deduplicate existing data:
```sql
-- Merge duplicate cliente records by user_id and cpf_cnpj
-- Keep the oldest record, update references, delete duplicates
```

### 2. Perfil.tsx -- Use RPC when saving CPF

In `saveProfile()`, when CPF is provided, call `find_or_link_cliente_by_cpf` RPC instead of a plain `UPDATE`. This will:
- Find an existing cliente with that CPF (e.g., created via WhatsApp/admin)
- Link the current user to that existing record
- Update the component state with the correct `cliente_id`

In `loadAll()`, remove the manual `INSERT` fallback (line 134). The trigger already creates the record on signup.

### 3. Checkout.tsx -- Simplify findOrCreateCliente

When `clienteId` is already set and CPF hasn't changed, just return it. When CPF is provided (new or changed), always call the RPC to ensure proper merging. Update `clienteId` state with the result.

### 4. Update `find_or_link_cliente_by_cpf` RPC

Add logic to handle the case where there are already multiple records for the same user. The function should consolidate by preferring the record that has the CPF match, and updating `user_id` on it.

---

## Technical Details

**Migration SQL** will:
1. Deduplicate `cliente` rows (keep oldest per `user_id`, reassign `pedido`, `cliente_endereco`, `cliente_telefone` foreign keys)
2. Create `CREATE UNIQUE INDEX idx_cliente_user_unique ON cliente(user_id) WHERE user_id IS NOT NULL`
3. Create `CREATE UNIQUE INDEX idx_cliente_cpf_unique ON cliente(cpf_cnpj) WHERE cpf_cnpj IS NOT NULL`
4. Replace `handle_new_user()` to check for existing cliente before inserting

**Perfil.tsx changes**: `saveProfile` calls RPC, `loadAll` removes manual insert fallback

**Checkout.tsx changes**: `findOrCreateCliente` always delegates to RPC when CPF is present, caches result in state

