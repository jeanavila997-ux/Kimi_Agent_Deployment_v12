import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('========================================');
console.log('  Validando eBook PWA...');
console.log('========================================\n');

let hasErrors = false;

function checkFile(relativeUrl) {
  const filePath = path.join(rootDir, relativeUrl);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ [ERRO] Arquivo ausente: ${relativeUrl}`);
    hasErrors = true;
    return false;
  }
  console.log(`✅ [OK] Arquivo encontrado: ${relativeUrl}`);
  return true;
}

// 1. Verificar arquivos estáticos essenciais
const essentialFiles = [
  'index.html',
  'login.html',
  'privacidade.html',
  'manifest.json',
  'service-worker.js',
  'js/config.js',
  'js/generator.js',
  'js/main-controller.js',
  'js/integrations.js',
  'briefings/briefing.json'
];

essentialFiles.forEach(checkFile);

// 2. Validar briefings/briefing.json
const briefingPath = path.join(rootDir, 'briefings/briefing.json');
if (fs.existsSync(briefingPath)) {
  try {
    const raw = fs.readFileSync(briefingPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.ebook || !parsed.ebook.tema) {
      throw new Error("Formato inválido: campo 'ebook.tema' ausente.");
    }
    console.log('✅ [OK] briefings/briefing.json é um JSON estruturado válido.');
  } catch (err) {
    console.error(`❌ [ERRO] Falha ao analisar briefings/briefing.json: ${err.message}`);
    hasErrors = true;
  }
}

console.log('\n========================================');
if (hasErrors) {
  console.error('❌ Validação FALHOU. Corrija os erros acima.');
  process.exit(1);
} else {
  console.log('🎉 Validação concluída com SUCESSO!');
  process.exit(0);
}
