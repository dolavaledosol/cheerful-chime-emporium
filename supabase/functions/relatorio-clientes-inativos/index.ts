import { createClient } from "npm:@supabase/supabase-js@2";

const defaultAllowedHeaders =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

const buildCorsHeaders = (req: Request) => ({
  "Access-Control-Allow-Origin": req.headers.get("origin") || "*",
  "Access-Control-Allow-Headers":
    req.headers.get("access-control-request-headers") || defaultAllowedHeaders,
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Headers",
});

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse parameters from query string (GET) or body (POST)
    let meses = 3;
    let clienteIdFilter: string | null = null;
    let limitParam: number | null = null;

    const url = new URL(req.url);

    if (req.method === "GET") {
      if (url.searchParams.has("meses")) meses = parseInt(url.searchParams.get("meses")!) || 3;
      clienteIdFilter = url.searchParams.get("cliente_id") || null;
      if (url.searchParams.has("limit")) limitParam = parseInt(url.searchParams.get("limit")!) || null;
    } else if (req.method === "POST") {
      try {
        const body = await req.json();
        meses = body.meses ?? 3;
        clienteIdFilter = body.cliente_id ?? null;
        limitParam = body.limit ?? null;
      } catch {
        // use defaults
      }
    }

    if (meses < 1) meses = 3;

    // Build the SQL query using CTEs for performance
    const sql = `
      WITH ultima_compra AS (
        SELECT
          p.cliente_id,
          MAX(p.data) AS ultima_compra
        FROM pedido p
        WHERE p.status NOT IN ('carrinho', 'cancelado')
        GROUP BY p.cliente_id
        HAVING MAX(p.data) < CURRENT_DATE - INTERVAL '${meses} months'
      ),
      clientes_inativos AS (
        SELECT
          c.cliente_id,
          c.nome,
          cw.lid,
          uc.ultima_compra
        FROM ultima_compra uc
        JOIN cliente c ON c.cliente_id = uc.cliente_id
        LEFT JOIN clientewhats cw ON cw.clientewhats_id = c.clientewhats_id
        WHERE c.ativo = true
        ${clienteIdFilter ? `AND c.cliente_id = '${clienteIdFilter.replace(/[^a-f0-9-]/gi, '')}'` : ""}
        ORDER BY uc.ultima_compra ASC
        ${limitParam && limitParam > 0 ? `LIMIT ${Math.floor(limitParam)}` : ""}
      ),
      produtos_comprados AS (
        SELECT
          p.cliente_id,
          pi.produto_id,
          pr.nome AS produto_nome,
          f.nome AS fabricante,
          pr.peso_liquido AS peso,
          pr.unidade_medida,
          (
            SELECT img.url_imagem
            FROM produto_imagem img
            WHERE img.produto_id = pi.produto_id
            ORDER BY img.ordem ASC
            LIMIT 1
          ) AS url_imagem,
          SUM(pi.quantidade) AS quantidade_total,
          ROUND(AVG(pi.preco_unitario), 2) AS preco
        FROM pedido p
        JOIN pedido_item pi ON pi.pedido_id = p.pedido_id
        JOIN produto pr ON pr.produto_id = pi.produto_id
        LEFT JOIN fabricante f ON f.fabricante_id = pr.fabricante_id
        WHERE p.cliente_id IN (SELECT cliente_id FROM clientes_inativos)
          AND p.status NOT IN ('carrinho', 'cancelado')
        GROUP BY p.cliente_id, pi.produto_id, pr.nome, f.nome, pr.peso_liquido, pr.unidade_medida
      )
      SELECT
        ci.cliente_id,
        ci.nome,
        ci.lid,
        ci.ultima_compra,
        COALESCE(
          json_agg(
            json_build_object(
              'produto_id', pc.produto_id,
              'nome', pc.produto_nome,
              'fabricante', pc.fabricante,
              'peso', pc.peso,
              'unidade_medida', pc.unidade_medida,
              'preco', pc.preco,
              'url_imagem', pc.url_imagem,
              'quantidade_total', pc.quantidade_total
            )
            ORDER BY pc.quantidade_total DESC
          ) FILTER (WHERE pc.produto_id IS NOT NULL),
          '[]'::json
        ) AS produtos
      FROM clientes_inativos ci
      LEFT JOIN produtos_comprados pc ON pc.cliente_id = ci.cliente_id
      GROUP BY ci.cliente_id, ci.nome, ci.lid, ci.ultima_compra
      ORDER BY ci.ultima_compra ASC;
    `;

    const { data, error } = await supabase.rpc("execute_raw_sql", { query: sql });

    // If the RPC doesn't exist, fallback to using postgrest REST query approach
    // We'll use the supabase client to run the query via the SQL editor endpoint
    if (error) {
      // Use fetch to call the Supabase REST API directly with the service role key
      const pgResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({}),
      });

      // Since we can't run raw SQL via RPC, let's do it step by step with the client
      // Step 1: Get inactive clients
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - meses);
      const cutoffISO = cutoffDate.toISOString();

      // Get all pedidos grouped by client with max date
      let pedidoQuery = supabase
        .from("pedido")
        .select("cliente_id, data")
        .not("status", "in", '("carrinho","cancelado")')
        .order("data", { ascending: false });

      const { data: pedidos, error: pedidoError } = await pedidoQuery;
      if (pedidoError) {
        console.error("Error fetching pedidos:", pedidoError);
        return new Response(JSON.stringify({ error: pedidoError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Group by cliente_id, get max date
      const clienteUltimaCompra = new Map<string, string>();
      for (const p of pedidos || []) {
        const existing = clienteUltimaCompra.get(p.cliente_id);
        if (!existing || p.data > existing) {
          clienteUltimaCompra.set(p.cliente_id, p.data);
        }
      }

      // Filter inactive
      const inactiveClienteIds: string[] = [];
      const ultimaCompraMap = new Map<string, string>();
      for (const [cid, lastDate] of clienteUltimaCompra) {
        if (lastDate < cutoffISO) {
          if (clienteIdFilter && cid !== clienteIdFilter) continue;
          inactiveClienteIds.push(cid);
          ultimaCompraMap.set(cid, lastDate);
        }
      }

      // Sort by ultima_compra ASC
      inactiveClienteIds.sort((a, b) => (ultimaCompraMap.get(a)! > ultimaCompraMap.get(b)! ? 1 : -1));

      // Apply limit
      const finalIds = limitParam && limitParam > 0 ? inactiveClienteIds.slice(0, limitParam) : inactiveClienteIds;

      if (finalIds.length === 0) {
        return new Response(JSON.stringify([]), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Step 2: Get client details
      const { data: clientes } = await supabase
        .from("cliente")
        .select("cliente_id, nome, clientewhats_id")
        .in("cliente_id", finalIds)
        .eq("ativo", true);

      // Get clientewhats for lid
      const cwIds = (clientes || []).map(c => c.clientewhats_id).filter(Boolean);
      let cwMap = new Map<number, string | null>();
      if (cwIds.length > 0) {
        const { data: cws } = await supabase
          .from("clientewhats")
          .select("clientewhats_id, lid")
          .in("clientewhats_id", cwIds);
        for (const cw of cws || []) {
          cwMap.set(cw.clientewhats_id, cw.lid);
        }
      }

      // Step 3: Get products for these clients
      const { data: pedidoItems } = await supabase
        .from("pedido_item")
        .select(`
          pedido_id,
          produto_id,
          quantidade,
          preco_unitario,
          pedido!inner(cliente_id, status)
        `)
        .in("pedido!inner.cliente_id", finalIds)
        .not("pedido.status", "in", '("carrinho","cancelado")');

      // Get unique product ids
      const produtoIds = [...new Set((pedidoItems || []).map(pi => pi.produto_id))];

      let produtoMap = new Map<string, any>();
      if (produtoIds.length > 0) {
        const { data: produtos } = await supabase
          .from("produto")
          .select("produto_id, nome, fabricante_id, peso_liquido, unidade_medida")
          .in("produto_id", produtoIds);

        const fabIds = [...new Set((produtos || []).map(p => p.fabricante_id).filter(Boolean))];
        let fabMap = new Map<string, string>();
        if (fabIds.length > 0) {
          const { data: fabs } = await supabase
            .from("fabricante")
            .select("fabricante_id, nome")
            .in("fabricante_id", fabIds);
          for (const f of fabs || []) fabMap.set(f.fabricante_id, f.nome);
        }

        const { data: imagens } = await supabase
          .from("produto_imagem")
          .select("produto_id, url_imagem, ordem")
          .in("produto_id", produtoIds)
          .order("ordem", { ascending: true });

        const imgMap = new Map<string, string>();
        for (const img of imagens || []) {
          if (!imgMap.has(img.produto_id)) imgMap.set(img.produto_id, img.url_imagem);
        }

        for (const p of produtos || []) {
          produtoMap.set(p.produto_id, {
            produto_id: p.produto_id,
            nome: p.nome,
            fabricante: p.fabricante_id ? fabMap.get(p.fabricante_id) || null : null,
            peso: p.peso_liquido,
            unidade_medida: p.unidade_medida,
            url_imagem: imgMap.get(p.produto_id) || null,
          });
        }
      }

      // Step 4: Aggregate products per client
      // key: `${cliente_id}__${produto_id}`
      const aggMap = new Map<string, { quantidade_total: number; precos: number[] }>();
      for (const pi of pedidoItems || []) {
        const pedido = pi.pedido as any;
        const cid = pedido.cliente_id;
        const key = `${cid}__${pi.produto_id}`;
        const existing = aggMap.get(key) || { quantidade_total: 0, precos: [] };
        existing.quantidade_total += Number(pi.quantidade);
        existing.precos.push(Number(pi.preco_unitario));
        aggMap.set(key, existing);
      }

      // Step 5: Build result
      const result = finalIds.map(cid => {
        const cliente = (clientes || []).find(c => c.cliente_id === cid);
        if (!cliente) return null;

        const lid = cliente.clientewhats_id ? cwMap.get(cliente.clientewhats_id) || null : null;

        const produtos: any[] = [];
        for (const [key, agg] of aggMap) {
          if (!key.startsWith(cid + "__")) continue;
          const prodId = key.split("__")[1];
          const prod = produtoMap.get(prodId);
          if (!prod) continue;
          const avgPreco = Math.round((agg.precos.reduce((a, b) => a + b, 0) / agg.precos.length) * 100) / 100;
          produtos.push({
            ...prod,
            preco: avgPreco,
            quantidade_total: agg.quantidade_total,
          });
        }
        produtos.sort((a, b) => b.quantidade_total - a.quantidade_total);

        return {
          cliente_id: cid,
          nome: cliente.nome,
          lid,
          ultima_compra: ultimaCompraMap.get(cid),
          produtos,
        };
      }).filter(Boolean);

      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Error:", message, err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
