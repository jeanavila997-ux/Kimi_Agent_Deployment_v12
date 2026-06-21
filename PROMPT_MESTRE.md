# Prompt Mestre — Gerador de eBooks PWA Profissionais

> Template universal para criar ebooks interativos sobre qualquer tema.
> Preencha o briefing abaixo e o sistema gera o ebook completo automaticamente.

---

## 1. BRIEFING DO EBOOK

Preencha ou interprete os campos abaixo:

```json
{
  "ebook": {
    "tema": "TDAH na Vida Real",
    "nicho": "Saúde mental e organização pessoal",
    "publico_alvo": "Adultos com dificuldade de foco, rotina e produtividade",
    "problema_principal": "Falta de compreensão sobre o próprio cérebro, culpa excessiva",
    "objetivo": "Explicar o TDAH de forma simples e entregar estratégias práticas",
    "transformacao_prometida": "O leitor vai entender como seu cérebro funciona e ter ferramentas concretas",
    "nivel_conteudo": "Iniciante",
    "tom_de_linguagem": "Educativo, humano, simples, direto, acolhedor, não prescritivo",
    "num_capitulos": 8,
    "num_paginas_estimado": "25-40",
    "monetizacao": "Isca digital + venda de planner complementar",
    "cta_final": "Entrar no grupo ou baixar um planner complementar",
    "plataforma_venda": "Cakto / Kiwify",
    "formato_entrega": "PDF + PWA interativo",
    "disclaimer_medico": true,
    "preco_brl": 47.00,
    "preco_original_brl": 97.00
  }
}
```

**Para criar um ebook sobre OUTRO tema**, altere apenas:
- `tema` → seu tema
- `nicho` → seu nicho
- `publico_alvo` → quem vai ler
- `problema_principal` → dor principal
- `transformacao_prometida` → promessa
- `preco_brl` / `preco_original_brl` → preços

---

## 2. ESTRUTURA DE CAPÍTULOS

Cada capítulo segue um dos **8 tipos** abaixo. Escolha o tipo e preencha o conteúdo:

| Tipo | Função | Quando usar |
|------|--------|-------------|
| `introducao` | Apresenta o tema, definições, contexto | Sempre no Capítulo 1 |
| `fundamentos` | Conceitos técnicos, base científica | Capítulos 2-3 |
| `pratica` | Como o tema afeta a vida real | Meio do ebook |
| `solucoes` | Estratégias, métodos, passo a passo | Após apresentar o problema |
| `emocional` | Aspectos psicológicos, sentimentos | Quando relevante ao tema |
| `tecnico` | Dados, medicamentos, ferramentas | Quando precisa de profundidade |
| `acao` | Plano prático, checklists, exercícios | Próximo ao final |
| `conclusao` | Resumo, neuroplasticidade, CTA | Último capítulo |

### Template de capítulo:

```json
{
  "numero": 1,
  "titulo": "O que é TDAH?",
  "subtitulo": "Compreendendo o Transtorno",
  "icone": "🧠",
  "tipo": "introducao",
  "conteudo": {
    "definicao": "Texto explicativo...",
    "prevalencia": "5-8% das crianças",
    "tipos": [
      { "nome": "Tipo 1", "descricao": "Descrição..." }
    ],
    "destaques": ["Fato interessante 1", "Fato 2"],
    "has_quiz": true,
    "quiz_titulo": "Você se identifica?",
    "quiz_perguntas": [
      { "texto": "Pergunta?", "tipo": "likert" }
    ]
  }
}
```

---

## 3. COMO USAR ESTE TEMPLATE

### Opção A: Ebook sobre TDAH (padrão)
O briefing já vem preenchido com conteúdo sobre TDAH. Apenas faça o deploy.

### Opção B: Ebook sobre outro tema

1. **Copie** `briefings/briefing.json` para `briefings/meu-ebook.json`
2. **Edite** os campos do ebook (tema, público, problema...)
3. **Reescreva** os capítulos em `estrutura_capitulos` seguindo os 8 tipos
4. **Atualize** o glossário
5. **Altere** a referência no `index.html` (se mudar o nome do arquivo)
6. **Deploy** — pronto!

### Exemplos de temas que funcionam:

| Tema | Nicho | Público |
|------|-------|---------|
| Venvanse e Ritalina | Saúde/Farmacologia | Adultos com TDAH iniciando tratamento |
| Fisiologia hormonal | Saúde feminina | Mulheres 30-50 anos |
| Inteligência Emocional | Desenvolvimento pessoal | Profissionais de RH e liderança |
| Marketing Digital | Negócios | Empreendedores iniciantes |
| Ansiedade Generalizada | Saúde mental | Jovens adultos 18-35 |
| Sono de Qualidade | Bem-estar | Pessoas com insônia |
| Autismo no Adulto | Neurodiversidade | Adultos recém-diagnosticados |

---

## 4. STACK TÉCNICO

```
HTML5 + CSS3 + JS Vanilla (ES Modules)
├── PWA: manifest.json + service-worker.js
├── Supabase: Auth + Postgres + RLS (opcional)
├── Cakto: Pagamento via link hospedado (opcional)
├── Chart.js: Gráficos (vendorizado local)
└── jsPDF: Export PDF (vendorizado local)
```

**Zero bundler.** Deploy estático puro na Vercel.

---

## 5. REGRAS DE SEGURANÇA

1. **Nunca** commit chave secreta (service_role) no frontend
2. **CSP restritiva** em todas as páginas
3. **Preço em centavos** (× 100) ao gravar no banco
4. **Funciona 100% offline** — Supabase/Cakto são opcionais
5. **Disclaimer médico** fixo para conteúdo de saúde
6. **RLS** em toda tabela — usuário só acessa própria linha

---

## 6. ARQUITETURA DE ARQUIVOS

```
ebook-tdah/
├── briefings/
│   └── briefing.json          ← AQUI: edite para novo tema
├── index.html                 ← Shell (não precisa editar)
├── js/
│   ├── generator.js           ← Motor de geração (não edite)
│   ├── data.js                ← Proxy para generator (não edite)
│   ├── app.js                 ← UI controller (não edite)
│   ├── config.js              ← Chaves de integração (edite para ativar)
│   └── integrations.js        ← Auth/paywall (não edite)
├── css/                       ← Estilos (não precisa editar)
├── supabase/                  ← Schema + Edge Functions
└── docs/INTEGRACOES.md        ← Guia de setup Supabase/Cakto
```

---

## 7. FLUXO DE DADOS

```
briefings/briefing.json
       │
       ▼
  js/generator.js  →  gera estrutura + páginas + quizzes + glossário
       │
       ▼
  js/data.js       →  expõe dados para app.js
       │
       ▼
  js/app.js        →  renderiza UI
```

**Para um novo ebook: edite apenas `briefings/briefing.json`.**

---

## 8. DEPLOY

```bash
# Local (teste)
cd ebook-tdah
python3 -m http.server 3000

# Vercel (produção)
npx vercel --prod
```

---

*Template v1.0 — TDAH Descomplicado*
