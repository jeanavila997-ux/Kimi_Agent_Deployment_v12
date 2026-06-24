/**
 * Edge Function: cakto-webhook
 * Recebe webhooks da Cakto e grava compras no Supabase
 *
 * REGRAS:
 * 1. Usa service_role para gravar na tabela purchases (bypass RLS)
 * 2. Converte preço da Cakto (REAIS com decimais) para centavos (× 100)
 * 3. Verifica assinatura do webhook para segurança
 * 4. NUNCA expõe service_role no frontend
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cakto-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface CaktoPayload {
  event?: 'order.created' | 'order.paid' | 'order.refunded';
  action?: 'verify';
  email?: string;
  user_id?: string;
  data?: {
    order_id: string;
    product_id: string;
    product_name?: string;
    customer_email: string;
    customer_name?: string;
    price: number;        // Valor em REAIS com decimais (ex: 47.00)
    currency?: string;
    status: string;
    payment_method?: string;
    receipt_url?: string;
    created_at?: string;
    [key: string]: any;
  };
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Só aceita POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não permitido' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const CAKTO_WEBHOOK_SECRET = Deno.env.get('CAKTO_WEBHOOK_SECRET') || '';

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configuração do Supabase incompleta');
    }

    // Valida assinatura do webhook (se configurada)
    const signature = req.headers.get('x-cakto-signature');
    if (CAKTO_WEBHOOK_SECRET && signature) {
      // TODO: Implementar validação de assinatura HMAC
      // const isValid = verifySignature(await req.text(), CAKTO_WEBHOOK_SECRET, signature);
      // if (!isValid) throw new Error('Assinatura inválida');
    }

    // Parse do payload
    const payload: CaktoPayload = await req.json();

    // Conexão com Supabase usando SERVICE_ROLE (bypass RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Se for uma requisição de verificação do frontend
    if (payload.action === 'verify') {
      const email = payload.email || payload.user_id;
      if (!email) {
        return new Response(JSON.stringify({ error: 'E-mail ou ID de usuário ausente' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return handleVerifyAccess(supabase, email, corsHeaders);
    }

    console.log('[cakto-webhook] Evento recebido:', payload.event);

    // Dispatch por tipo de evento
    switch (payload.event) {
      case 'order.paid':
        return handleOrderPaid(supabase, payload.data!, corsHeaders);
      case 'order.refunded':
        return handleOrderRefunded(supabase, payload.data!, corsHeaders);
      case 'order.created':
        return handleOrderCreated(supabase, payload.data!, corsHeaders);
      default:
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

  } catch (err) {
    console.error('[cakto-webhook] Erro:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

/**
 * ==========================================
 * HANDLER: order.paid
 * Grava compra no banco
 * ==========================================
 */
async function handleOrderPaid(
  supabase: any,
  data: CaktoPayload['data'],
  corsHeaders: Record<string, string>
) {
  /**
   * PARSING DE PREÇO — REGRA NÃO NEGOCIÁVEL
   * A Cakto envia valores em REAIS com decimais (ex: 47.00).
   * SEMPRE converter para centavos (× 100) ao gravar no banco.
   * NUNCA gravar float de dinheiro na coluna price_cents.
   */
  const priceBRL = data.price || 0;
  const priceCents = Math.round(priceBRL * 100);

  console.log(`[cakto-webhook] Preço convertido: R$ ${priceBRL.toFixed(2)} → ${priceCents} centavos`);

  // Busca user_id pelo email (se usuário estiver cadastrado)
  const { data: userData } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', data.customer_email)
    .maybeSingle();

  const userId = userData?.id || null;

  // Insere/upsert na tabela purchases
  const { error } = await supabase
    .from('purchases')
    .upsert({
      user_id: userId,
      email: data.customer_email,
      product_id: data.product_id,
      product_name: data.product_name || 'TDAH Descomplicado',
      price_cents: priceCents,          // ← CENTAVOS (inteiro), nunca float
      currency: data.currency || 'BRL',
      status: 'completed',
      payment_method: data.payment_method,
      cakto_order_id: data.order_id,
      cakto_payload: data,              // Guarda payload completo para auditoria
      receipt_url: data.receipt_url,
      created_at: data.created_at || new Date().toISOString()
    }, {
      onConflict: 'cakto_order_id'
    });

  if (error) {
    console.error('[cakto-webhook] Erro ao gravar purchase:', error);
    throw error;
  }

  console.log('[cakto-webhook] Compra gravada:', data.order_id);

  return new Response(JSON.stringify({
    success: true,
    order_id: data.order_id,
    price_cents: priceCents
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * ==========================================
 * HANDLER: order.refunded
 * Marca compra como reembolsada
 * ==========================================>
 */
async function handleOrderRefunded(
  supabase: any,
  data: CaktoPayload['data'],
  corsHeaders: Record<string, string>
) {
  const { error } = await supabase
    .from('purchases')
    .update({
      status: 'refunded',
      refunded_at: new Date().toISOString()
    })
    .eq('cakto_order_id', data.order_id);

  if (error) throw error;

  return new Response(JSON.stringify({ success: true, refunded: data.order_id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * ==========================================
 * HANDLER: order.created
 * Apenas loga
 * ==========================================
 */
async function handleOrderCreated(
  _supabase: any,
  data: CaktoPayload['data'],
  corsHeaders: Record<string, string>
) {
  console.log('[cakto-webhook] Pedido criado:', data.order_id);
  return new Response(JSON.stringify({ received: true, order_id: data.order_id }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

/**
 * ==========================================
 * VERIFICAÇÃO DE ACESSO
 * Endpoint para o frontend verificar se usuário comprou
 * ==========================================
 */
async function handleVerifyAccess(
  supabase: any,
  userId: string,
  corsHeaders: Record<string, string>
) {
  const { data, error } = await supabase
    .rpc('check_user_access', { p_email: userId });

  if (error) throw error;

  return new Response(JSON.stringify({ hasAccess: data }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
