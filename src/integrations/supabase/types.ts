export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      banco: {
        Row: {
          ativo: boolean
          banco_id: string
          codigo: string | null
          conta_corrente: string | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          banco_id?: string
          codigo?: string | null
          conta_corrente?: string | null
          nome: string
        }
        Update: {
          ativo?: boolean
          banco_id?: string
          codigo?: string | null
          conta_corrente?: string | null
          nome?: string
        }
        Relationships: []
      }
      carrinho: {
        Row: {
          carrinho_id: string
          created_at: string
          session_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          carrinho_id?: string
          created_at?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          carrinho_id?: string
          created_at?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      carrinho_item: {
        Row: {
          carrinho_id: string
          carrinho_item_id: string
          estoque_local_id: string | null
          produto_id: string
          quantidade: number
        }
        Insert: {
          carrinho_id: string
          carrinho_item_id?: string
          estoque_local_id?: string | null
          produto_id: string
          quantidade?: number
        }
        Update: {
          carrinho_id?: string
          carrinho_item_id?: string
          estoque_local_id?: string | null
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "carrinho_item_carrinho_id_fkey"
            columns: ["carrinho_id"]
            isOneToOne: false
            referencedRelation: "carrinho"
            referencedColumns: ["carrinho_id"]
          },
          {
            foreignKeyName: "carrinho_item_estoque_local_id_fkey"
            columns: ["estoque_local_id"]
            isOneToOne: false
            referencedRelation: "estoque_local"
            referencedColumns: ["estoque_local_id"]
          },
          {
            foreignKeyName: "carrinho_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "carrinho_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      cliente: {
        Row: {
          ativo: boolean
          cliente_id: string
          clientewhats_id: number | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          nome: string
          tipo_cliente: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cliente_id?: string
          clientewhats_id?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          nome: string
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cliente_id?: string
          clientewhats_id?: number | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          nome?: string
          tipo_cliente?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cliente_clientewhats_id_fkey"
            columns: ["clientewhats_id"]
            isOneToOne: false
            referencedRelation: "clientewhats"
            referencedColumns: ["clientewhats_id"]
          },
        ]
      }
      cliente_endereco: {
        Row: {
          cliente_id: string
          endereco_id: string
        }
        Insert: {
          cliente_id: string
          endereco_id: string
        }
        Update: {
          cliente_id?: string
          endereco_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cliente_endereco_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "cliente_endereco_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "endereco"
            referencedColumns: ["endereco_id"]
          },
        ]
      }
      cliente_telefone: {
        Row: {
          cliente_id: string
          cliente_telefone_id: string
          from: string | null
          is_whatsapp: boolean
          telefone: string
          verificado: boolean
        }
        Insert: {
          cliente_id: string
          cliente_telefone_id?: string
          from?: string | null
          is_whatsapp?: boolean
          telefone: string
          verificado?: boolean
        }
        Update: {
          cliente_id?: string
          cliente_telefone_id?: string
          from?: string | null
          is_whatsapp?: boolean
          telefone?: string
          verificado?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "cliente_telefone_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      clientewhats: {
        Row: {
          cliente_id: string | null
          clientewhats_id: number
          cpf_cnpj: string | null
          created_at: string
          dados_completos: boolean | null
          from: string | null
          nome: string | null
          notifyName: string | null
        }
        Insert: {
          cliente_id?: string | null
          clientewhats_id?: number
          cpf_cnpj?: string | null
          created_at?: string
          dados_completos?: boolean | null
          from?: string | null
          nome?: string | null
          notifyName?: string | null
        }
        Update: {
          cliente_id?: string | null
          clientewhats_id?: number
          cpf_cnpj?: string | null
          created_at?: string
          dados_completos?: boolean | null
          from?: string | null
          nome?: string | null
          notifyName?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientewhats_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      clientewhats_interesse: {
        Row: {
          created_at: string
          from: string | null
          interesse: string | null
          interesse_id: number
        }
        Insert: {
          created_at?: string
          from?: string | null
          interesse?: string | null
          interesse_id?: number
        }
        Update: {
          created_at?: string
          from?: string | null
          interesse?: string | null
          interesse_id?: number
        }
        Relationships: []
      }
      configuracao: {
        Row: {
          chave: string
          configuracao_id: string
          created_at: string
          updated_at: string
          user_id: string | null
          valor: string | null
        }
        Insert: {
          chave: string
          configuracao_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          valor?: string | null
        }
        Update: {
          chave?: string
          configuracao_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      contas_pagar: {
        Row: {
          banco_id: string | null
          contas_pagar_id: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento_id: string | null
          fornecedor_id: string | null
          observacao: string | null
          pago: boolean
          valor: number
        }
        Insert: {
          banco_id?: string | null
          contas_pagar_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          observacao?: string | null
          pago?: boolean
          valor: number
        }
        Update: {
          banco_id?: string | null
          contas_pagar_id?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento_id?: string | null
          fornecedor_id?: string | null
          observacao?: string | null
          pago?: boolean
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_pagar_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "banco"
            referencedColumns: ["banco_id"]
          },
          {
            foreignKeyName: "contas_pagar_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "forma_pagamento"
            referencedColumns: ["forma_pagamento_id"]
          },
          {
            foreignKeyName: "contas_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["fornecedor_id"]
          },
        ]
      }
      contas_receber: {
        Row: {
          banco_id: string | null
          cliente_id: string | null
          contas_receber_id: string
          created_at: string
          data_recebimento: string | null
          data_vencimento: string
          descricao: string
          observacao: string | null
          pedido_id: string | null
          recebido: boolean
          valor: number
        }
        Insert: {
          banco_id?: string | null
          cliente_id?: string | null
          contas_receber_id?: string
          created_at?: string
          data_recebimento?: string | null
          data_vencimento: string
          descricao: string
          observacao?: string | null
          pedido_id?: string | null
          recebido?: boolean
          valor: number
        }
        Update: {
          banco_id?: string | null
          cliente_id?: string | null
          contas_receber_id?: string
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string
          descricao?: string
          observacao?: string | null
          pedido_id?: string | null
          recebido?: boolean
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "banco"
            referencedColumns: ["banco_id"]
          },
          {
            foreignKeyName: "contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "contas_receber_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      endereco: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string
          complemento: string | null
          created_at: string
          endereco_id: string
          estado: string
          logradouro: string
          numero: string | null
          observacao: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade: string
          complemento?: string | null
          created_at?: string
          endereco_id?: string
          estado: string
          logradouro: string
          numero?: string | null
          observacao?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          endereco_id?: string
          estado?: string
          logradouro?: string
          numero?: string | null
          observacao?: string | null
        }
        Relationships: []
      }
      estoque_local: {
        Row: {
          estoque_local_id: string
          local_estoque_id: string
          preco: number
          preco_custo: number | null
          preco_promocional: number | null
          produto_id: string
          quantidade_disponivel: number
          quantidade_pedida_nao_separada: number
        }
        Insert: {
          estoque_local_id?: string
          local_estoque_id: string
          preco?: number
          preco_custo?: number | null
          preco_promocional?: number | null
          produto_id: string
          quantidade_disponivel?: number
          quantidade_pedida_nao_separada?: number
        }
        Update: {
          estoque_local_id?: string
          local_estoque_id?: string
          preco?: number
          preco_custo?: number | null
          preco_promocional?: number | null
          produto_id?: string
          quantidade_disponivel?: number
          quantidade_pedida_nao_separada?: number
        }
        Relationships: [
          {
            foreignKeyName: "estoque_local_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "local_estoque"
            referencedColumns: ["local_estoque_id"]
          },
          {
            foreignKeyName: "estoque_local_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "estoque_local_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      fabricante: {
        Row: {
          ativo: boolean
          created_at: string
          fabricante_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fabricante_id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fabricante_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fabricante_endereco: {
        Row: {
          endereco_id: string
          fabricante_id: string
        }
        Insert: {
          endereco_id: string
          fabricante_id: string
        }
        Update: {
          endereco_id?: string
          fabricante_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fabricante_endereco_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "endereco"
            referencedColumns: ["endereco_id"]
          },
          {
            foreignKeyName: "fabricante_endereco_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricante"
            referencedColumns: ["fabricante_id"]
          },
        ]
      }
      familia: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          familia_id: string
          familia_pai_id: string | null
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          familia_id?: string
          familia_pai_id?: string | null
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          familia_id?: string
          familia_pai_id?: string | null
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "familia_familia_pai_id_fkey"
            columns: ["familia_pai_id"]
            isOneToOne: false
            referencedRelation: "familia"
            referencedColumns: ["familia_id"]
          },
        ]
      }
      forma_pagamento: {
        Row: {
          ativo: boolean
          forma_pagamento_id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          forma_pagamento_id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          forma_pagamento_id?: string
          nome?: string
        }
        Relationships: []
      }
      fornecedor: {
        Row: {
          ativo: boolean
          created_at: string
          fornecedor_id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fornecedor_id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fornecedor_id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fornecedor_endereco: {
        Row: {
          endereco_id: string
          fornecedor_id: string
        }
        Insert: {
          endereco_id: string
          fornecedor_id: string
        }
        Update: {
          endereco_id?: string
          fornecedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_endereco_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "endereco"
            referencedColumns: ["endereco_id"]
          },
          {
            foreignKeyName: "fornecedor_endereco_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["fornecedor_id"]
          },
        ]
      }
      fornecedor_produto: {
        Row: {
          fornecedor_id: string
          produto_id: string
        }
        Insert: {
          fornecedor_id: string
          produto_id: string
        }
        Update: {
          fornecedor_id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedor_produto_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["fornecedor_id"]
          },
          {
            foreignKeyName: "fornecedor_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "fornecedor_produto_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      integracao_log: {
        Row: {
          created_at: string
          erro: string | null
          integracao_log_id: string
          payload: Json | null
          resposta: Json | null
          status: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          erro?: string | null
          integracao_log_id?: string
          payload?: Json | null
          resposta?: Json | null
          status?: string | null
          tipo: string
        }
        Update: {
          created_at?: string
          erro?: string | null
          integracao_log_id?: string
          payload?: Json | null
          resposta?: Json | null
          status?: string | null
          tipo?: string
        }
        Relationships: []
      }
      local_estoque: {
        Row: {
          ativo: boolean
          created_at: string
          local_estoque_id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          local_estoque_id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          local_estoque_id?: string
          nome?: string
        }
        Relationships: []
      }
      local_estoque_endereco: {
        Row: {
          endereco_id: string
          local_estoque_id: string
        }
        Insert: {
          endereco_id: string
          local_estoque_id: string
        }
        Update: {
          endereco_id?: string
          local_estoque_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_estoque_endereco_endereco_id_fkey"
            columns: ["endereco_id"]
            isOneToOne: false
            referencedRelation: "endereco"
            referencedColumns: ["endereco_id"]
          },
          {
            foreignKeyName: "local_estoque_endereco_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "local_estoque"
            referencedColumns: ["local_estoque_id"]
          },
        ]
      }
      movimentacao_estoque: {
        Row: {
          created_at: string
          documento: string | null
          fornecedor_id: string | null
          local_estoque_destino_id: string | null
          local_estoque_id: string
          movimentacao_estoque_id: string
          observacao: string | null
          produto_id: string
          quantidade: number
          tipo: string
        }
        Insert: {
          created_at?: string
          documento?: string | null
          fornecedor_id?: string | null
          local_estoque_destino_id?: string | null
          local_estoque_id: string
          movimentacao_estoque_id?: string
          observacao?: string | null
          produto_id: string
          quantidade?: number
          tipo: string
        }
        Update: {
          created_at?: string
          documento?: string | null
          fornecedor_id?: string | null
          local_estoque_destino_id?: string | null
          local_estoque_id?: string
          movimentacao_estoque_id?: string
          observacao?: string | null
          produto_id?: string
          quantidade?: number
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimentacao_estoque_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedor"
            referencedColumns: ["fornecedor_id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_local_estoque_destino_id_fkey"
            columns: ["local_estoque_destino_id"]
            isOneToOne: false
            referencedRelation: "local_estoque"
            referencedColumns: ["local_estoque_id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "local_estoque"
            referencedColumns: ["local_estoque_id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "movimentacao_estoque_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      pedido: {
        Row: {
          cliente_id: string
          created_at: string
          data: string
          frete: number
          local_estoque_id: string | null
          observacao: string | null
          origem: Database["public"]["Enums"]["origem_pedido"]
          pedido_id: string
          status: Database["public"]["Enums"]["status_pedido"]
          total: number
          updated_at: string
          vendedor_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          data: string
          frete?: number
          local_estoque_id?: string | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_pedido"]
          pedido_id?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          data?: string
          frete?: number
          local_estoque_id?: string | null
          observacao?: string | null
          origem?: Database["public"]["Enums"]["origem_pedido"]
          pedido_id?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          total?: number
          updated_at?: string
          vendedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
          {
            foreignKeyName: "pedido_local_estoque_id_fkey"
            columns: ["local_estoque_id"]
            isOneToOne: false
            referencedRelation: "local_estoque"
            referencedColumns: ["local_estoque_id"]
          },
          {
            foreignKeyName: "pedido_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "cliente"
            referencedColumns: ["cliente_id"]
          },
        ]
      }
      pedido_item: {
        Row: {
          pedido_id: string
          pedido_item_id: string
          preco_unitario: number
          produto_id: string
          quantidade: number
        }
        Insert: {
          pedido_id: string
          pedido_item_id?: string
          preco_unitario: number
          produto_id: string
          quantidade: number
        }
        Update: {
          pedido_id?: string
          pedido_item_id?: string
          preco_unitario?: number
          produto_id?: string
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_item_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["pedido_id"]
          },
          {
            foreignKeyName: "pedido_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "pedido_item_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      pedido_pagamento: {
        Row: {
          banco_id: string | null
          comprovante_url: string | null
          created_at: string
          data_pagamento: string | null
          forma_pagamento_id: string | null
          observacao: string | null
          pedido_id: string
          pedido_pagamento_id: string
          valor: number
        }
        Insert: {
          banco_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          observacao?: string | null
          pedido_id: string
          pedido_pagamento_id?: string
          valor: number
        }
        Update: {
          banco_id?: string | null
          comprovante_url?: string | null
          created_at?: string
          data_pagamento?: string | null
          forma_pagamento_id?: string | null
          observacao?: string | null
          pedido_id?: string
          pedido_pagamento_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pagamento_banco_id_fkey"
            columns: ["banco_id"]
            isOneToOne: false
            referencedRelation: "banco"
            referencedColumns: ["banco_id"]
          },
          {
            foreignKeyName: "pedido_pagamento_forma_pagamento_id_fkey"
            columns: ["forma_pagamento_id"]
            isOneToOne: false
            referencedRelation: "forma_pagamento"
            referencedColumns: ["forma_pagamento_id"]
          },
          {
            foreignKeyName: "pedido_pagamento_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      pedido_status_historico: {
        Row: {
          data: string
          pedido_id: string
          pedido_status_historico_id: string
          status: Database["public"]["Enums"]["status_pedido"]
          usuario_id: string | null
        }
        Insert: {
          data?: string
          pedido_id: string
          pedido_status_historico_id?: string
          status: Database["public"]["Enums"]["status_pedido"]
          usuario_id?: string | null
        }
        Update: {
          data?: string
          pedido_id?: string
          pedido_status_historico_id?: string
          status?: Database["public"]["Enums"]["status_pedido"]
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_status_historico_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedido"
            referencedColumns: ["pedido_id"]
          },
        ]
      }
      produto: {
        Row: {
          aceita_fracionado: boolean
          altura: number | null
          ativo: boolean
          created_at: string
          descricao: string | null
          fabricante_id: string | null
          familia_id: string | null
          largura: number | null
          nome: string
          peso_bruto: number | null
          peso_liquido: number | null
          preco: number
          produto_id: string
          profundidade: number | null
          slug: string | null
          unidade_medida: Database["public"]["Enums"]["unidade_medida"]
          updated_at: string
        }
        Insert: {
          aceita_fracionado?: boolean
          altura?: number | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fabricante_id?: string | null
          familia_id?: string | null
          largura?: number | null
          nome: string
          peso_bruto?: number | null
          peso_liquido?: number | null
          preco?: number
          produto_id?: string
          profundidade?: number | null
          slug?: string | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Update: {
          aceita_fracionado?: boolean
          altura?: number | null
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fabricante_id?: string | null
          familia_id?: string | null
          largura?: number | null
          nome?: string
          peso_bruto?: number | null
          peso_liquido?: number | null
          preco?: number
          produto_id?: string
          profundidade?: number | null
          slug?: string | null
          unidade_medida?: Database["public"]["Enums"]["unidade_medida"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_fabricante_id_fkey"
            columns: ["fabricante_id"]
            isOneToOne: false
            referencedRelation: "fabricante"
            referencedColumns: ["fabricante_id"]
          },
          {
            foreignKeyName: "produto_familia_id_fkey"
            columns: ["familia_id"]
            isOneToOne: false
            referencedRelation: "familia"
            referencedColumns: ["familia_id"]
          },
        ]
      }
      produto_imagem: {
        Row: {
          ordem: number
          produto_id: string
          produto_imagem_id: string
          url_imagem: string
        }
        Insert: {
          ordem?: number
          produto_id: string
          produto_imagem_id?: string
          url_imagem: string
        }
        Update: {
          ordem?: number
          produto_id?: string
          produto_imagem_id?: string
          url_imagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_imagem_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produto"
            referencedColumns: ["produto_id"]
          },
          {
            foreignKeyName: "produto_imagem_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "vw_produtos_catalogo"
            referencedColumns: ["produto_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          nome: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          nome?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          nome?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_produtos_catalogo: {
        Row: {
          descricao: string | null
          estoques: Json | null
          fabricante: string | null
          familia: string | null
          imagem_principal: string | null
          nome: string | null
          peso_liquido: number | null
          preco: number | null
          produto_id: string | null
          unidade_medida: Database["public"]["Enums"]["unidade_medida"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      refresh_produtos_catalogo: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "vendedor" | "cliente"
      origem_pedido: "web" | "whatsapp" | "admin"
      status_pedido:
        | "carrinho"
        | "separacao"
        | "aguardando_pagamento"
        | "pago"
        | "enviado"
        | "entregue"
        | "cancelado"
      tipo_cliente: "cliente" | "vendedor" | "admin"
      unidade_medida:
        | "un"
        | "kg"
        | "g"
        | "l"
        | "ml"
        | "cx"
        | "pct"
        | "par"
        | "m"
        | "cm"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "vendedor", "cliente"],
      origem_pedido: ["web", "whatsapp", "admin"],
      status_pedido: [
        "carrinho",
        "separacao",
        "aguardando_pagamento",
        "pago",
        "enviado",
        "entregue",
        "cancelado",
      ],
      tipo_cliente: ["cliente", "vendedor", "admin"],
      unidade_medida: [
        "un",
        "kg",
        "g",
        "l",
        "ml",
        "cx",
        "pct",
        "par",
        "m",
        "cm",
      ],
    },
  },
} as const
