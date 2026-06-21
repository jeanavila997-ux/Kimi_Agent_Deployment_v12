# Guia de Integrações — TDAH Descomplicado Ebook PWA

## Visão Geral

Este documento descreve como conectar o ebook às plataformas externas: **Supabase** (backend) e **Cakto** (pagamentos).

> **Importante:** O app funciona 100% sem nenhuma integração. Todos os recursos operam via `localStorage`. As integrações são opcionais e ativadas via `js/config.js`.

---

## 1. SUPABASE (Auth + Database)

### 1.1 Criar Projeto

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em "New Project" e configure:
   - **Name:** `tdah-ebook` (ou qualquer nome)
   - **Database Password:** gere uma senha forte (guarde!)
   - **Region:** `sa-east-1` (São Paulo) para melhor latência no Brasil
3. Aguarde a criação (cerca de 2 minutos)

### 1.2 Obter Credenciais

No dashboard do projeto, vá em **Project Settings > API**:

| Campo | Onde usar | Segurança |
|-------|-----------|-----------|
| `Project URL` | `config.js` → `supabase.url` | Pública |
| `anon public` | `config.js` → `supabase.anonKey` | Pública |
| `service_role` | Edge Function (nunca no frontend!) | **SECRETA** |

### 1.3 Aplicar Schema

1. No dashboard, vá em **SQL Editor > New query**
2. Copie todo o conteúdo de `supabase/schema.sql`
3. Cole e execute (botão **Run**)
4. Verifique se as tabelas foram criadas em **Table Editor**

### 1.4 Configurar Auth

1. Vá em **Authentication > Providers > Email**
2. Ative **Confirm email** (opcional, recomendado)
3. Configure **Site URL** para seu domínio (ex: `https://tdah-ebook.vercel.app`)
4. Em **Authentication > URL Configuration**, adicione redirecionamentos:
   - `https://tdah-ebook.vercel.app/login.html`
   - `http://localhost:3000/login.html` (para desenvolvimento)

### 1.5 Ativar no Frontend

Edite `js/config.js`:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://SEU-PROJETO.supabase.co',        // ← Project URL
  anonKey: 'eyJ...',                               // ← anon public
  tables: {
    profiles: 'profiles',
    user_state: 'user_state',
    leads: 'leads',
    purchases: 'purchases'
  }
};
```

### 1.6 Deploy da Edge Function

```bash
# Instalar CLI do Supabase
npm install -g supabase

# Login
supabase login

# Linkar projeto
supabase link --project-ref SEU-PROJETO-REF

# Deploy da Edge Function
supabase functions deploy cakto-webhook

# Configurar secrets
supabase secrets set SUPABASE_URL=https://SEU-PROJETO.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
supabase secrets set CAKTO_WEBHOOK_SECRET=seu-secret-da-cakto
```

---

## 2. CAKTO (Pagamentos)

### 2.1 Criar Produto

1. Acesse [cakto.com.br](https://cakto.com.br) e crie uma conta
2. Vá em **Produtos > Novo Produto**
3. Configure:
   - **Nome:** `TDAH Descomplicado — Ebook Interativo`
   - **Preço:** R$ 47,00 (ou o valor desejado)
   - **Tipo:** Digital
4. Salve e copie o **link de checkout**

### 2.2 Configurar Webhook

1. Na Cakto, vá em **Configurações > Webhooks > Novo Webhook**
2. **URL:** `https://SEU-PROJETO.supabase.co/functions/v1/cakto-webhook`
3. **Eventos:**
   - `order.created`
   - `order.paid`
   - `order.refunded`
4. Copie o **Webhook Secret** e guarde

### 2.3 Ativar no Frontend

Edite `js/config.js`:

```javascript
const CAKTO_CONFIG = {
  checkoutUrl: 'https://pay.cakto.com.br/SEU-LINK',  // ← link do checkout
  productId: 'seu-product-id',                        // ← ID do produto na Cakto
  webhookSecret: null  // ← NÃO coloque aqui! Use na Edge Function
};
```

---

## 3. REGRAS DE SEGURANÇA

### 3.1 Chaves

