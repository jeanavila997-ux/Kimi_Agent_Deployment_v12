/**
 * integrations.js — Auth, Sync, Leads e Paywall
 * ES Module — importado por app.js quando Supabase está disponível
 *
 * REGRAS:
 * 1. NUNCA armazenar service_role no frontend — apenas anon key
 * 2. Gravação de purchases SEMPRE via Edge Function
 * 3. Fallback completo para localStorage se Supabase off
 * 4. RLS: usuário só lê/escreve a própria linha
 */

import { CONFIG, STORAGE_KEYS } from './config.js';

// ==========================================
// SUPABASE CLIENT (lazy init)
// ==========================================
let supabase = null;

function getSupabaseClient() {
  if (supabase) return supabase;
  if (!CONFIG.isSupabaseEnabled) return null;
  if (!window.supabase?.createClient) return null;

  supabase = window.supabase.createClient(
    CONFIG.supabase.url,
    CONFIG.supabase.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: STORAGE_KEYS.authToken
      },
      db: {
        schema: 'public'
      }
    }
  );

  return supabase;
}

// ==========================================
// AUTH
// ==========================================

export async function signUp(email, password, metadata = {}) {
  const sb = getSupabaseClient();

  if (!sb) {
    // Modo offline: salva no localStorage
    const user = { email, id: 'local-' + Date.now(), metadata };
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
    localStorage.setItem(STORAGE_KEYS.authToken, 'local-token');
    return { user, error: null };
  }

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: window.location.origin + '/login.html'
    }
  });

  if (error) {
    console.error('[integrations.js] SignUp error:', error);
    return { user: null, error };
  }

  // Cria profile
  if (data.user) {
    await createProfile(data.user.id, metadata);
  }

  return { user: data.user, error: null };
}

export async function signIn(email, password) {
  const sb = getSupabaseClient();

  if (!sb) {
    const saved = localStorage.getItem(STORAGE_KEYS.user);
    const user = saved ? JSON.parse(saved) : null;
    if (user && user.email === email) {
      localStorage.setItem(STORAGE_KEYS.authToken, 'local-token');
      return { user, error: null };
    }
    return { user: null, error: { message: 'Email ou senha incorretos' } };
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('[integrations.js] SignIn error:', error);
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

export async function signInWithMagicLink(email) {
  const sb = getSupabaseClient();
  if (!sb) {
    return { error: { message: 'Modo offline — magic link não disponível' } };
  }

  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  });

  return { error };
}

export async function signOut() {
  const sb = getSupabaseClient();

  if (sb) {
    await sb.auth.signOut();
  }

  // Limpa localStorage
  localStorage.removeItem(STORAGE_KEYS.authToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.progress);

  window.location.reload();
}

export async function getCurrentUser() {
  const sb = getSupabaseClient();

  if (!sb) {
    const saved = localStorage.getItem(STORAGE_KEYS.user);
    return saved ? JSON.parse(saved) : null;
  }

  const { data: { user } } = await sb.auth.getUser();
  return user;
}

export async function getSession() {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  return session;
}

// ==========================================
// PROFILE
// ==========================================

async function createProfile(userId, metadata) {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from(CONFIG.supabase.tables.profiles)
    .insert({
      id: userId,
      email: metadata.email || '',
      full_name: metadata.full_name || '',
      created_at: new Date().toISOString()
    });

  if (error) console.error('[integrations.js] Profile error:', error);
}

export async function getProfile() {
  const sb = getSupabaseClient();
  const user = await getCurrentUser();
  if (!sb || !user) return null;

  const { data, error } = await sb
    .from(CONFIG.supabase.tables.profiles)
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('[integrations.js] GetProfile error:', error);
    return null;
  }

  return data;
}

// ==========================================
// PROGRESS SYNC
// ==========================================

export async function syncProgress(progress) {
  const sb = getSupabaseClient();
  const user = await getCurrentUser();

  // Sempre salva local
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));

  if (!sb || !user) {
    // Offline: queue para sync posterior
    queueForSync('progress', progress);
    return { success: true, offline: true };
  }

  const { error } = await sb
    .from(CONFIG.supabase.tables.userState)
    .upsert({
      user_id: user.id,
      progress: JSON.stringify(progress),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

  if (error) {
    queueForSync('progress', progress);
    return { success: false, error };
  }

  return { success: true, offline: false };
}

export async function loadRemoteProgress() {
  const sb = getSupabaseClient();
  const user = await getCurrentUser();
  if (!sb || !user) return null;

  const { data, error } = await sb
    .from(CONFIG.supabase.tables.userState)
    .select('progress')
    .eq('user_id', user.id)
    .single();

  if (error) return null;

  try {
    return JSON.parse(data.progress);
  } catch {
    return null;
  }
}

// ==========================================
// LEADS (captura de emails)
// ==========================================

export async function captureLead(email, source = 'ebook') {
  const sb = getSupabaseClient();

  const leadData = {
    email,
    source,
    page_reached: parseInt(localStorage.getItem(STORAGE_KEYS.lastPage) || '0'),
    created_at: new Date().toISOString(),
    user_agent: navigator.userAgent
  };

  if (!sb) {
    // Offline: salva na fila
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.leadsQueue) || '[]');
    queue.push(leadData);
    localStorage.setItem(STORAGE_KEYS.leadsQueue, JSON.stringify(queue));
    return { success: true, offline: true };
  }

  const { error } = await sb
    .from(CONFIG.supabase.tables.leads)
    .insert(leadData);

  if (error) {
    // Queue para retry
    const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.leadsQueue) || '[]');
    queue.push(leadData);
    localStorage.setItem(STORAGE_KEYS.leadsQueue, JSON.stringify(queue));
    return { success: false, error };
  }

  return { success: true };
}

