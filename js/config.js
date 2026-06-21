/**
 * config.js — Configurações e toggle de integrações
 *
 * REGRAS:
 * 1. Apenas chaves PÚBLICAS (anon/publishable). NUNCA service_role.
 * 2. Tudo funciona em localStorage se Supabase/Cakto não estiverem configurados.
 * 3. Todas as flags têm fallback explícito.
 */

// ==========================================
// SUPABASE — descomente e preencha para ativar
// ==========================================
const SUPABASE_CONFIG = {
  // URL do projeto Supabase (ex: 'https://abcdefgh12345678.supabase.co')
  url: null, // <-- substitua pela sua URL

  // Anon key (chave pública, começa com 'eyJ...')
  anonKey: null, // <-- substitua pela sua anon key

  // Tabelas
  tables: {
    profiles: 'profiles',
    userState: 'user_state',
    leads: 'leads',
    purchases: 'purchases'
  }
};

// ==========================================
// CAKTO — descomente e preencha para ativar pagamento
// ==========================================
const CAKTO_CONFIG = {
  // URL do checkout hospedado da Cakto
  checkoutUrl: null, // <-- ex: 'https://pay.cakto.com.br/abc123'

  // ID do produto na Cakto
  productId: null,

  // Webhook secret (usado apenas na Edge Function, NUNCA no frontend)
  webhookSecret: null // <-- mantenha null aqui; configure na Edge Function
};

// ==========================================
// FEATURE FLAGS
// ==========================================
const FEATURES = {
  // Exige login para acessar conteúdo completo
  authRequired: false,

  // Número de páginas gratuitas antes do paywall
  freePages: 5,

  // Habilita quiz interativo
  quizEnabled: true,

  // Habilita glossário
  glossaryEnabled: true,

  // Habilita exportação PDF
  pdfExportEnabled: true,

  // Habilita salvamento de progresso
  progressTracking: true,

  // Habilita modo offline (service worker)
  offlineMode: true,

  // Habilita tema claro/escuro
  themeToggle: true,

  // Analytics (plausible/vercel analytics)
  analytics: false
};

// ==========================================
// APP CONFIG
// ==========================================
export const CONFIG = {
  // Nome do ebook
  appName: 'TDAH Descomplicado',

  // Versão (deve bater com service-worker.js)
  version: '1.0.0',

  // Supabase
  supabase: SUPABASE_CONFIG,

  // Cakto
  cakto: CAKTO_CONFIG,

  // Features
  features: FEATURES,

  // Helpers
  get isSupabaseEnabled() {
    return !!(this.supabase.url && this.supabase.anonKey);
  },

  get isCaktoEnabled() {
    return !!this.cakto.checkoutUrl;
  },

  get isPaywallEnabled() {
    return this.features.authRequired || this.isCaktoEnabled;
  }
};

// ==========================================
// LOCALSTORAGE KEYS (namespaceado)
// ==========================================
export const STORAGE_KEYS = {
  theme: 'tdah-ebook:theme',
  progress: 'tdah-ebook:progress',
  bookmarks: 'tdah-ebook:bookmarks',
  fontSize: 'tdah-ebook:fontSize',
  quizResults: 'tdah-ebook:quizResults',
  user: 'tdah-ebook:user',
  authToken: 'tdah-ebook:authToken',
  lastPage: 'tdah-ebook:lastPage',
  installPrompt: 'tdah-ebook:installPrompt',
  // Leads capturados offline
  leadsQueue: 'tdah-ebook:leadsQueue',
  // Flags
  hasSeenDisclaimer: 'tdah-ebook:hasSeenDisclaimer',
  hasCompletedQuiz: 'tdah-ebook:hasCompletedQuiz'
};

// ==========================================
// PREÇO (em centavos para evitar floats)
// ==========================================
export const PRICING = {
  // Preço base em REAIS
  priceBRL: 47.00,

  // Em centavos (para gravação no banco — REGRA NÃO NEGOCIÁVEL)
  // Conversão: 47.00 * 100 = 4700 centavos
  get priceCents() {
    return Math.round(this.priceBRL * 100);
  },

  // Preço original (para mostrar desconto)
  originalPriceBRL: 97.00,

  get originalPriceCents() {
    return Math.round(this.originalPriceBRL * 100);
  }
};

/**
 * ==========================================
 * FUNÇÃO DE PARSING DE PREÇO DA CAKTO
 * ==========================================
 * REGRA: A Cakto envia valores monetários em REAIS com decimais.
 * SEMPRE converter para centavos (× 100) ao gravar no banco.
 *
 * Exemplo: payload da Cakto → { price: 47.00 }
 *          Banco → 4700 (centavos, inteiro)
 */
export function parseCaktoPrice(caktoPriceBRL) {
  // Validação: deve ser número positivo
  if (typeof caktoPriceBRL !== 'number' || caktoPriceBRL < 0) {
    console.error('[config.js] Preço inválido da Cakto:', caktoPriceBRL);
    return null;
  }

  // Conversão explícita: REAIS → CENTAVOS
  // Documentado conforme regra não negociável #3
  const cents = Math.round(caktoPriceBRL * 100);
  console.log(`[config.js] Preço convertido: R$ ${caktoPriceBRL.toFixed(2)} → ${cents} centavos`);

  return cents;
}

/**
 * Converte centavos de volta para REAIS (para exibição)
 */
export function formatPriceCents(cents) {
  if (typeof cents !== 'number') return 'R$ 0,00';
  const brl = (cents / 100).toFixed(2).replace('.', ',');
  return `R$ ${brl}`;
}

// ==========================================
// THEME
// ==========================================
export function getInitialTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  if (saved) return saved;

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}
