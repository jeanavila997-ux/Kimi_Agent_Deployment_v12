# Vendor Libraries

Coloque aqui as bibliotecas vendorizadas (baixadas localmente, não via CDN):

## Arquivos necessários:

1. **chart.min.js** — Chart.js v4.x
   - Download: https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js
   - Renomeie para: `chart.min.js`

2. **jspdf.umd.min.js** — jsPDF v2.x
   - Download: https://cdn.jsdelivr.net/npm/jspdf@2/dist/jspdf.umd.min.js
   - Renomeie para: `jspdf.umd.min.js`

> Essas libs são carregadas com `defer` no `index.html`. Se não estiverem presentes, o app funciona normalmente — apenas o export PDF e gráficos ficarão desabilitados.
