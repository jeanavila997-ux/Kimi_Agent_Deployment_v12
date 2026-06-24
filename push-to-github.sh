#!/bin/bash
# push-to-github.sh — Envia o repositório para seu GitHub
# Uso: bash push-to-github.sh

echo "========================================"
echo "  Enviando eBook PWA para GitHub"
echo "  Perfil: @jeanavila997-ux"
echo "========================================"
echo ""

# Verifica se o git está instalado
if ! command -v git &> /dev/null; then
    echo "Erro: git não encontrado. Instale: https://git-scm.com/download"
    exit 1
fi

# Configura o remote para seu perfil
git remote remove origin 2>/dev/null
git remote add origin https://github.com/jeanavila997-ux/tdah-descomplicado-ebook.git

echo "Remote configurado:"
git remote -v
echo ""

# Tenta fazer o push
echo "Fazendo push para main..."
if git push -u origin main; then
    echo ""
    echo "Sucesso! Repositorio enviado:"
    echo "https://github.com/jeanavila997-ux/tdah-descomplicado-ebook"
else
    echo ""
    echo "O push falhou. Verifique:"
    echo "1. Voce tem uma conta no GitHub? Crie em github.com/signup"
    echo "2. Está logado? Configure com:"
    echo "   git config --global user.name 'Seu Nome'"
    echo "   git config --global user.email 'seu@email.com'"
    echo "3. Autentique via token ou SSH:"
    echo "   https://github.com/settings/tokens (Personal Access Token)"
    echo ""
    echo "Alternativa: faca upload manual do ZIP em github.com/new"
fi
