/**
 * app.js — Controlador principal da UI
 * Modularizado por feature: navegação, render, quiz, theme, progress
 * 100% funcional sem Supabase — usa localStorage como fallback
 */

import { CONFIG, STORAGE_KEYS, getInitialTheme, setTheme } from './config.js';
import { generateEbook } from './generator.js';

// ==========================================
// DADOS DO EBOOK (gerados a partir do briefing)
// ==========================================
let ebookCache = null;

async function loadData() {
  if (!ebookCache) {
    try {
      ebookCache = await generateEbook();
    } catch (err) {
      console.error('[app] Falha no generator:', err);
    }
  }
  return ebookCache;
}

function getData() {
  return ebookCache || { structure: {}, pages: [], quizzes: {}, glossary: [] };
}

function getPages() { return getData().pages || []; }
function getQuizzes() { return getData().quizzes || {}; }
function getGlossary() { return getData().glossary || []; }
function getStructure() { return getData().structure || {}; }

// ==========================================
// ESTADO GLOBAL
// ==========================================
let state = {
  currentPage: 0,
  totalPages: 0,
  bookmarks: new Set(),
  theme: getInitialTheme(),
  fontSize: parseInt(localStorage.getItem(STORAGE_KEYS.fontSize)) || 16,
  quizResults: JSON.parse(localStorage.getItem(STORAGE_KEYS.quizResults) || '[]'),
  isNavOpen: false
};

// Referências DOM (cacheadas)
let $ = {};

// ==========================================
// INIT
// ==========================================
export async function init() {
  cacheDOM();

  // Carrega dados do ebook (generator → briefing.json)
  try {
    await loadData();
    const data = getData();
    state.totalPages = (data?.pages || []).length;
    console.log('[app.js] Dados carregados:', state.totalPages, 'páginas');
  } catch (err) {
    console.error('[app.js] Erro ao carregar dados:', err);
    showLoadError();
    return;
  }

  setupTheme();
  setupEventListeners();
  setupNavigation();
  setupGlossary();
  loadProgress();

  if (state.totalPages > 0) {
    // Atualiza título da página
    const structure = getStructure();
    if (structure?.title) {
      document.title = `${structure.title} — Ebook Interativo`;
    }
    renderPage(state.currentPage);
    setupAccordion();
  } else {
    showLoadError();
  }

  setupServiceWorker();
  setupPaywall();

  console.log('[app.js] Inicializado — modo:', CONFIG.isSupabaseEnabled ? 'online' : 'offline');
}

function showLoadError() {
  if ($.contentArea) {
    $.contentArea.innerHTML = `
      <div class="error-state">
        <p>⚠️ Nenhum conteúdo encontrado.</p>
        <p style="font-size:0.85rem;color:var(--text-muted);margin-top:0.5rem;">
          Verifique se o arquivo briefings/briefing.json está presente.
        </p>
      </div>
    `;
  }
}

function cacheDOM() {
  $ = {
    contentArea: document.getElementById('content-area'),
    breadcrumb: document.getElementById('breadcrumb'),
    pageIndicator: document.getElementById('page-indicator'),
    progressFill: document.getElementById('progress-fill'),
    navDrawer: document.getElementById('nav-drawer'),
    navOverlay: document.getElementById('nav-overlay'),
    navList: document.getElementById('nav-list'),
    btnMenu: document.getElementById('btn-menu'),
    btnClose: document.getElementById('nav-close'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnBookmark: document.getElementById('btn-bookmark'),
    btnTextSize: document.getElementById('btn-text-size'),
    btnGlossary: document.getElementById('btn-glossary'),
    btnDownloadPdf: document.getElementById('btn-download-pdf'),
    themeToggle: document.getElementById('theme-toggle'),
    glossaryModal: document.getElementById('glossary-modal'),
    quizModal: document.getElementById('quiz-modal'),
    toastContainer: document.getElementById('toast-container')
  };
}

// ==========================================
// THEME
// ==========================================
function setupTheme() {
  setTheme(state.theme);
  $.themeToggle?.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    setTheme(state.theme);
  });
}