| Tipo | Local | Uso |
|------|-------|-----|
| `anon key` | `config.js` | Frontend — autenticação do usuário |
| `service_role` | Edge Function | Backend — bypass RLS para purchases |
| `webhook secret` | Edge Function | Verificar assinatura dos webhooks da Cakto |

> **NUNCA** commit `service_role` no frontend. Se vazar, rotacione imediatamente no dashboard do Supabase.

### 3.2 Preços (Centavos)

**REGRA NÃO NEGOCIÁVEL:** A Cakto envia preços em REAIS com decimais. SEMPRE converter para centavos (× 100).

```
Cakto → 47.00 (REAIS)
Banco → 4700 (centavos, inteiro)
```

Esta conversão acontece em dois lugares:
1. **`supabase/functions/cakto-webhook/index.ts`** — Edge Function
2. **`js/config.js`** → `parseCaktoPrice()` — parser frontend (fallback)

### 3.3 RLS (Row Level Security)

Todas as tabelas têm RLS ativado. O usuário autenticado só acessa suas próprias linhas:

- `profiles` → `auth.uid() = id`
- `user_state` → `auth.uid() = user_id`
- `purchases` → **nenhum acesso direto** (via Edge Function)

---

## 4. FLUXO DE DADOS

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Usuário   │────▶│   Frontend  │────▶│  localStorage │
│             │     │  (HTML/JS)  │     │  (fallback)   │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    (se Supabase on)
                           │
                           ▼
                    ┌─────────────┐
                    │   Supabase  │
                    │    Auth     │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌─────────┐  ┌──────────┐  ┌───────────┐
        │ profiles│  │user_state│  │ purchases │
        └─────────┘  └──────────┘  └─────┬─────┘
                                          │
                    ┌─────────────────────┘
                    │ (webhook)
                    ▼
            ┌─────────────┐
            │    Cakto    │
            │  (pagamento)│
            └─────────────┘
```

---

## 5. VARIÁVEIS DE AMBIENTE

### Edge Function (Supabase Secrets)

```bash
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
CAKTO_WEBHOOK_SECRET=seu-webhook-secret
```

### Frontend (config.js)

```javascript
// Apenas chaves públicas!
supabase.url = 'https://SEU-PROJETO.supabase.co';
supabase.anonKey = 'eyJ...';
cakto.checkoutUrl = 'https://pay.cakto.com.br/...';
```

---

## 6. TESTE LOCAL

Sem Supabase configurado, o app roda 100% em localStorage:

```bash
# Servir arquivos estáticos
cd ebook-tdah
npx serve . -p 3000

# Ou Python
python3 -m http.server 3000
```

Acesse `http://localhost:3000` — tudo funciona offline.

---

## 7. DEPLOY (Vercel)

### 7.1 Via CLI

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 7.2 Via Git

1. Push para GitHub
2. Conecte o repo na [Vercel](https://vercel.com)
3. Framework preset: **Other** (estático puro)
4. Deploy automático a cada push

### 7.3 Configuração `vercel.json`

```json
{
  "version": 2,
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/$1" }
  ],
  "headers": [
    {
      "source": "/service-worker.js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    }
  ]
}
```

---

## 8. CHECKLIST PRÉ-LANÇAMENTO

- [ ] Schema SQL aplicado no Supabase
- [ ] RLS ativado em todas as tabelas
- [ ] Edge Function `cakto-webhook` deployada
- [ ] Secrets configurados na Edge Function
- [ ] Webhook da Cakto apontando para URL da Edge Function
- [ ] `config.js` com URL e anonKey do Supabase
- [ ] `config.js` com checkout URL da Cakto
- [ ] Teste de compra end-to-end (Cakto → webhook → Supabase)
- [ ] PWA testado (install, offline, SW)
- [ ] CSP validada em todas as páginas
- [ ] Nenhuma chave secreta no repositório
- [ ] `service-worker.js` com versão atualizada

---

## 9. SUPORTE

- **Supabase Docs:** [supabase.com/docs](https://supabase.com/docs)
- **Cakto Docs:** [help.cakto.com.br](https://help.cakto.com.br)
- **LGPD:** [gov.br/lgpd](https://www.gov.br/lgpd)
