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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- Parse params ---
    const url = new URL(req.url);
    let meses = 3;
    let clienteIdFilter: string | null = null;
    let limitParam: number | null = null;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        meses = Number(body.meses) || 3;
        clienteIdFilter = body.cliente_id ?? null;
        limitParam = body.limit ? Number(body.limit) : null;
      } catch { /* defaults */ }
    } else {
      meses = Number(url.searchParams.get("meses")) || 3;
      clienteIdFilter = url.searchParams.get("cliente_id") || null;
      limitParam = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : null;
    }
    if (meses < 1) meses = 3;

    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - meses);
    const cutoffISO = cutoffDate.toISOString();

    // --- Step 1: Get all pedidos (non-cancelled, non-cart) to find ultima_compra ---
    const { data: pedidos, error: pedidoError } = await supabase
      .from("pedido")
      .select("cliente_id, data")
      .not("status", "in", '("carrinho","cancelado")');

    if (pedidoError) throw new Error(pedidoError.message);

    // Group by cliente_id → max date
    const clienteMaxDate = new Map<string, string>();
    for (const p of pedidos || []) {
      const cur = clienteMaxDate.get(p.cliente_id);
      if (!cur || p.data > cur) clienteMaxDate.set(p.cliente_id, p.data);
    }

    // Filter inactive clients
    let inactiveIds: string[] = [];
    const ultimaCompraMap = new Map<string, string>();
    for (const [cid, lastDate] of clienteMaxDate) {
      if (lastDate >= cutoffISO) continue;
      if (clienteIdFilter && cid !== clienteIdFilter) continue;
      inactiveIds.push(cid);
      ultimaCompraMap.set(cid, lastDate);
    }

    // Sort by oldest first
    inactiveIds.sort((a, b) => (ultimaCompraMap.get(a)! > ultimaCompraMap.get(b)! ? 1 : -1));
    if (limitParam && limitParam > 0) inactiveIds = inactiveIds.slice(0, limitParam);

    if (inactiveIds.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Step 2: Fetch client details + clientewhats lid (parallel) ---
    const { data: clientes } = await supabase
      .from("cliente")
      .select("cliente_id, nome, clientewhats_id")
      .in("cliente_id", inactiveIds)
      .eq("ativo", true);

    const cwIds = (clientes || []).map(c => c.clientewhats_id).filter(Boolean) as number[];
    const cwPromise = cwIds.length > 0
      ? supabase.from("clientewhats").select("clientewhats_id, lid").in("clientewhats_id", cwIds)
      : Promise.resolve({ data: [] as { clientewhats_id: number; lid: string | null }[] });

    // --- Step 3: Fetch pedidos for these clients, then items ---
    const { data: clientePedidos } = await supabase
      .from("pedido")
      .select("pedido_id, cliente_id")
      .in("cliente_id", inactiveIds)
      .not("status", "in", '("carrinho","cancelado")');

    const pedidoClienteMap = new Map<string, string>();
    const allPedidoIds = (clientePedidos || []).map(p => {
      pedidoClienteMap.set(p.pedido_id, p.cliente_id);
      return p.pedido_id;
    });

    // Fetch items in batches (Supabase 1000 row limit)
    let allItems: { pedido_id: string; produto_id: string; quantidade: number; preco_unitario: number }[] = [];
    const batchSize = 200;
    const itemBatches = [];
    for (let i = 0; i < allPedidoIds.length; i += batchSize) {
      const batch = allPedidoIds.slice(i, i + batchSize);
      itemBatches.push(
        supabase.from("pedido_item").select("pedido_id, produto_id, quantidade, preco_unitario").in("pedido_id", batch)
      );
    }

    const [cwResult, ...itemResults] = await Promise.all([cwPromise, ...itemBatches]);

    const cwMap = new Map<number, string | null>();
    for (const cw of (cwResult.data || []) as any[]) cwMap.set(cw.clientewhats_id, cw.lid);

    for (const res of itemResults) {
      if (res.data) allItems.push(...res.data);
    }
    const pedidoItems = allItems;

    // --- Step 4: Fetch product + image + fabricante data ---
    const produtoIds = [...new Set(pedidoItems.map(pi => pi.produto_id))];

    let produtoMap = new Map<string, any>();
    if (produtoIds.length > 0) {
      const [prodResult, imgResult] = await Promise.all([
        supabase.from("produto").select("produto_id, nome, fabricante_id, peso_liquido, unidade_medida").in("produto_id", produtoIds),
        supabase.from("produto_imagem").select("produto_id, url_imagem, ordem").in("produto_id", produtoIds).order("ordem", { ascending: true }),
      ]);

      const fabIds = [...new Set((prodResult.data || []).map(p => p.fabricante_id).filter(Boolean))] as string[];
      let fabMap = new Map<string, string>();
      if (fabIds.length > 0) {
        const { data: fabs } = await supabase.from("fabricante").select("fabricante_id, nome").in("fabricante_id", fabIds);
        for (const f of fabs || []) fabMap.set(f.fabricante_id, f.nome);
      }

      const imgMap = new Map<string, string>();
      for (const img of imgResult.data || []) {
        if (!imgMap.has(img.produto_id)) imgMap.set(img.produto_id, img.url_imagem);
      }

      for (const p of prodResult.data || []) {
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

    // --- Step 5: Aggregate products per client ---
    const aggMap = new Map<string, { quantidade_total: number; precos: number[] }>();
    for (const pi of pedidoItems) {
      const cid = (pi.pedido as any).cliente_id;
      const key = `${cid}__${pi.produto_id}`;
      const agg = aggMap.get(key) || { quantidade_total: 0, precos: [] };
      agg.quantidade_total += Number(pi.quantidade);
      agg.precos.push(Number(pi.preco_unitario));
      aggMap.set(key, agg);
    }

    // --- Step 6: Build response ---
    const result = inactiveIds
      .map(cid => {
        const cliente = (clientes || []).find(c => c.cliente_id === cid);
        if (!cliente) return null;

        const lid = cliente.clientewhats_id ? cwMap.get(cliente.clientewhats_id) || null : null;

        const produtos: any[] = [];
        for (const [key, agg] of aggMap) {
          if (!key.startsWith(cid + "__")) continue;
          const prodId = key.split("__")[1];
          const prod = produtoMap.get(prodId);
          if (!prod) continue;
          const avgPreco = Math.round((agg.precos.reduce((s, v) => s + v, 0) / agg.precos.length) * 100) / 100;
          produtos.push({ ...prod, preco: avgPreco, quantidade_total: agg.quantidade_total });
        }
        produtos.sort((a, b) => b.quantidade_total - a.quantidade_total);

        return {
          cliente_id: cid,
          nome: cliente.nome,
          lid,
          ultima_compra: ultimaCompraMap.get(cid),
          produtos,
        };
      })
      .filter(Boolean);

    console.log(`Relatório: ${result.length} clientes inativos (${meses} meses)`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Relatório clientes inativos error:", message, err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