// ==========================================
// EVENT LISTENERS
// ==========================================
function setupEventListeners() {
  // Nav
  $.btnMenu?.addEventListener('click', openNav);
  $.btnClose?.addEventListener('click', closeNav);
  $.navOverlay?.addEventListener('click', closeNav);

  // Page nav
  $.btnPrev?.addEventListener('click', goPrev);
  $.btnNext?.addEventListener('click', goNext);

  // Keyboard
  document.addEventListener('keydown', handleKeydown);

  // Bookmark
  $.btnBookmark?.addEventListener('click', toggleBookmark);

  // Font size
  $.btnTextSize?.addEventListener('click', cycleFontSize);

  // Glossary
  $.btnGlossary?.addEventListener('click', openGlossary);
  $.glossaryModal?.querySelector('.modal-close')?.addEventListener('click', closeGlossary);

  // PDF
  $.btnDownloadPdf?.addEventListener('click', downloadPDF);

  // Quiz close
  $.quizModal?.querySelector('.modal-close')?.addEventListener('click', closeQuiz);

  // Search glossary
  document.getElementById('glossary-search')?.addEventListener('input', handleGlossarySearch);

  // Touch swipe
  setupSwipe();
}

function handleKeydown(e) {
  if (isModalOpen()) return;

  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      goPrev();
      break;
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
      e.preventDefault();
      goNext();
      break;
    case 'Escape':
      closeNav();
      closeGlossary();
      closeQuiz();
      break;
  }
}

function isModalOpen() {
  return $.glossaryModal?.open || $.quizModal?.open;
}

// ==========================================
// NAVIGATION
// ==========================================
function openNav() {
  $.navDrawer?.classList.add('open');
  $.navOverlay?.classList.add('active');
  state.isNavOpen = true;
  document.body.style.overflow = 'hidden';
}

function closeNav() {
  $.navDrawer?.classList.remove('open');
  $.navOverlay?.classList.remove('active');
  state.isNavOpen = false;
  document.body.style.overflow = '';
}

function setupNavigation() {
  if (!$.navList) return;

  $.navList.innerHTML = getPages().map((page, index) => {
    const isActive = index === state.currentPage;
    const isChapter = page.type === 'chapter-cover';
    const icon = isChapter ? '📑' : (page.type === 'quiz' ? '🎯' : '📄');

    return `
      <li>
        <button
          class="${isActive ? 'active' : ''}"
          data-page="${index}"
          onclick="window.__navigateTo(${index})"
        >
          <span class="nav-item-number">${icon}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${page.title}
          </span>
          <span class="nav-item-type">${isChapter ? 'Cap' : (page.type === 'quiz' ? 'Quiz' : page.number)}</span>
        </button>
      </li>
    `;
  }).join('');
}

// Expose para onclick inline
window.__navigateTo = (index) => {
  goToPage(index);
  closeNav();
};

function goToPage(index) {
  if (index < 0 || index >= state.totalPages) return;

  // Paywall check
  if (CONFIG.features.authRequired && index >= CONFIG.features.freePages) {
    if (!isUserAuthenticated()) {
      showPaywall();
      return;
    }
  }

  state.currentPage = index;
  renderPage(index);
  saveProgress();
  updateNavActive();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goPrev() {
  goToPage(state.currentPage - 1);
}

function goNext() {
  goToPage(state.currentPage + 1);
}

function updateNavActive() {
  $.navList?.querySelectorAll('button').forEach((btn, i) => {
    btn.classList.toggle('active', i === state.currentPage);
  });
}

// Swipe
function setupSwipe() {
  let startX = 0;
  let startY = 0;

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, { passive: true });
}

// ==========================================
// RENDER
// ==========================================
function renderPage(index) {
  const pages = getPages();
  const page = pages[index];
  if (!page) return;

  // Atualiza breadcrumb
  const structure = getStructure();
  const chapter = structure.chapters?.find(c => c.id === page.chapterId);
  if ($.breadcrumb) {
    $.breadcrumb.innerHTML = chapter
      ? `<span>${chapter.title}</span><span style="color:var(--text-muted);margin:0 0.5rem;">›</span><span>${page.title}</span>`
      : `<span>${page.title}</span>`;
  }

  // Atualiza indicador
  if ($.pageIndicator) {
    $.pageIndicator.textContent = `${page.number} / ${pages.length}`;
  }

  // Atualiza progresso
  const progress = ((index + 1) / state.totalPages) * 100;
  if ($.progressFill) {
    $.progressFill.style.width = `${progress}%`;
  }

  // Renderiza conteúdo
  if ($.contentArea) {
    if (page.type === 'chapter-cover') {
      renderChapterCover(page);
    } else if (page.type === 'quiz') {
      renderQuizPlaceholder(page);
    } else {
      renderContent(page);
    }
  }

  // Atualiza botões
  if ($.btnPrev) $.btnPrev.disabled = index === 0;
  if ($.btnNext) $.btnNext.disabled = index === state.totalPages - 1;

  // Bookmark icon
  updateBookmarkIcon();
}

