# Sincronizacao — eBook PWA → Kimi_Agent_Deployment_v12

> Repositório de destino: `https://github.com/jeanavila997-ux/Kimi_Agent_Deployment_v12`

---

## Opcao 1: Git Bundle (Recomendada — nao precisa de auth)

O arquivo `ebook-tdah.bundle` contem todo o historico Git do projeto. Voce pode importa-lo no seu repo existente.

### Passo a passo:

```bash
# 1. Clone seu repositorio existente (se ainda nao tiver)
git clone https://github.com/jeanavila997-ux/Kimi_Agent_Deployment_v12.git
cd Kimi_Agent_Deployment_v12

# 2. Autentique no GitHub (se necessario)
#    Use Personal Access Token: github.com/settings/tokens

# 3. Importe o bundle como um novo remote
git remote add ebook-bundle /caminho/para/ebook-tdah.bundle
git fetch ebook-bundle

# 4. Veja o que vai ser importado
git log ebook-bundle/main --oneline

# 5. OPCAO A: Substitui tudo pelo conteudo do eBook
git checkout -B main ebook-bundle/main
git push origin main --force

# 5. OPCAO B: Preserva o historico existente e faz merge
git merge ebook-bundle/main --allow-unrelated-histories
# Resolva conflitos se houver, depois:
git push origin main

# 6. Limpe
git remote remove ebook-bundle
```

---

## Opcao 2: Push Direto (se ja tiver o repo clonado)

```bash
# Dentro da pasta do repositorio clonado:
cd Kimi_Agent_Deployment_v12

# Configure o remote
git remote add ebook https://github.com/jeanavila997-ux/Kimi_Agent_Deployment_v12.git

# Descompacte o ZIP do projeto sobre os arquivos existentes
# Depois:
git add -A
git commit -m "feat: adiciona eBook PWA Template Universal v2.1

- 8 capitulos gerados dinamicamente via briefing.json
- PWA completo com service worker e manifest
- 3 quizzes interativos + glossario pesquisavel
- Dark/light mode, export PDF, acessibilidade ARIA
- Supabase auth + Cakto paywall (opcionais)
- CSP restritiva, disclaimer medico, LGPD"

git push origin main
```

---

## Opcao 3: Upload Manual no GitHub (sem Git CLI)

1. Acesse: https://github.com/jeanavila997-ux/Kimi_Agent_Deployment_v12
2. Clique no botao **"Add file"** → **"Upload files"**
3. Arraste todos os arquivos do ZIP `ebook-tdah-github.zip`
4. Em "Commit changes", escreva:
   - **Commit message:** `feat: eBook PWA Template Universal v2.1`
   - **Description:** (copie do commit acima)
5. Clique **"Commit changes"**

---

## Estrutura que sera enviada

```
Kimi_Agent_Deployment_v12/
├── index.html              ← Shell do app PWA
├── login.html              ← Tela de autenticacao
├── privacidade.html        ← Politica LGPD
├── manifest.json           ← PWA manifest
├── service-worker.js       ← Cache-first versionado
├── vercel.json             ← Config deploy Vercel
├── push-to-github.sh       ← Script helper
├── .gitignore
├── README.md
├── PROMPT_MESTRE.md        ← Template universal
├── css/
│   ├── main.css            ← Design tokens + dark/light
│   ├── components.css      ← Cards, accordion, timeline
│   └── auth-gateway.css    ← Paywall styles
├── js/
│   ├── generator.js        ← Motor de geracao de ebooks
│   ├── main-controller.js  ← Controller UI
│   ├── config.js           ← Toggle Supabase/Cakto
│   ├── integrations.js     ← Auth, sync, leads
│   └── vendor/             ← chart.min.js + jspdf
├── briefings/
│   └── briefing.json       ← EDITE AQUI para novo tema
├── assets/icons/           ← 8 icones PWA (72-512px)
├── supabase/
│   ├── schema.sql          ← 5 tabelas com RLS
│   └── functions/          ← Edge Function Cakto
└── docs/
    └── INTEGRACOES.md      ← Guia completo
```

---

## Autenticacao no GitHub

Se o `git push` pedir senha, use um **Personal Access Token**:

1. Acesse: https://github.com/settings/tokens
2. Clique **"Generate new token (classic)"**
3. Marque o scope: `repo` (acesso completo aos repos)
4. Clique **"Generate token"**
5. Copie o token (so aparece uma vez!)
6. No terminal, quando pedir senha, cole o token

---

## Verificacao apos o push

Acesse: `https://github.com/jeanavila997-ux/Kimi_Agent_Deployment_v12`

Voce deve ver:
- 31 arquivos no repositorio
- 3 commits no historico
- README.md renderizado na pagina inicial
