# TDAH Descomplicado — Ebook PWA Interativo

> **Template universal** para criar eBooks interativos sobre qualquer tema.
> Basta editar `briefings/briefing.json` para gerar um novo ebook completo.

[🌐 Acessar Demo](https://w4oj7kzgiycno.kimi.page)

---

## ✨ Funcionalidades

| Recurso | Descrição |
|---------|-----------|
| 📱 **PWA** | Instalável, funciona offline, service worker |
| 🌓 **Dark/Light** | Toggle com persistência em localStorage |
| 📖 **eBook Gerado via JSON** | Conteúdo dinâmico a partir de briefing |
| 🎯 **3 Quizzes** | Autoavaliação, perfil de sintomas, estratégias |
| 📖 **Glossário** | 10+ termos pesquisáveis |
| 📥 **Export PDF** | Via jsPDF vendorizado |
| ⚕️ **Disclaimer Médico** | Fixo, LGPD-compliant |
| 🔐 **Auth Opcional** | Supabase (login/magic link) ou 100% offline |
| 💳 **Paywall Opcional** | Integração Cakto para monetização |
| ♿ **Acessível** | ARIA labels, skip link, reduced motion |
| 🔒 **CSP Restritiva** | Content Security Policy em todas as páginas |

---

## 🚀 Como Usar

### Clone o repositório

```bash
git clone https://github.com/jeanavila997-ux/tdah-descomplicado-ebook.git
cd tdah-descomplicado-ebook
```

### Rode localmente (sem servidor)

```bash
python3 -m http.server 3000
# Acesse: http://localhost:3000
```

### Crie um eBook sobre OUTRO tema

1. **Copie** o briefing:
```bash
cp briefings/briefing.json briefings/meu-ebook.json
```

2. **Edite** os campos no JSON: tema, público, capítulos, glossário

3. **Mude a referência** em `index.html` (linha do import do generator)

4. **Deploy** na Vercel:
```bash
npx vercel --prod
```

---

## 📁 Estrutura

```
├── briefings/
│   └── briefing.json           ← Edite aqui para novo tema
├── index.html                  ← Shell do app (não edite)
├── login.html                  ← Tela de auth
├── privacidade.html            ← Política LGPD
├── manifest.json               ← PWA manifest
├── service-worker.js           ← Cache-first, versionado
├── vercel.json                 ← Config deploy
├── css/
│   ├── main.css                ← Design tokens + dark/light
│   ├── components.css          ← Cards, accordion, timeline
│   └── auth-gateway.css        ← Paywall
├── js/
│   ├── generator.js            ← Motor de geração (não edite)
│   ├── main-controller.js      ← UI controller (não edite)
│   ├── config.js               ← Toggle Supabase/Cakto
│   ├── integrations.js         ← Auth, sync, leads, paywall
│   └── vendor/
│       ├── chart.min.js        ← Chart.js local
│       └── jspdf.umd.min.js    ← jsPDF local
├── assets/icons/               ← Ícones PWA (72-512px)
├── supabase/
│   ├── schema.sql              ← Profiles, user_state, leads, purchases (RLS)
│   └── functions/cakto-webhook/ ← Edge Function para pagamentos
├── docs/INTEGRACOES.md         ← Guia completo de integrações
└── PROMPT_MESTRE.md            ← Template universal para novos eBooks
```

---

## 🎨 8 Tipos de Capítulo

| Tipo | Função | Quando Usar |
|------|--------|-------------|
| `introducao` | Apresenta o tema, definições, contexto | Sempre no Cap. 1 |
| `fundamentos` | Conceitos técnicos, base científica | Caps. 2-3 |
| `pratica` | Como o tema afeta a vida real | Meio do ebook |
| `solucoes` | Estratégias, métodos, passo a passo | Após problema |
| `emocional` | Aspectos psicológicos, sentimentos | Quando relevante |
| `tecnico` | Dados, medicamentos, ferramentas | Quando precisa profundidade |
| `acao` | Plano prático, checklists, exercícios | Próximo ao final |
| `conclusao` | Resumo, neuroplasticidade, CTA | Último capítulo |

---

## 🔧 Stack Técnico

- **HTML5** + **CSS3** + **JS Vanilla** (ES Modules)
- **Zero bundler** — deploy estático puro
- **PWA**: manifest.json + service-worker.js (cache-first)
- **Supabase** (opcional): Auth + Postgres + RLS
- **Cakto** (opcional): Pagamento via link hospedado
- **Chart.js** + **jsPDF**: vendorizados localmente em `js/vendor/`

---

## 🔒 Segurança

1. ✅ Nenhuma chave secreta no frontend (apenas anon key)
2. ✅ CSP restritiva com whitelist explícita
3. ✅ Preço em centavos (× 100) — nunca float
4. ✅ Funciona 100% sem Supabase/Cakto (localStorage fallback)
5. ✅ Disclaimer médico fixo
6. ✅ RLS em toda tabela Supabase

---

## 📝 Licença

MIT — Livre para uso comercial e pessoal.