function renderChapterCover(page) {
  $.contentArea.innerHTML = `
    <div class="cover-page">
      <div style="font-size:4rem;margin-bottom:1rem;">${page.icon || '📖'}</div>
      <span class="badge badge-primary" style="margin-bottom:1rem;">${page.title}</span>
      <h1 class="chapter-title" style="margin-top:1rem;">${page.subtitle}</h1>
      <button class="btn btn-primary btn-large" onclick="window.__navigateTo(${state.currentPage + 1})" style="margin-top:2rem;">
        Começar Capítulo →
      </button>
    </div>
  `;
}

function renderContent(page) {
  $.contentArea.innerHTML = `
    <article>
      <h1 class="chapter-title">${page.title}</h1>
      ${page.content || '<p>Conteúdo em breve...</p>'}
    </article>
  `;

  // Re-inicializa accordion no novo conteúdo
  setupAccordion();

  // Re-attach checklist listeners
  setupChecklist();
}

function renderQuizPlaceholder(page) {
  const quiz = getQuizzes()[page.quizId];
  $.contentArea.innerHTML = `
    <div style="text-align:center;padding:3rem 1rem;">
      <div style="font-size:3rem;margin-bottom:1rem;">🎯</div>
      <h2 class="chapter-title">${quiz?.title || page.title}</h2>
      <p style="color:var(--text-secondary);margin-bottom:2rem;">${quiz?.description || ''}</p>
      <button class="btn btn-primary btn-large" onclick="window.__startQuiz('${page.quizId}')">
        Iniciar Quiz
      </button>
    </div>
  `;
}

// ==========================================
// ACCORDION
// ==========================================
function setupAccordion() {
  document.querySelectorAll('.accordion-trigger').forEach(trigger => {
    // Remove listeners antigos clonando
    const newTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(newTrigger, trigger);

    newTrigger.addEventListener('click', () => {
      const isExpanded = newTrigger.getAttribute('aria-expanded') === 'true';
      newTrigger.setAttribute('aria-expanded', !isExpanded);
      const panel = newTrigger.nextElementSibling;
      panel.classList.toggle('open', !isExpanded);
    });
  });
}

// ==========================================
// CHECKLIST
// ==========================================
function setupChecklist() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}');
  const checkedDays = saved.checkedDays || [];

  document.querySelectorAll('.checklist-checkbox').forEach(checkbox => {
    const day = checkbox.dataset.day;
    if (checkedDays.includes(day)) {
      checkbox.classList.add('checked');
      checkbox.innerHTML = '✓';
    }

    checkbox.addEventListener('click', () => {
      const isChecked = checkbox.classList.toggle('checked');
      checkbox.innerHTML = isChecked ? '✓' : '';

      const days = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}').checkedDays || [];
      if (isChecked) {
        days.push(day);
      } else {
        const idx = days.indexOf(day);
        if (idx > -1) days.splice(idx, 1);
      }
      saved.checkedDays = [...new Set(days)];
      localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(saved));
    });
  });
}

// ==========================================
// QUIZ
// ==========================================
window.__startQuiz = (quizId) => {
  const quiz = getQuizzes()[quizId];
  if (!quiz) return;

  if (quizId === 'quiz-estrategias') {
    renderStrategyQuiz(quiz);
  } else {
    renderScoredQuiz(quiz, quizId);
  }

  $.quizModal?.showModal();
};

function renderScoredQuiz(quiz, quizId) {
  const body = document.getElementById('quiz-body');
  let currentQ = 0;
  let score = 0;

  function renderQuestion() {
    const q = quiz.questions[currentQ];
    body.innerHTML = `
      <div class="quiz-question">
        <div class="stepper" style="margin-bottom:1.5rem;">
          ${quiz.questions.map((_, i) => `
            <div class="step">
              <div class="step-dot ${i === currentQ ? 'active' : i < currentQ ? 'completed' : ''}">${i + 1}</div>
            </div>
            ${i < quiz.questions.length - 1 ? '<div class="step-connector ' + (i < currentQ ? 'completed' : '') + '"></div>' : ''}
          `).join('')}
        </div>
        <p class="quiz-question-text">${q.text}</p>
        <div class="quiz-options">
          ${q.options.map((opt, i) => `
            <label class="quiz-option">
              <input type="radio" name="q${currentQ}" value="${opt.score}" style="display:none;">
              <span style="flex:1;">${opt.text}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;

    body.querySelectorAll('.quiz-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const input = opt.querySelector('input');
        if (input) {
          input.checked = true;
          score += parseInt(input.value) || 0;
          currentQ++;
          if (currentQ < quiz.questions.length) {
            renderQuestion();
          } else {
            showQuizResult(quiz, score, quizId);
          }
        }
      });
    });
  }

  renderQuestion();
}