// ==========================================
// PURCHASES
// ==========================================

/**
 * VERIFICA COMPRA — chama Edge Function com service_role
 * O frontend NUNCA grava diretamente na tabela purchases
 */
export async function verifyPurchase(email) {
  const sb = getSupabaseClient();
  if (!sb) {
    // Modo offline: verifica localStorage
    const purchases = JSON.parse(localStorage.getItem('tdah-ebook:purchases') || '[]');
    return { hasAccess: purchases.length > 0, purchases };
  }

  try {
    // Chama Edge Function que usa service_role para ler purchases
    const { data, error } = await sb.functions.invoke('cakto-webhook', {
      body: { action: 'verify', email: email }
    });

    if (error) throw error;
    return { hasAccess: data?.hasAccess || false, purchases: data?.purchases || [] };
  } catch (err) {
    console.error('[integrations.js] VerifyPurchase error:', err);
    return { hasAccess: false, purchases: [] };
  }
}

/**
 * Grava purchase no localStorage (modo offline)
 * Em produção com Supabase, isso é feito pela Edge Function via webhook
 */
export function recordLocalPurchase(payload) {
  /**
   * IMPORTANTE: Parsing de preço da Cakto
   * A Cakto envia valores monetários em REAIS com decimais.
   * Ex: { price: 47.00 } → gravar como 4700 centavos (inteiro)
   *
   * REGRA NÃO NEGOCIÁVEL: SEMPRE converter para centavos (× 100)
   * ao gravar no banco. Nunca gravar float de dinheiro.
   */
  const priceBRL = payload.price || payload.amount || 0;
  const priceCents = Math.round(priceBRL * 100);

  const purchase = {
    id: payload.id || 'local-' + Date.now(),
    product_id: payload.product_id || CONFIG.cakto.productId,
    email: payload.email || '',
    price_cents: priceCents, // ← CENTAVOS (inteiro), nunca float
    price_brl: priceBRL,     // ← apenas para referência/debug
    status: payload.status || 'completed',
    created_at: new Date().toISOString(),
    source: 'cakto_webhook'
  };

  const purchases = JSON.parse(localStorage.getItem('tdah-ebook:purchases') || '[]');
  purchases.push(purchase);
  localStorage.setItem('tdah-ebook:purchases', JSON.stringify(purchases));

  console.log(`[integrations.js] Purchase recorded: ${priceCents} cents (R$ ${priceBRL})`);
  return purchase;
}

// ==========================================
// OFFLINE QUEUE (para sync posterior)
// ==========================================

function queueForSync(type, data) {
  const queue = JSON.parse(localStorage.getItem('tdah-ebook:syncQueue') || '[]');
  queue.push({ type, data, timestamp: Date.now() });
  localStorage.setItem('tdah-ebook:syncQueue', JSON.stringify(queue));

  // Tenta sync se online
  if (navigator.onLine) {
    attemptSync();
  }
}

async function attemptSync() {
  const sb = getSupabaseClient();
  if (!sb) return;

  const queue = JSON.parse(localStorage.getItem('tdah-ebook:syncQueue') || '[]');
  if (queue.length === 0) return;

  const newQueue = [];

  for (const item of queue) {
    try {
      if (item.type === 'progress') {
        const user = await getCurrentUser();
        if (user) {
          const { error } = await sb.from(CONFIG.supabase.tables.userState)
            .upsert({
              user_id: user.id,
              progress: JSON.stringify(item.data),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
          
          if (error) {
            newQueue.push(item);
          }
        } else {
          newQueue.push(item);
        }
      }
    } catch {
      newQueue.push(item); // Falha: mantém na fila
    }
  }

  localStorage.setItem('tdah-ebook:syncQueue', JSON.stringify(newQueue));
}

// Escuta eventos online
window.addEventListener('online', attemptSync);

// ==========================================
// ANALYTICS (simplificado)
// ==========================================

export function trackEvent(event, properties = {}) {
  const payload = {
    event,
    properties: {
      ...properties,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      device: navigator.userAgent
    }
  };

  if (CONFIG.isSupabaseEnabled) {
    // Envia para Supabase (tabela analytics — se existir)
    // Implementação opcional
  }

  // Sempre log em development
  if ((typeof process !== 'undefined' && process?.env?.NODE_ENV === 'development') || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('[Analytics]', payload);
  }
}

// ==========================================
// INIT INTEGRATIONS
// ==========================================

export async function initIntegrations() {
  if (!CONFIG.isSupabaseEnabled) {
    console.log('[integrations.js] Modo offline — Supabase não configurado');
    return;
  }

  const sb = getSupabaseClient();
  if (!sb) return;

  // Verifica sessão existente
  const session = await getSession();
  if (session) {
    console.log('[integrations.js] Sessão ativa:', session.user.email);

    // Carrega progresso remoto
    const remote = await loadRemoteProgress();
    if (remote) {
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(remote));
    }
  }

  // Sync fila offline
  if (navigator.onLine) {
    attemptSync();
  }
}
