import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { webhook_url, webhook_apikey, payload } = body;

    if (!webhook_url) {
      return new Response(
        JSON.stringify({ error: "webhook_url is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Forward to external webhook
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (webhook_apikey) headers["Authorization"] = `Bearer ${webhook_apikey}`;

    console.log("Sending webhook to:", webhook_url);

    const externalRes = await fetch(webhook_url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const responseText = await externalRes.text();
    console.log("Webhook response:", externalRes.status, responseText.slice(0, 200));

    // Log the integration
    await supabase.from("integracao_log").insert({
      tipo: "webhook_cobranca",
      status: externalRes.ok ? "sucesso" : "erro",
      payload,
      resposta: { status: externalRes.status, body: responseText },
      erro: externalRes.ok ? null : `HTTP ${externalRes.status}`,
    });

    if (!externalRes.ok) {
      return new Response(
        JSON.stringify({
          error: `Webhook retornou HTTP ${externalRes.status}`,
          body: responseText,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, response: responseText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook proxy error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