function renderStrategyQuiz(quiz) {
  const body = document.getElementById('quiz-body');
  const q = quiz.questions[0];

  body.innerHTML = `
    <div class="quiz-question">
      <p class="quiz-question-text">${q.text}</p>
      <div class="quiz-options">
        ${q.options.map(opt => `
          <button class="quiz-option" data-result="${opt.result}" style="text-align:left;">
            <span style="flex:1;">${opt.text}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  body.querySelectorAll('.quiz-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const result = btn.dataset.result;
      const message = quiz.resultMessages?.[result] || 'Estratégia selecionada!';
      body.innerHTML = `
        <div class="quiz-result">
          <div class="quiz-result-score">💡</div>
          <h3 style="margin-bottom:1rem;">Sua Estratégia Ideal</h3>
          <p style="color:var(--text-secondary);margin-bottom:2rem;">${message}</p>
          <button class="btn btn-primary" onclick="window.__closeQuiz()">Fechar</button>
        </div>
      `;
    });
  });
}

function showQuizResult(quiz, score, quizId) {
  const body = document.getElementById('quiz-body');
  const result = quiz.results?.find(r => score >= r.min && score <= r.max);

  body.innerHTML = `
    <div class="quiz-result">
      <div class="quiz-result-score">${score}</div>
      <h3 style="margin-bottom:0.5rem;">${result?.label || 'Resultado'}</h3>
      <p style="color:var(--text-secondary);margin-bottom:2rem;">${result?.description || ''}</p>
      <button class="btn btn-primary" onclick="window.__closeQuiz()">Fechar</button>
    </div>
  `;

  // Salva resultado
  state.quizResults.push({ quizId, score, date: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEYS.quizResults, JSON.stringify(state.quizResults));
}

window.__closeQuiz = () => {
  $.quizModal?.close();
};

function closeQuiz() {
  $.quizModal?.close();
}

// ==========================================
// GLOSSARY
// ==========================================
function setupGlossary() {
  const list = document.getElementById('glossary-list');
  if (!list) return;

  list.innerHTML = getGlossary().map(item => `
    <div class="glossary-item" data-term="${item.term.toLowerCase()}">
      <span class="term-category">${item.category}</span>
      <dt>${item.term}</dt>
      <dd>${item.definition}</dd>
    </div>
  `).join('');
}

function handleGlossarySearch(e) {
  const query = e.target.value.toLowerCase();
  document.querySelectorAll('.glossary-item').forEach(item => {
    const term = item.dataset.term;
    item.style.display = term.includes(query) ? '' : 'none';
  });
}

function openGlossary() {
  setupGlossary();
  $.glossaryModal?.showModal();
}

function closeGlossary() {
  $.glossaryModal?.close();
}

// ==========================================
// BOOKMARKS
// ==========================================
function toggleBookmark() {
  const pageNum = state.currentPage;
  if (state.bookmarks.has(pageNum)) {
    state.bookmarks.delete(pageNum);
    showToast('🔖 Marcador removido');
  } else {
    state.bookmarks.add(pageNum);
    showToast('🔖 Página marcada');
  }
  updateBookmarkIcon();
  saveProgress();
}

function updateBookmarkIcon() {
  const isMarked = state.bookmarks.has(state.currentPage);
  if ($.btnBookmark) {
    $.btnBookmark.style.opacity = isMarked ? '1' : '0.5';
    $.btnBookmark.style.color = isMarked ? 'var(--color-primary)' : '';
  }
}

// ==========================================
// FONT SIZE
// ==========================================
function cycleFontSize() {
  const sizes = [14, 16, 18, 20];
  const currentIdx = sizes.indexOf(state.fontSize);
  state.fontSize = sizes[(currentIdx + 1) % sizes.length];

  document.documentElement.style.fontSize = `${state.fontSize}px`;
  localStorage.setItem(STORAGE_KEYS.fontSize, state.fontSize);

  showToast(`🔤 Tamanho: ${state.fontSize}px`);
}

// ==========================================
// PROGRESS
// ==========================================
function saveProgress() {
  const data = {
    currentPage: state.currentPage,
    bookmarks: [...state.bookmarks],
    lastRead: new Date().toISOString(),
    checkedDays: JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}').checkedDays || []
  };
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data));
  localStorage.setItem(STORAGE_KEYS.lastPage, state.currentPage);
}

function loadProgress() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || '{}');
  state.currentPage = saved.currentPage || 0;
  state.bookmarks = new Set(saved.bookmarks || []);

  const lastPage = parseInt(localStorage.getItem(STORAGE_KEYS.lastPage));
  if (!isNaN(lastPage)) state.currentPage = lastPage;
}

// ==========================================
// PDF EXPORT
// ==========================================
function downloadPDF() {
  showToast('📥 Gerando PDF...');

  // Verifica se jsPDF está disponível
  if (typeof jspdf === 'undefined') {
    showToast('⏳ Carregando biblioteca de PDF...');
    // Fallback: tenta novamente em 1s
    setTimeout(downloadPDF, 1000);
    return;
  }

  try {
    const { jsPDF } = jspdf;
    const doc = new jsPDF();

    // Título
    doc.setFontSize(20);
    doc.text('TDAH Descomplicado', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Ebook Interativo — Resumo', 105, 30, { align: 'center' });

    let y = 50;
    doc.setFontSize(10);

    getPages().forEach(page => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(`${page.number}. ${page.title}`, 20, y);
      y += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Extrai texto simples do HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = page.content || '';
      const text = tempDiv.textContent || '';
      const lines = doc.splitTextToSize(text, 170);

      lines.slice(0, 5).forEach(line => {
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
        doc.text(line, 20, y);
        y += 5;
      });

      y += 10;
    });

    doc.save('tdah-descomplicado.pdf');
    showToast('✅ PDF baixado!');
  } catch (err) {
    console.error('[app.js] Erro PDF:', err);
    showToast('❌ Erro ao gerar PDF');
  }
}

// ==========================================
// TOAST
// ==========================================
function showToast(message) {
  if (!$.toastContainer) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  $.toastContainer.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// PAYWALL
// ==========================================
function setupPaywall() {
  if (!CONFIG.isPaywallEnabled) return;

  // Hook no CTA de compra
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-comprar')) {
      e.preventDefault();
      handlePurchase();
    }
  });
}

function showPaywall() {
  const modal = document.getElementById('auth-modal');
  const gateway = document.getElementById('auth-gateway');

  if (gateway) {
    gateway.innerHTML = `
      <div class="auth-header">
        <div class="auth-logo">🔒</div>
        <h2 class="auth-title">Conteúdo Exclusivo</h2>
        <p class="auth-subtitle">Faça login ou adquira o acesso completo</p>
      </div>
      <div style="text-align:center;padding:2rem;">
        <p style="color:var(--text-secondary);margin-bottom:1.5rem;">
          Você leu ${CONFIG.features.freePages} páginas gratuitas.
          Adquira o acesso para continuar.
        </p>
        <a href="${CONFIG.cakto.checkoutUrl || '#'}" class="btn btn-primary btn-large" target="_blank" rel="noopener">
          Quero Acesso Completo — R$ 47,00
        </a>
        <div class="auth-divider">ou</div>
        <a href="login.html" class="btn btn-outline">Já tenho acesso — Fazer login</a>
      </div>
    `;
  }

  modal?.showModal();
}

function handlePurchase() {
  if (CONFIG.isCaktoEnabled && CONFIG.cakto.checkoutUrl) {
    window.open(CONFIG.cakto.checkoutUrl, '_blank', 'noopener,noreferrer');
  } else {
    showToast('⚠️ Pagamento disponível em breve');
  }
}

function isUserAuthenticated() {
  return !!localStorage.getItem(STORAGE_KEYS.authToken);
}

// ==========================================
// SERVICE WORKER
// ==========================================
function setupServiceWorker() {
  // Service Worker temporariamente desabilitado para evitar cache agressivo
  // em desenvolvimento. Reative após confirmar que tudo funciona:
  //
  // if (!('serviceWorker' in navigator)) return;
  // navigator.serviceWorker.register('/service-worker.js')
  //   .then(reg => console.log('[app.js] SW registrado:', reg.scope))
  //   .catch(err => console.error('[app.js] Erro no SW:', err));
  //
  // Por enquanto, unregister qualquer SW existente:
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
    });
  }
}

// ==========================================
// EXPOSE GLOBALLY (para event handlers inline)
// ==========================================
window.__app = { goToPage, goNext, goPrev, showToast };
