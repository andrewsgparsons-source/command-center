// Solution Planner v2 — Command Centre with Sidebar Navigation

(function() {
  'use strict';

  // ─── Data Sources ───
  const DATA_URLS = {
    sheds: 'https://andrewsgparsons-source.github.io/shed-project-board/data/cards.json',
    farm:  'https://andrewsgparsons-source.github.io/whelpley-farm-dashboard/data/financial_data.json',
    forge: 'https://raw.githubusercontent.com/andrewsgparsons-source/forge-ai/main/data/cards.json',
    gptChats: '../data/gpt-chats.json',
    james: '../data/james.json',
    config: '../data/config.json',
    agents: '../data/agents.json',
  };

  // ─── State ───
  let state = {
    currentView: localStorage.getItem('sp2-view') || 'today',
    filter: 'all',
    shedCards: [],
    farmFinancials: null,
    forgeCards: [],
    gptChats: [],
    jamesData: null,
    configData: null,
    agents: null,
  };

  // ─── Init ───
  document.addEventListener('DOMContentLoaded', async () => {
    setGreeting();
    setupSidebarNav();
    setupMobileMenu();
    setupBusinessFilter();
    await loadAllData();
    buildMobileBottomNav();
    updateSidebarFromConfig();
    switchView(state.currentView);
    document.getElementById('loadingScreen').style.display = 'none';

    // Solution Planner is Andrew's personal dashboard — no need to ask
    if (window.FireSync) {
      if (!FireSync.getUser()) FireSync.setUser('Andrew');
    }
  });

  // ─── Greeting ───
  function setGreeting() {
    const h = new Date().getHours();
    const g = h < 12 ? 'Good morning, Andrew' : h < 17 ? 'Good afternoon, Andrew' : 'Good evening, Andrew';
    document.getElementById('greeting').textContent = g;
    const mg = document.getElementById('mobileGreeting');
    if (mg) mg.textContent = g;
  }

  // ─── Sidebar Navigation ───
  function setupSidebarNav() {
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        switchView(item.dataset.view);
        // Close mobile menu if open
        document.getElementById('sidebar').classList.remove('open');
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.remove('active');
      });
    });
  }

  // ─── Update sidebar links from config.json ───
  function updateSidebarFromConfig() {
    if (!state.configData || !state.configData.dashboards) return;

    // Build map of boardUrl path → dashboard for exact matching
    const pathMap = {};
    state.configData.dashboards.forEach(d => {
      if (d.boardUrl) {
        try {
          const path = new URL(d.boardUrl).pathname.replace(/\/$/, '');
          pathMap[path] = d;
        } catch(e) {}
      }
    });

    // Update sidebar external links — match by pathname (not hostname, which is shared)
    document.querySelectorAll('.sidebar-nav a.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      try {
        const linkPath = new URL(href).pathname.replace(/\/$/, '');
        if (pathMap[linkPath]) {
          link.setAttribute('href', pathMap[linkPath].boardUrl);
        }
      } catch(e) {}
    });
  }

  function switchView(viewId) {
    state.currentView = viewId;
    localStorage.setItem('sp2-view', viewId);

    // Update sidebar active state
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewId);
    });

    // Show/hide views
    document.querySelectorAll('.view').forEach(v => { v.style.display = 'none'; });
    const viewEl = document.getElementById('view-' + viewId);
    if (viewEl) {
      viewEl.style.display = 'block';
      renderView(viewId);
    }

    // Update mobile bottom nav active state
    updateMobileBottomNav(viewId);

    // Scroll to top
    window.scrollTo(0, 0);
  }

  function renderView(viewId) {
    switch(viewId) {
      case 'today': renderToday(); break;
      case 'questions': renderQuestions(); break;
      case 'james': renderJamesDetail(); break;
      case 'gpt-chats': renderGptChats(); break;
      case 'team': renderTeam(); break;
      case 'biz-sheds': renderShedDetail(); break;
      case 'biz-farm': renderFarmDetail(); break;
      case 'biz-forge': renderForgeDetail(); break;
      case 'biz-grow': renderGrowDetail(); break;
      case 'businesses': renderBusinessesOverview(); break;
      case 'personal': renderPersonal(); break;
      case 'ideas': renderIdeas(); break;
    }
  }

  // ─── Mobile Menu ───
  function setupMobileMenu() {
    const btn = document.getElementById('menuBtn');
    const sidebar = document.getElementById('sidebar');

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });

    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('active');
    });
  }

  // ─── Business Filter ───
  function setupBusinessFilter() {
    document.querySelectorAll('.biz-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.biz-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.filter = pill.dataset.biz;
        renderToday();
      });
    });
  }

  // ─── Data Loading ───
  async function loadAllData() {
    const results = await Promise.allSettled([
      fetch(DATA_URLS.sheds).then(r => r.json()),
      fetch(DATA_URLS.farm).then(r => r.json()),
      fetch(DATA_URLS.forge).then(r => r.json()),
      fetch(DATA_URLS.gptChats).then(r => r.json()),
      fetch(DATA_URLS.james).then(r => r.json()),
      fetch(DATA_URLS.config).then(r => r.json()),
      fetch(DATA_URLS.agents).then(r => r.json()),
    ]);

    if (results[0].status === 'fulfilled') {
      const d = results[0].value;
      state.shedCards = Array.isArray(d) ? d : (d.cards || []);
    }
    if (results[1].status === 'fulfilled') {
      state.farmFinancials = results[1].value;
    }
    if (results[2].status === 'fulfilled') {
      const d = results[2].value;
      state.forgeCards = Array.isArray(d) ? d : (d.cards || []);
    }
    if (results[3].status === 'fulfilled') {
      state.gptChats = results[3].value || [];
    }
    if (results[4].status === 'fulfilled') {
      state.jamesData = results[4].value;
    }
    if (results[6].status === 'fulfilled') {
      state.agents = results[6].value;
    }
    if (results[5].status === 'fulfilled') {
      state.configData = results[5].value;
    }

    // Update sidebar badges
    document.getElementById('navGptBadge').textContent = state.gptChats.length;
    document.getElementById('navTeamBadge').textContent = state.agents && state.agents.agents ? state.agents.agents.filter(a => a.status === 'active').length : 0;
    // Attention badge is updated by Firebase listener
    document.getElementById('navShedBadge').textContent = state.shedCards.filter(c => c.status === 'in-progress').length;
    const userName = window.FireSync ? FireSync.getUser() : '';
    const userLabel = userName ? ` · ${userName}` : '';
    document.getElementById('sidebarStatus').textContent = `Data loaded · ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}${userLabel}`;
  }

  // ─── Attention Items (Firebase-powered) ───
  let fireAttentionItems = {};

  // Listen for real-time attention item changes
  if (window.FireSync) {
    FireSync.onAttentionItems(items => {
      fireAttentionItems = items;
      // Update badge
      const activeCount = Object.values(items).filter(i => i.status === 'active').length;
      document.getElementById('navAttentionBadge').textContent = activeCount;
      // Re-render if on Today view
      if (state.currentView === 'today') {
        renderAttentionList();
      }
    });
  }

  function getAttentionItems(filter) {
    const f = filter;
    const bizMap = { '🏠': 'sheds', '🌾': 'farm', '☕': 'forge', '🌱': 'grow', '⚡': 'all' };
    return Object.entries(fireAttentionItems)
      .filter(([id, item]) => item.status === 'active')
      .filter(([id, item]) => {
        if (f === 'all') return true;
        return bizMap[item.biz] === f;
      })
      .map(([id, item]) => ({ ...item, id }))
      .sort((a, b) => {
        const pOrder = { high: 0, medium: 1, low: 2 };
        return (pOrder[a.priority] || 1) - (pOrder[b.priority] || 1);
      });
  }

  function renderAttentionList() {
    const items = getAttentionItems(state.filter);
    document.getElementById('attentionCount').textContent = items.length;

    if (items.length === 0) {
      document.getElementById('attentionList').innerHTML = `
        <div class="empty-attention">
          <span style="font-size:24px;">✅</span>
          <span style="color:var(--text-muted); font-size:14px;">All clear — nothing needs your attention right now</span>
        </div>
      `;
    } else {
      document.getElementById('attentionList').innerHTML = items.map(i => `
        <div class="attention-item" data-id="${i.id}" onclick="window._openItem('${i.id}')">
          <span class="attention-biz">${i.biz}</span>
          <div class="attention-text">
            <div class="attention-title">${i.title}</div>
            <div class="attention-detail">${i.detail || ''}</div>
          </div>
          <div class="attention-actions">
            <button class="att-btn att-done" onclick="event.stopPropagation(); window._attDone('${i.id}')" title="Mark done">✓</button>
            <button class="att-btn att-dismiss" onclick="event.stopPropagation(); window._attDismiss('${i.id}')" title="Dismiss">✕</button>
          </div>
        </div>
      `).join('');
    }

    // Recently completed items
    renderDoneList();
  }

  function renderDoneList() {
    const f = state.filter;
    const doneItems = Object.entries(fireAttentionItems)
      .filter(([id, item]) => item.status === 'done')
      .filter(([id, item]) => {
        if (f === 'all') return true;
        const bizMap = { '🏠': 'sheds', '🌾': 'farm', '☕': 'forge', '🌱': 'grow', '⚡': 'all' };
        return bizMap[item.biz] === f;
      })
      .map(([id, item]) => ({ ...item, id }))
      .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
      .slice(0, 10); // Last 10

    const doneCard = document.getElementById('doneCard');
    if (doneItems.length === 0) {
      doneCard.style.display = 'none';
      return;
    }

    doneCard.style.display = 'block';
    document.getElementById('doneCount').textContent = doneItems.length;
    document.getElementById('doneList').innerHTML = doneItems.map(i => {
      const when = i.completedAt ? new Date(i.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';
      return `
        <div class="attention-item done-item">
          <span class="attention-biz">${i.biz}</span>
          <div class="attention-text">
            <div class="attention-title" style="text-decoration:line-through; opacity:0.6;">${i.title}</div>
          </div>
          <span class="done-date">${when}</span>
        </div>
      `;
    }).join('');
  }

  // Global handlers for attention item buttons
  window._attDone = function(id) {
    FireSync.completeAttentionItem(id);
  };

  window._attDismiss = function(id) {
    FireSync.dismissAttentionItem(id);
  };

  // Open item detail panel
  window._openItem = function(id) {
    const item = fireAttentionItems[id];
    if (item && window.ItemDetail) {
      ItemDetail.open(id, item);
    }
  };

  // Add item dialog
  window._showAddAttention = function() {
    const overlay = document.getElementById('addItemOverlay');
    if (overlay) overlay.style.display = 'flex';
  };

  window._hideAddAttention = function() {
    const overlay = document.getElementById('addItemOverlay');
    if (overlay) overlay.style.display = 'none';
  };

  window._submitAttention = function() {
    const title = document.getElementById('addItemTitle').value.trim();
    const detail = document.getElementById('addItemDetail').value.trim();
    const biz = document.getElementById('addItemBiz').value;
    const priority = document.getElementById('addItemPriority').value;

    if (!title) return;

    FireSync.addAttentionItem({ title, detail, biz, priority });

    // Clear and close
    document.getElementById('addItemTitle').value = '';
    document.getElementById('addItemDetail').value = '';
    window._hideAddAttention();
  };

  // ─── Render: Today ───
  function renderToday() {
    const f = state.filter;

    // Attention (Firebase-powered)
    renderAttentionList();

    // James
    document.getElementById('jamesNeedsList').innerHTML = `
      <li>Garden buildings financial data (costs, past jobs, material prices)</li>
      <li>Confirm Forge AI retreat as wedge product</li>
    `;

    // Money
    renderMoney(f);

    // Businesses
    renderBusinessCards(f);

    // Quick Stats Strip (after business cards)
    renderStatsStrip();
  }

  function renderMoney(f) {
    const grid = document.getElementById('moneyGrid');
    let items = [];

    if (f === 'all' || f === 'sheds') {
      items.push({ biz: '🏠 Sheds', value: null, label: 'Coming soon on update', hasData: false });
    }
    if (f === 'all' || f === 'farm') {
      if (state.farmFinancials) {
        const inc = (state.farmFinancials.income || []).reduce((s,i) => s + i.amount, 0);
        const exp = (state.farmFinancials.expenses || []).reduce((s,e) => s + e.amount, 0);
        items.push({ biz: '🌾 Farm', value: `£${((inc-exp)/1000).toFixed(0)}k`, label: 'Net (3 FY cumulative)', hasData: true, trend: 'up' });
      }
    }
    if (f === 'all' || f === 'forge') {
      items.push({ biz: '☕ Forge', value: null, label: 'Pre-revenue', hasData: false });
    }
    if (f === 'all' || f === 'grow') {
      items.push({ biz: '🌱 Grow', value: null, label: 'Pre-prototype', hasData: false });
    }

    grid.innerHTML = items.map(i => `
      <div class="money-item ${i.hasData ? 'has-data' : 'placeholder'}">
        <div class="money-biz">${i.biz}</div>
        <div class="money-value">${i.hasData ? i.value : '—'}</div>
        <div class="money-label">${i.label}</div>
        ${i.trend ? '<div class="money-trend trend-up">▲</div>' : ''}
      </div>
    `).join('');
  }

  function renderBusinessCards(f) {
    const container = document.getElementById('businessCards');
    const businesses = [
      {
        id: 'sheds', emoji: '🏠', name: 'Garden Buildings',
        status: 'Active — configurator in development',
        kpis: [
          { label: `${state.shedCards.filter(c => c.status === 'in-progress').length} in progress`, highlight: true },
          { label: `${state.shedCards.filter(c => c.status === 'done').length} done` },
          { label: '605 commits' }
        ]
      },
      {
        id: 'farm', emoji: '🌾', name: 'Whelpley Farm',
        status: 'Active — 3 years of financial data',
        kpis: state.farmFinancials ? [
          { label: `£${((state.farmFinancials.income||[]).reduce((s,i)=>s+i.amount,0)/1000).toFixed(0)}k revenue`, highlight: true },
          { label: `${(state.farmFinancials.expenses||[]).length} expenses` },
        ] : [{ label: 'Loading...' }]
      },
      {
        id: 'forge', emoji: '☕', name: 'Forge AI',
        status: 'Pre-revenue — proof & brand built',
        kpis: [
          { label: `${state.forgeCards.filter(c => c.status === 'done').length} done` },
          { label: 'Pre-revenue', highlight: true }
        ]
      },
      {
        id: 'grow', emoji: '🌱', name: 'Grow Cabin',
        status: 'Research phase — 60+ documents',
        kpis: [
          { label: '60+ docs' },
          { label: '5 decisions pending', highlight: true }
        ]
      }
    ];

    const filtered = f === 'all' ? businesses : businesses.filter(b => b.id === f);

    container.innerHTML = filtered.map(biz => `
      <div class="biz-card" data-view="biz-${biz.id}">
        <div class="biz-card-top">
          <span class="biz-emoji">${biz.emoji}</span>
          <span class="biz-name">${biz.name}</span>
        </div>
        <div class="biz-status">${biz.status}</div>
        <div class="biz-kpis">${biz.kpis.map(k => `<span class="biz-kpi ${k.highlight ? 'highlight' : ''}">${k.label}</span>`).join('')}</div>
      </div>
    `).join('');

    // Click to navigate to business detail
    container.querySelectorAll('.biz-card').forEach(card => {
      card.addEventListener('click', () => switchView(card.dataset.view));
    });
  }

  // ─── Render: 8 Questions ───
  function renderQuestions() {
    const container = document.getElementById('questionCards');
    const sIP = state.shedCards.filter(c => c.status === 'in-progress').length;
    const sBL = state.shedCards.filter(c => c.status === 'backlog').length;
    const sDN = state.shedCards.filter(c => c.status === 'done').length;
    const fIP = state.forgeCards.filter(c => c.status === 'in-progress').length;
    const fDN = state.forgeCards.filter(c => c.status === 'done').length;

    const questions = [
      { id: 'work', emoji: '📋', title: 'What am I working on?', summary: `${sIP+fIP} active · ${sBL} queued · ${sDN+fDN} done`, status: 'live', label: 'Live data', clickable: true },
      { id: 'money', emoji: '💰', title: "How's my money?", summary: state.farmFinancials ? 'Farm data available · Sheds coming soon' : 'Coming soon on update', status: state.farmFinancials ? 'partial' : 'coming', label: state.farmFinancials ? 'Partial' : 'Coming soon', clickable: false },
      { id: 'customers', emoji: '👥', title: 'Who are my customers?', summary: 'Coming soon on update', status: 'coming', label: 'Coming soon', clickable: false },
      { id: 'materials', emoji: '📦', title: 'What do I need?', summary: 'Coming soon on update', status: 'coming', label: 'Coming soon', clickable: false },
      { id: 'direction', emoji: '🧭', title: 'Where am I heading?', summary: '4 strategies defined · OKRs coming soon', status: 'partial', label: 'Partial', clickable: true },
      { id: 'people', emoji: '🤝', title: "Who's helping?", summary: 'Coming soon on update', status: 'coming', label: 'Coming soon', clickable: false },
      { id: 'waste', emoji: '♻️', title: 'What am I wasting?', summary: state.farmFinancials ? 'Farm contractor analysis available' : 'Coming soon on update', status: state.farmFinancials ? 'partial' : 'coming', label: state.farmFinancials ? 'Partial' : 'Coming soon', clickable: false },
      { id: 'new', emoji: '💡', title: "What's new?", summary: `${state.shedCards.filter(c => c.status === 'ideas').length} shed ideas · Incubator active`, status: 'live', label: 'Live data', clickable: false },
    ];

    container.innerHTML = questions.map(q => `
      <div class="question-card${q.clickable ? ' question-clickable' : ''}" ${q.clickable ? `data-question="${q.id}"` : ''}>
        <span class="question-emoji">${q.emoji}</span>
        <div class="question-content">
          <div class="question-title">${q.title}</div>
          <div class="question-summary">${q.summary}</div>
        </div>
        <span class="question-badge ${q.status}">${q.label}</span>
        ${q.clickable ? '<span class="question-arrow">›</span>' : ''}
      </div>
    `).join('');

    // Wire up clickable questions
    container.querySelectorAll('.question-clickable').forEach(card => {
      card.addEventListener('click', () => {
        const qId = card.dataset.question;
        renderQuestionDetailInline(qId);
      });
    });
  }

  // ─── Question Detail (rendered inline in the questions view) ───
  function renderQuestionDetailInline(questionId) {
    const container = document.getElementById('questionCards');
    let html = '<div class="question-detail-back" id="qDetailBack">← Back to Questions</div>';

    if (questionId === 'work') {
      // Combine all cards
      const allCards = [];
      state.shedCards.forEach(c => allCards.push({...c, _emoji: '🏠', _name: 'Garden Buildings'}));
      state.forgeCards.forEach(c => allCards.push({...c, _emoji: '☕', _name: 'Forge AI'}));

      const doing = allCards.filter(c => c.status === 'in-progress');
      const backlog = allCards.filter(c => c.status === 'backlog');
      const highBacklog = backlog.filter(c => c.priority === 'high');
      const doneRecent = allCards.filter(c => c.status === 'done' && c.completedAt)
        .sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''))
        .slice(0, 5);

      html += '<h2 class="question-detail-title">📋 What am I working on?</h2>';

      // Mini Kanban
      html += '<div class="mini-kanban">';
      html += `<div class="kanban-col"><div class="kanban-header kanban-doing">Doing · ${doing.length}</div>`;
      doing.slice(0, 10).forEach(c => {
        html += `<div class="kanban-card">${c._emoji} ${escapeHtml(c.title)}</div>`;
      });
      html += '</div>';

      html += `<div class="kanban-col"><div class="kanban-header kanban-next">Next Up · ${highBacklog.length}</div>`;
      highBacklog.slice(0, 5).forEach(c => {
        html += `<div class="kanban-card">${c._emoji} ${escapeHtml(c.title)}</div>`;
      });
      html += '</div>';

      html += `<div class="kanban-col"><div class="kanban-header kanban-done">Done · ${doneRecent.length}</div>`;
      doneRecent.forEach(c => {
        html += `<div class="kanban-card kanban-done-card">${c._emoji} ${escapeHtml(c.title)}</div>`;
      });
      html += '</div>';
      html += '</div>';

      // By business breakdown
      html += '<div class="detail-card" style="margin-top:16px;"><h3>By Business</h3>';
      const sources = [
        { emoji: '🏠', name: 'Garden Buildings', cards: state.shedCards },
        { emoji: '☕', name: 'Forge AI', cards: state.forgeCards },
      ];
      sources.forEach(src => {
        if (!src.cards.length) return;
        const active = src.cards.filter(c => c.status === 'in-progress').length;
        const bl = src.cards.filter(c => c.status === 'backlog').length;
        const dn = src.cards.filter(c => c.status === 'done').length;
        html += `<div class="biz-breakdown-row">
          <span class="biz-breakdown-name">${src.emoji} ${escapeHtml(src.name)}</span>
          <span class="biz-breakdown-stats">${active} active · ${bl} backlog · ${dn} done</span>
        </div>`;
      });
      html += '</div>';

    } else if (questionId === 'direction') {
      html += '<h2 class="question-detail-title">🧭 Where am I heading?</h2>';

      const businesses = [
        { emoji: '🏠', name: 'Garden Buildings', desc: 'Bespoke timber-framed garden buildings', cards: state.shedCards },
        { emoji: '🌾', name: 'Whelpley Farm', desc: 'Family partnership — crops, livery, holiday let', cards: [], progress: state.farmFinancials ? 60 : 40 },
        { emoji: '☕', name: 'Forge AI', desc: 'AI transition coaching & retreats', cards: state.forgeCards },
        { emoji: '🌱', name: 'Grow Cabin', desc: 'Controlled-environment home growing system', cards: [], progress: 15 },
      ];

      html += '<div class="direction-cards">';
      businesses.forEach(biz => {
        const total = biz.cards.length;
        const done = biz.cards.filter(c => c.status === 'done').length;
        const pct = biz.progress !== undefined ? biz.progress : (total ? Math.round((done / total) * 100) : 0);

        html += `<div class="direction-card">
          <div class="direction-header">${biz.emoji} ${escapeHtml(biz.name)}</div>
          <div class="direction-desc">${escapeHtml(biz.desc)}</div>
          <div class="progress-bar" style="height:8px; margin:8px 0;">
            <div class="progress-fill" style="width:${pct}%; background:linear-gradient(90deg, var(--accent), var(--accent-light));"></div>
          </div>
          <div class="direction-stats">${biz.progress !== undefined ? pct + '% estimated progress' : done + '/' + total + ' complete (' + pct + '%)'}</div>
        </div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Wire back button
    const backBtn = document.getElementById('qDetailBack');
    if (backBtn) {
      backBtn.addEventListener('click', () => renderQuestions());
    }
  }

  // ─── Render: James Detail ───
  function renderJamesDetail() {
    const j = state.jamesData;
    let html = '';

    // ── Restored V1 content: Identity, Working Patterns, Capabilities, Our Story ──
    if (j) {
      // Identity info
      html += `
        <div class="detail-card">
          <h3>Identity</h3>
          <div class="james-identity-grid">
            <div class="james-identity-item"><span class="james-id-label">Name</span><span class="james-id-value">${j.identity.emoji || '🤖'} ${escapeHtml(j.identity.name)}</span></div>
            <div class="james-identity-item"><span class="james-id-label">Born</span><span class="james-id-value">${escapeHtml(j.identity.created)}</span></div>
            <div class="james-identity-item"><span class="james-id-label">Creator</span><span class="james-id-value">${escapeHtml(j.identity.creator)}</span></div>
            <div class="james-identity-item"><span class="james-id-label">Platform</span><span class="james-id-value">${escapeHtml(j.identity.platform)}</span></div>
          </div>
        </div>
      `;

      // Working Patterns
      if (j.workingPatterns) {
        html += `<div class="detail-card"><h3>How We Work</h3><div class="working-patterns-list">`;
        Object.keys(j.workingPatterns).forEach(key => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          html += `
            <div class="working-pattern-item">
              <div class="wp-label">${escapeHtml(label)}</div>
              <div class="wp-value">${escapeHtml(j.workingPatterns[key])}</div>
            </div>
          `;
        });
        html += `</div></div>`;
      }

      // Capabilities tag grid
      if (j.capabilities && j.capabilities.length) {
        html += `<div class="detail-card"><h3>Capabilities</h3><div class="tag-grid">`;
        j.capabilities.forEach(cap => {
          html += `<div class="tag">${escapeHtml(cap)}</div>`;
        });
        html += `</div></div>`;
      }

      // Our Story timeline
      if (j.story && j.story.length) {
        html += `<div class="detail-card"><h3>Our Story</h3><ul class="timeline">`;
        j.story.slice().reverse().forEach(event => {
          html += `
            <li class="timeline-item">
              <div class="timeline-date">${escapeHtml(event.date)}</div>
              <div class="timeline-event-title">${escapeHtml(event.title)}</div>
              <div class="timeline-desc">${escapeHtml(event.description)}</div>
            </li>
          `;
        });
        html += `</ul></div>`;
      }
    }

    // ── Existing V2 content (preserved) ──
    html += `
      <div class="detail-card">
        <h3>Current Sprint</h3>
        <div class="james-task" style="font-size:16px; margin-bottom:12px;">Business OS — Dashboard Enhancement Sprint</div>
        <div class="james-progress" style="margin-bottom:16px;">
          <div class="progress-bar"><div class="progress-fill" style="width:40%"></div></div>
          <span class="progress-text">40%</span>
        </div>
      </div>

      <div class="detail-card">
        <h3>Completed This Session</h3>
        <ul style="list-style:none; padding:0;">
          <li style="padding:8px 0; border-bottom:1px solid var(--border);">✅ Four business strategies to £100k profit</li>
          <li style="padding:8px 0; border-bottom:1px solid var(--border);">✅ Dashboard enhancement plans (all 5 dashboards)</li>
          <li style="padding:8px 0; border-bottom:1px solid var(--border);">✅ Forge AI philosophical foundation</li>
          <li style="padding:8px 0; border-bottom:1px solid var(--border);">✅ Garden buildings data model (6 JSON schemas)</li>
          <li style="padding:8px 0; border-bottom:1px solid var(--border);">✅ North Star operating model crystallised</li>
          <li style="padding:8px 0;">✅ Solution Planner v2 dashboard (this!)</li>
        </ul>
      </div>

      <div class="detail-card">
        <h3>Research Library</h3>
        <p style="color:var(--text-muted); margin-bottom:12px;">16 documents in <code>research/business-dev/</code></p>
        <ul style="list-style:none; padding:0; font-size:13px;">
          <li style="padding:4px 0;">00 — Vision & Directive (founding document)</li>
          <li style="padding:4px 0;">01 — Discipline Landscape (43 disciplines)</li>
          <li style="padding:4px 0;">02–08 — Deep Dives (8 discipline groups)</li>
          <li style="padding:4px 0;">09 — Work Hierarchy Model</li>
          <li style="padding:4px 0;">10 — Solution Planner v2 Spec</li>
          <li style="padding:4px 0;">11 — Cross-Discipline Interconnection Model</li>
          <li style="padding:4px 0;">12 — Universal Business OS Architecture</li>
          <li style="padding:4px 0;">13 — Existing Data Audit</li>
          <li style="padding:4px 0;">14 — Dashboard Enhancement Plans</li>
          <li style="padding:4px 0;">15 — Garden Buildings Data Model</li>
          <li style="padding:4px 0;">16 — Forge AI Philosophical Foundation</li>
        </ul>
      </div>

      <div class="detail-card">
        <h3>Division of Labour</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
          <div>
            <div style="font-weight:600; margin-bottom:8px;">🔨 Andrew (Physical + Human)</div>
            <ul style="font-size:12px; color:var(--text-secondary); padding-left:16px;">
              <li>Building & fabrication</li>
              <li>Client relationships</li>
              <li>Partner conversations</li>
              <li>Supplier negotiations</li>
              <li>Teaching & coaching</li>
              <li>Strategic decisions</li>
            </ul>
          </div>
          <div>
            <div style="font-weight:600; margin-bottom:8px;">📋 James (Clerical + Digital)</div>
            <ul style="font-size:12px; color:var(--text-secondary); padding-left:16px;">
              <li>Financial tracking</li>
              <li>Data maintenance</li>
              <li>Scheduling & reminders</li>
              <li>Monitoring & alerting</li>
              <li>Document preparation</li>
              <li>System development</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    document.getElementById('jamesDetail').innerHTML = html;
  }

  // ─── Render: GPT Chats ───
  function renderGptChats() {
    const container = document.getElementById('gptChatsList');
    const chats = state.gptChats;

    if (!chats.length) {
      container.innerHTML = '<div class="empty-state">No chats yet.</div>';
      return;
    }

    container.innerHTML = chats.map((chat, idx) => {
      const date = new Date(chat.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const tags = (chat.tags || []).map(t => `<span class="gpt-tag">${t}</span>`).join('');
      const insights = (chat.keyInsights || []).map(i => `<li>${i}</li>`).join('');

      return `
        <div class="card gpt-chat-card" id="gpt-${chat.id}">
          <div class="card-header gpt-chat-header" onclick="document.getElementById('gpt-body-${idx}').classList.toggle('collapsed')">
            <div class="gpt-chat-meta">
              <span class="gpt-chat-date">${date}</span>
              <h2 class="gpt-chat-title">${chat.title}</h2>
              <div class="gpt-tags">${tags}</div>
            </div>
            <span class="gpt-expand-icon">▼</span>
          </div>
          <div class="card-body gpt-chat-body" id="gpt-body-${idx}">
            <div class="gpt-section">
              <h3>📝 Context</h3>
              <p>${chat.context}</p>
            </div>
            ${insights ? `
            <div class="gpt-section">
              <h3>💡 Key Insights</h3>
              <ul class="gpt-insights">${insights}</ul>
            </div>` : ''}
            <div class="gpt-section">
              <h3>📤 Prompt Sent to ChatGPT</h3>
              <div class="gpt-text-block gpt-prompt">${escapeHtml(chat.prompt, true)}</div>
            </div>
            <div class="gpt-section">
              <h3>📥 ChatGPT Response</h3>
              <div class="gpt-text-block gpt-response">${escapeHtml(chat.response, true)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(text, preserveNewlines) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return preserveNewlines ? div.innerHTML.replace(/\n/g, '<br>') : div.innerHTML;
  }

  // ─── Render: My Team ───
  function renderTeam() {
    const container = document.getElementById('teamDetail');
    
    if (!state.agents || !state.agents.agents) {
      container.innerHTML = '<div class="empty-state">Loading team data...</div>';
      return;
    }

    const agents = state.agents.agents;
    const models = state.agents.availableModels || [];
    const activeCount = agents.filter(a => a.status === 'active').length;

    const agentCards = agents.map(agent => {
      const modelInfo = models.find(m => m.id === agent.model) || {};
      const strengths = (modelInfo.strengths || []).join(', ');
      
      return `
        <div class="card team-card">
          <div class="team-card-header">
            <div class="team-agent-name">
              <h3>${agent.name}</h3>
              ${agent.isDefault ? '<span class="team-badge team-badge-default">Default</span>' : ''}
            </div>
            <span class="team-status team-status-${agent.status}">${agent.status}</span>
          </div>
          <div class="team-card-body">
            <div class="team-row">
              <span class="team-label">Group:</span>
              <span class="team-value">${agent.group}</span>
            </div>
            <div class="team-row">
              <span class="team-label">Channel:</span>
              <span class="team-value">${agent.channel || 'N/A'}</span>
            </div>
            <div class="team-row">
              <span class="team-label">Model:</span>
              <span class="team-value team-model">
                <strong>${modelInfo.name || agent.modelAlias || 'Unknown'}</strong>
                ${modelInfo.provider ? `<span class="team-provider">(${modelInfo.provider})</span>` : ''}
              </span>
            </div>
            ${strengths ? `
            <div class="team-row">
              <span class="team-label">Strengths:</span>
              <span class="team-value team-strengths">${strengths}</span>
            </div>
            ` : ''}
            <div class="team-row">
              <span class="team-label">Workspace:</span>
              <span class="team-value team-workspace">${agent.workspace.replace('/home/ser/clawd', '~')}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="detail-card">
        <h3>📊 Team Overview</h3>
        <div class="detail-stat-row">
          <div class="detail-stat">
            <div class="detail-stat-value">${activeCount}</div>
            <div class="detail-stat-label">Active Agents</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-value">${agents.length}</div>
            <div class="detail-stat-label">Total Agents</div>
          </div>
          <div class="detail-stat">
            <div class="detail-stat-value">${models.length}</div>
            <div class="detail-stat-label">Available Models</div>
          </div>
        </div>
      </div>

      <div class="detail-card">
        <h3>🤖 AI Agents</h3>
        <div class="team-grid">
          ${agentCards}
        </div>
      </div>

      <div class="detail-card">
        <h3>🎯 Available Models</h3>
        <div class="models-grid">
          ${models.map(model => `
            <div class="model-card">
              <div class="model-header">
                <h4>${model.name}</h4>
                <span class="model-provider">${model.provider}</span>
              </div>
              <div class="model-strengths">
                ${(model.strengths || []).map(s => `<span class="strength-tag">${s}</span>`).join('')}
              </div>
              <div class="model-footer">
                <span class="model-cost">Cost: ${model.cost}</span>
                <span class="model-alias">${model.alias}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="detail-card">
        <h3>📝 Notes</h3>
        <p style="font-size:13px; color:var(--text-secondary); line-height:1.6;">
          <strong>Model switching:</strong> Interactive model switching will be added in Phase 3. For now, this shows the current configuration from Clawdbot.<br>
          <strong>Activity tracking:</strong> Message counts and sub-agent spawn history will be added in Phase 4.<br>
          <strong>Model comparison log:</strong> Track which models work best for which tasks - coming in Phase 5.
        </p>
      </div>
    `;
  }

  // ─── Render: Shed Detail ───
  function renderShedDetail() {
    const cards = state.shedCards;
    const ip = cards.filter(c => c.status === 'in-progress').length;
    const bl = cards.filter(c => c.status === 'backlog').length;
    const dn = cards.filter(c => c.status === 'done').length;
    const id = cards.filter(c => c.status === 'ideas').length;

    document.getElementById('shedDetail').innerHTML = `
      <div class="detail-links">
        <a href="https://andrewsgparsons-source.github.io/shed-project-board/" target="_blank" class="detail-dash-link">📋 Open Project Board →</a>
        <a href="https://andrewsgparsons-source.github.io/Parametric-shed2-staging/" target="_blank" class="detail-dash-link">🔧 Open Configurator →</a>
        <a href="https://my3dbuild.co.uk" target="_blank" class="detail-dash-link">🌐 My3DBuild Website →</a>
      </div>
      <div class="detail-card">
        <h3>Configurator Development</h3>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value">${ip}</div><div class="detail-stat-label">In Progress</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${bl}</div><div class="detail-stat-label">Backlog</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${dn}</div><div class="detail-stat-label">Done</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${id}</div><div class="detail-stat-label">Ideas</div></div>
        </div>
        <div class="build-hash" id="shedBuildHash">🔧 Build: loading...</div>
      </div>

      <div class="detail-card">
        <h3>🌐 My3DBuild Website</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">Customer-facing landing page &amp; configurator gateway</p>
        <div class="detail-links" style="margin-bottom:12px;">
          <a href="https://my3dbuild.co.uk" target="_blank" class="detail-dash-link">🌐 Live Site →</a>
          <a href="https://github.com/andrewsgparsons-source/my3dbuild-website" target="_blank" class="detail-dash-link">📂 GitHub Repo →</a>
        </div>
        <div class="m3d-features" style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:12px;">
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Landing page</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Fullscreen configurator</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Photo gallery</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Video showcase</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Quote form + email</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">✅ Custom domain + SSL</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">⬜ SEO landing pages</div>
          <div class="m3d-feat" style="font-size:12px; padding:6px 8px; background:var(--bg-tertiary, #f0ede8); border-radius:6px;">⬜ Analytics</div>
        </div>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value" id="m3dLeadCount">—</div><div class="detail-stat-label">Leads</div></div>
          <div class="detail-stat"><div class="detail-stat-value" id="m3dLastCommit">—</div><div class="detail-stat-label">Last Deploy</div></div>
        </div>
      </div>

      <div class="detail-card">
        <h3>💰 Financial Overview</h3>
        <div class="coming-soon-box">
          <div class="cs-icon">🔜</div>
          <div class="cs-title">Coming soon on update</div>
          <div class="cs-detail">Revenue, costs, margins, and job profitability — waiting for Andrew's financial data</div>
        </div>
      </div>

      <div class="detail-card">
        <h3>👥 Customer Pipeline</h3>
        <div class="coming-soon-box">
          <div class="cs-icon">🔜</div>
          <div class="cs-title">Coming soon on update</div>
          <div class="cs-detail">Lead tracking, quote status, pipeline value — data model ready, needs populating</div>
        </div>
      </div>

      <div class="detail-card">
        <h3>📦 Materials & Suppliers</h3>
        <div class="coming-soon-box">
          <div class="cs-icon">🔜</div>
          <div class="cs-title">Coming soon on update</div>
          <div class="cs-detail">East Bros pricing, BOM integration, supplier management — schema designed</div>
        </div>
      </div>

      <div class="detail-card">
        <h3>📊 Strategy</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Target: <strong>£100k profit</strong> via 10-15 builds + design-only services</p>
        <p style="font-size:13px; color:var(--text-secondary);">Priority: Pricing engine → SEO/marketing → Financial foundation → Scale preparation</p>
      </div>
    `;

    // Fetch build hash
    fetch('https://andrewsgparsons-source.github.io/Parametric-shed2-staging/build.txt')
      .then(r => r.ok ? r.text() : Promise.reject('not found'))
      .then(hash => {
        const el = document.getElementById('shedBuildHash');
        if (el) el.textContent = '🔧 Build: ' + hash.trim() + ' · Live';
      })
      .catch(() => {
        const el = document.getElementById('shedBuildHash');
        if (el) el.textContent = '🔧 Build: unavailable';
      });

    // Fetch My3DBuild lead count from Firebase
    fetch('https://dashboards-5c2fb-default-rtdb.europe-west1.firebasedatabase.app/leads.json?shallow=true')
      .then(r => r.ok ? r.json() : Promise.reject('not found'))
      .then(data => {
        const el = document.getElementById('m3dLeadCount');
        if (el) el.textContent = data ? Object.keys(data).length : '0';
      })
      .catch(() => {
        const el = document.getElementById('m3dLeadCount');
        if (el) el.textContent = '—';
      });

    // Fetch My3DBuild last commit date from GitHub API
    fetch('https://api.github.com/repos/andrewsgparsons-source/my3dbuild-website/commits?per_page=1')
      .then(r => r.ok ? r.json() : Promise.reject('not found'))
      .then(data => {
        const el = document.getElementById('m3dLastCommit');
        if (el && data && data[0]) {
          const d = new Date(data[0].commit.author.date);
          const now = new Date();
          const diffH = Math.floor((now - d) / 3600000);
          if (diffH < 1) el.textContent = 'Just now';
          else if (diffH < 24) el.textContent = diffH + 'h ago';
          else el.textContent = Math.floor(diffH / 24) + 'd ago';
        }
      })
      .catch(() => {
        const el = document.getElementById('m3dLastCommit');
        if (el) el.textContent = '—';
      });
  }

  // ─── Render: Farm Detail ───
  function renderFarmDetail() {
    const fin = state.farmFinancials;
    if (!fin) {
      document.getElementById('farmDetail').innerHTML = '<div class="coming-soon-box"><div class="cs-icon">⏳</div><div class="cs-title">Loading farm data...</div></div>';
      return;
    }

    const income = (fin.income || []).reduce((s,i) => s + i.amount, 0);
    const expenses = (fin.expenses || []).reduce((s,e) => s + e.amount, 0);
    const net = income - expenses;

    // Top expense categories
    const expByCat = {};
    (fin.expenses || []).forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount; });
    const topExp = Object.entries(expByCat).sort((a,b) => b[1] - a[1]).slice(0, 6);

    // Income categories
    const incByCat = {};
    (fin.income || []).forEach(i => { incByCat[i.category] = (incByCat[i.category] || 0) + i.amount; });
    const topInc = Object.entries(incByCat).sort((a,b) => b[1] - a[1]);

    document.getElementById('farmDetail').innerHTML = `
      <div class="detail-links">
        <a href="https://andrewsgparsons-source.github.io/whelpley-farm-dashboard/" target="_blank" class="detail-dash-link">🌾 Open Farm Dashboard →</a>
      </div>
      <div class="detail-card">
        <h3>Financial Summary (3 Fiscal Years)</h3>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value" style="color:var(--green);">£${(income/1000).toFixed(0)}k</div><div class="detail-stat-label">Revenue</div></div>
          <div class="detail-stat"><div class="detail-stat-value" style="color:var(--red);">£${(expenses/1000).toFixed(0)}k</div><div class="detail-stat-label">Expenses</div></div>
          <div class="detail-stat"><div class="detail-stat-value">£${(net/1000).toFixed(0)}k</div><div class="detail-stat-label">Net</div></div>
        </div>
      </div>

      <div class="detail-card">
        <h3>Revenue Breakdown</h3>
        ${topInc.map(([cat, amt]) => {
          const pct = (amt / income * 100).toFixed(0);
          return `<div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
              <span>${cat}</span><span style="font-weight:600;">£${(amt/1000).toFixed(0)}k (${pct}%)</span>
            </div>
            <div style="height:6px; background:var(--surface-alt); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--green); border-radius:3px;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="detail-card">
        <h3>Top Expenses</h3>
        ${topExp.map(([cat, amt]) => {
          const pct = (amt / expenses * 100).toFixed(0);
          return `<div style="margin-bottom:10px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:4px;">
              <span>${cat}</span><span style="font-weight:600;">£${(amt/1000).toFixed(0)}k (${pct}%)</span>
            </div>
            <div style="height:6px; background:var(--surface-alt); border-radius:3px; overflow:hidden;">
              <div style="height:100%; width:${pct}%; background:var(--red); border-radius:3px;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <div class="detail-card">
        <h3>📊 Strategy</h3>
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:8px;">Priority: Contractor cost audit (£272k) → Booking revenue maximisation → Subsidy optimisation</p>
      </div>
    `;
  }

  // ─── Render: Forge Detail ───
  function renderForgeDetail() {
    const cards = state.forgeCards;
    const done = cards.filter(c => c.status === 'done').length;
    const ip = cards.filter(c => c.status === 'in-progress').length;
    const bl = cards.filter(c => c.status === 'backlog').length;
    const ideas = cards.filter(c => c.status === 'ideas').length;

    document.getElementById('forgeDetail').innerHTML = `
      <div class="detail-links">
        <a href="https://andrewsgparsons-source.github.io/forge-ai/dashboard/" target="_blank" class="detail-dash-link">☕ Open Forge AI Dashboard →</a>
      </div>
      <div class="detail-card">
        <h3>Task Status</h3>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value">${done}</div><div class="detail-stat-label">Done</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${ip}</div><div class="detail-stat-label">Active</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${bl}</div><div class="detail-stat-label">Backlog</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${ideas}</div><div class="detail-stat-label">Ideas</div></div>
        </div>
      </div>

      <div class="detail-card">
        <h3>The Methodology</h3>
        <p style="font-size:14px; font-weight:500; color:var(--accent); margin-bottom:8px;">Fear → Action → Confidence → Results</p>
        <p style="font-size:13px; color:var(--text-secondary);">Forge AI cures AI excusitis through structured, immersive building experiences. The retreat is the wedge product.</p>
      </div>

      <div class="detail-card">
        <h3>Wedge Product: The Retreat</h3>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value">£2.5k</div><div class="detail-stat-label">Per Person</div></div>
          <div class="detail-stat"><div class="detail-stat-value">3</div><div class="detail-stat-label">Days</div></div>
          <div class="detail-stat"><div class="detail-stat-value">10-14</div><div class="detail-stat-label">Capacity</div></div>
        </div>
        <div class="coming-soon-box" style="margin-top:12px;">
          <div class="cs-icon">🔜</div>
          <div class="cs-title">Retreat programme — coming soon</div>
          <div class="cs-detail">3-day curriculum, pricing, booking system, first beta event</div>
        </div>
      </div>

      <div class="detail-card">
        <h3>👥 Client Pipeline</h3>
        <div class="coming-soon-box">
          <div class="cs-icon">🔜</div>
          <div class="cs-title">Coming soon on update</div>
          <div class="cs-detail">Leads, proposals, engagements, testimonials</div>
        </div>
      </div>
    `;
  }

  // ─── Quick Stats Strip ───
  function renderStatsStrip() {
    // Remove existing strip if any
    let existing = document.getElementById('quickStatsStrip');
    if (existing) existing.remove();

    // Calculate stats
    const totalItems = state.shedCards.length + state.forgeCards.length;
    const doneItems = state.shedCards.filter(c => c.status === 'done').length + state.forgeCards.filter(c => c.status === 'done').length;
    const ideaItems = state.shedCards.filter(c => c.status === 'ideas').length + state.forgeCards.filter(c => c.status === 'ideas').length;
    const dashCount = state.configData ? state.configData.dashboards.length : 4;

    const strip = document.createElement('div');
    strip.id = 'quickStatsStrip';
    strip.className = 'quick-stats-strip';
    strip.innerHTML = `
      <div class="qs-stat"><span class="qs-value">${totalItems}</span><span class="qs-label">Total items</span></div>
      <div class="qs-stat"><span class="qs-value">${doneItems}</span><span class="qs-label">Done</span></div>
      <div class="qs-stat"><span class="qs-value">${ideaItems}</span><span class="qs-label">Ideas</span></div>
      <div class="qs-stat"><span class="qs-value">${dashCount}</span><span class="qs-label">Dashboards</span></div>
    `;

    // Insert after the business cards section
    const bizSection = document.querySelector('.today-businesses');
    if (bizSection) {
      bizSection.after(strip);
    }
  }

  // ─── Mobile Bottom Navigation ───
  function buildMobileBottomNav() {
    if (document.getElementById('mobileBottomNav')) return;

    // Use config.json mobileNav if available, otherwise defaults
    const navItems = (state.configData && state.configData.mobileNav) ? state.configData.mobileNav : [
      { id: 'today', label: 'Today', icon: '🎯' },
      { id: 'personal', label: 'Personal', icon: '👤' },
      { id: 'james', label: 'James', icon: '🤖' },
      { id: 'businesses', label: 'More', icon: '☰' },
    ];

    const nav = document.createElement('nav');
    nav.id = 'mobileBottomNav';
    nav.className = 'v2-bottom-nav';

    nav.innerHTML = navItems.map(item => `
      <div class="v2-bnav-item" data-view="${item.id}">
        <span class="v2-bnav-icon">${item.icon}</span>
        <span class="v2-bnav-label">${item.label}</span>
      </div>
    `).join('');

    document.body.appendChild(nav);

    // Wire click handlers
    nav.querySelectorAll('.v2-bnav-item').forEach(el => {
      el.addEventListener('click', () => {
        const view = el.dataset.view;
        if (view === 'businesses') {
          // "More" button toggles sidebar on mobile
          const sidebar = document.getElementById('sidebar');
          const overlay = document.querySelector('.sidebar-overlay');
          sidebar.classList.toggle('open');
          if (overlay) overlay.classList.toggle('active');
        } else {
          switchView(view);
          // Close sidebar if open
          document.getElementById('sidebar').classList.remove('open');
          const overlay = document.querySelector('.sidebar-overlay');
          if (overlay) overlay.classList.remove('active');
        }
      });
    });

    // Set initial active state
    updateMobileBottomNav(state.currentView);
  }

  function updateMobileBottomNav(viewId) {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;
    nav.querySelectorAll('.v2-bnav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.view === viewId);
    });
  }

  // ─── Render: Businesses Overview ───
  function renderBusinessesOverview() {
    const container = document.getElementById('businessesOverview');
    const businesses = [
      {
        id: 'biz-sheds', emoji: '🏠', name: 'Garden Buildings',
        desc: 'Bespoke timber-framed garden buildings',
        cards: state.shedCards,
        dashUrl: 'https://andrewsgparsons-source.github.io/shed-project-board/'
      },
      {
        id: 'biz-farm', emoji: '🌾', name: 'Whelpley Farm',
        desc: 'Family partnership — crops, livery, holiday let',
        cards: [],
        dashUrl: 'https://andrewsgparsons-source.github.io/whelpley-farm-dashboard/'
      },
      {
        id: 'biz-forge', emoji: '☕', name: 'Forge AI',
        desc: 'AI transition coaching & retreats',
        cards: state.forgeCards,
        dashUrl: 'https://andrewsgparsons-source.github.io/forge-ai/dashboard/'
      },
      {
        id: 'biz-grow', emoji: '🌱', name: 'Grow Cabin',
        desc: 'Controlled-environment home growing system',
        cards: [],
        dashUrl: 'https://andrewsgparsons-source.github.io/GrowCabin/dashboard/'
      }
    ];

    // Override URLs from config if available
    if (state.configData && state.configData.dashboards) {
      const dashMap = {};
      state.configData.dashboards.forEach(d => { dashMap[d.id] = d; });
      if (dashMap['shed'] && dashMap['shed'].boardUrl) businesses[0].dashUrl = dashMap['shed'].boardUrl;
      if (dashMap['farm'] && dashMap['farm'].boardUrl) businesses[1].dashUrl = dashMap['farm'].boardUrl;
      if (dashMap['forge'] && dashMap['forge'].boardUrl) businesses[2].dashUrl = dashMap['forge'].boardUrl;
      if (dashMap['growcabin'] && dashMap['growcabin'].boardUrl) businesses[3].dashUrl = dashMap['growcabin'].boardUrl;
    }

    container.innerHTML = '<div class="biz-overview-grid">' + businesses.map(biz => {
      const active = biz.cards.filter(c => c.status === 'in-progress').length;
      const backlog = biz.cards.filter(c => c.status === 'backlog').length;
      const done = biz.cards.filter(c => c.status === 'done').length;
      const total = biz.cards.length;

      return `
        <div class="biz-overview-card" data-view="${biz.id}">
          <div class="biz-overview-header">
            <span class="biz-overview-emoji">${biz.emoji}</span>
            <span class="biz-overview-name">${escapeHtml(biz.name)}</span>
          </div>
          <div class="biz-overview-desc">${escapeHtml(biz.desc)}</div>
          <div class="biz-overview-stats">
            ${total > 0 ? `
              <span class="biz-ov-stat"><strong>${active}</strong> active</span>
              <span class="biz-ov-stat"><strong>${backlog}</strong> backlog</span>
              <span class="biz-ov-stat"><strong>${done}</strong> done</span>
              <span class="biz-ov-stat"><strong>${total}</strong> total</span>
            ` : '<span class="biz-ov-stat" style="color:var(--text-muted);">No task board data</span>'}
          </div>
          <a class="biz-overview-link" href="${biz.dashUrl}" target="_blank" onclick="event.stopPropagation()">Open dashboard →</a>
        </div>
      `;
    }).join('') + '</div>';

    // Click card to switch to business detail
    container.querySelectorAll('.biz-overview-card').forEach(card => {
      card.addEventListener('click', () => switchView(card.dataset.view));
    });
  }

  // ─── Render: Personal (Financial Dashboard) ───
  function renderPersonal() {
    const container = document.getElementById('personalDetail');
    container.innerHTML = '<div class="detail-card" style="text-align:center; padding:24px;"><p>Loading financial data...</p></div>';

    // Fetch personal finance data from Firebase
    fetch('https://dashboards-5c2fb-default-rtdb.europe-west1.firebasedatabase.app/personal/finances.json')
      .then(r => r.json())
      .then(data => {
        if (!data || !data.summary) {
          container.innerHTML = '<div class="detail-card" style="text-align:center; padding:48px 24px;"><div style="font-size:48px; margin-bottom:16px;">👤</div><h3>No financial data yet</h3><p style="color:var(--text-muted);">Ask James to import your bank statements.</p></div>';
          return;
        }

        const s = data.summary;
        const cats = data.categories || {};
        const cards = data.credit_cards || {};
        const crypto = data.crypto || {};
        const monthly = data.monthly || {};

        // Sort categories by amount descending
        const catEntries = Object.entries(cats).sort((a, b) => (b[1].amount || 0) - (a[1].amount || 0));

        // Format currency
        const fmt = (n) => '£' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
        const fmt2 = (n) => '£' + (n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Credit card total
        const ccTotal = (cards.barclaycard ? cards.barclaycard.balance : 0) + (cards.mbna ? cards.mbna.balance : 0);
        const ccInterest = (cards.barclaycard ? cards.barclaycard.annualInterest : 0) + (cards.mbna ? cards.mbna.annualInterest : 0);

        // Monthly chart data
        const months = Object.keys(monthly).sort();
        const maxExp = Math.max(...months.map(m => monthly[m].expenses || 0), 1);

        container.innerHTML = `
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:20px;">
            <div class="detail-card" style="padding:16px; text-align:center;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Income</div>
              <div style="font-size:22px; font-weight:700; color:#3A7D1C;">${fmt(s.totalIncome)}</div>
            </div>
            <div class="detail-card" style="padding:16px; text-align:center;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Expenses</div>
              <div style="font-size:22px; font-weight:700; color:#C33;">${fmt(s.totalExpenses)}</div>
            </div>
            <div class="detail-card" style="padding:16px; text-align:center;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">Credit Cards</div>
              <div style="font-size:22px; font-weight:700; color:#C33;">${fmt(ccTotal)}</div>
            </div>
            <div class="detail-card" style="padding:16px; text-align:center;">
              <div style="font-size:12px; color:var(--text-muted); margin-bottom:4px;">CC Interest/yr</div>
              <div style="font-size:22px; font-weight:700; color:#C33;">${fmt(ccInterest)}</div>
            </div>
          </div>

          ${cards.mbna || cards.barclaycard ? `
          <div class="detail-card" style="padding:16px; margin-bottom:16px;">
            <h3 style="font-family:var(--font-heading); font-size:16px; margin-bottom:12px;">⚠️ Credit Cards</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
              ${cards.mbna ? `<div style="padding:12px; background:rgba(204,51,51,0.08); border-radius:8px; border-left:3px solid #C33;">
                <div style="font-weight:600; margin-bottom:4px;">MBNA</div>
                <div style="font-size:20px; font-weight:700;">${fmt(cards.mbna.balance)}</div>
                <div style="font-size:12px; color:var(--text-muted);">${cards.mbna.apr}% APR</div>
                <div style="font-size:12px; color:#C33;">~${fmt(cards.mbna.annualInterest)}/yr interest</div>
              </div>` : ''}
              ${cards.barclaycard ? `<div style="padding:12px; background:rgba(204,51,51,0.05); border-radius:8px; border-left:3px solid #E88;">
                <div style="font-weight:600; margin-bottom:4px;">Barclaycard</div>
                <div style="font-size:20px; font-weight:700;">${fmt(cards.barclaycard.balance)}</div>
                <div style="font-size:12px; color:var(--text-muted);">${cards.barclaycard.apr}% APR</div>
                <div style="font-size:12px; color:#C33;">~${fmt(cards.barclaycard.annualInterest)}/yr interest</div>
              </div>` : ''}
            </div>
          </div>` : ''}

          <div class="detail-card" style="padding:16px; margin-bottom:16px;">
            <h3 style="font-family:var(--font-heading); font-size:16px; margin-bottom:12px;">📊 Monthly Spending</h3>
            <div style="display:flex; align-items:flex-end; gap:4px; height:120px;">
              ${months.map(m => {
                const exp = monthly[m].expenses || 0;
                const pct = (exp / maxExp) * 100;
                const label = m.split('-')[1];
                const monthNames = {'04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec','01':'Jan','02':'Feb','03':'Mar'};
                return `<div style="flex:1; display:flex; flex-direction:column; align-items:center;">
                  <div style="font-size:9px; color:var(--text-muted); margin-bottom:2px;">${fmt(exp)}</div>
                  <div style="width:100%; background:var(--accent); border-radius:4px 4px 0 0; height:${Math.max(pct, 2)}%;"></div>
                  <div style="font-size:9px; color:var(--text-muted); margin-top:2px;">${monthNames[label] || label}</div>
                </div>`;
              }).join('')}
            </div>
          </div>

          <div class="detail-card" style="padding:16px; margin-bottom:16px;">
            <h3 style="font-family:var(--font-heading); font-size:16px; margin-bottom:12px;">💳 Spending by Category</h3>
            ${catEntries.map(([cat, info]) => {
              const pct = ((info.amount || 0) / s.totalExpenses) * 100;
              const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              return `<div style="margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:2px;">
                  <span>${label}</span>
                  <span style="font-weight:600;">${fmt2(info.amount)} <span style="color:var(--text-muted); font-weight:400;">(${info.txns || '?'})</span></span>
                </div>
                <div style="background:var(--surface); border-radius:4px; height:8px; overflow:hidden;">
                  <div style="background:var(--accent); height:100%; width:${pct}%; border-radius:4px;"></div>
                </div>
              </div>`;
            }).join('')}
          </div>

          ${crypto && crypto.totalDisposals ? `
          <div class="detail-card" style="padding:16px; margin-bottom:16px;">
            <h3 style="font-family:var(--font-heading); font-size:16px; margin-bottom:12px;">₿ Crypto</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px;">
              <div><span style="color:var(--text-muted);">BTC sold:</span> ${fmt(crypto.btc ? crypto.btc.sold : 0)}</div>
              <div><span style="color:var(--text-muted);">USDT sold:</span> ${fmt(crypto.usdt ? crypto.usdt.sold : 0)}</div>
              <div><span style="color:var(--text-muted);">Total disposals:</span> ${fmt(crypto.totalDisposals)}</div>
              <div><span style="color:var(--text-muted);">Fees:</span> ${fmt(crypto.totalFees)}</div>
            </div>
            <div style="margin-top:8px; padding:8px; background:rgba(255,170,0,0.1); border-radius:6px; font-size:12px;">
              ⚠️ CGT exempt: £${crypto.cgtExempt || 3000} — check if gains exceed this
            </div>
          </div>` : ''}

          <div style="font-size:11px; color:var(--text-muted); text-align:center; padding:8px;">
            FY 2025/26 (Apr 2025 – Feb 2026) · Bank + Barclaycard + MBNA + Revolut
          </div>
        `;
      })
      .catch(err => {
        container.innerHTML = '<div class="detail-card" style="text-align:center; padding:48px 24px;"><p style="color:#C33;">Failed to load financial data</p></div>';
        console.error('Personal finance fetch error:', err);
      });
  }

  // ─── Render: Ideas ───
  function renderIdeas() {
    const container = document.getElementById('ideasDetail');

    // Gather ideas from all card sources
    const sources = [
      { emoji: '🏠', name: 'Garden Buildings', cards: state.shedCards },
      { emoji: '☕', name: 'Forge AI', cards: state.forgeCards },
    ];

    let hasIdeas = false;
    let html = '';

    sources.forEach(src => {
      const ideas = src.cards.filter(c => c.status === 'ideas');
      if (!ideas.length) return;
      hasIdeas = true;

      html += `<div class="detail-card">
        <h3>${src.emoji} ${escapeHtml(src.name)}</h3>
        <div class="ideas-list">`;

      ideas.forEach(idea => {
        const prClass = idea.priority === 'high' ? 'priority-high' : idea.priority === 'low' ? 'priority-low' : 'priority-medium';
        html += `
          <div class="idea-item">
            <span class="idea-title">${escapeHtml(idea.title)}</span>
            <span class="attention-priority ${prClass}">${idea.priority || 'medium'}</span>
          </div>`;
      });

      html += '</div></div>';
    });

    if (!hasIdeas) {
      html = `
        <div class="detail-card" style="text-align:center; padding:48px 24px;">
          <div style="font-size:48px; margin-bottom:16px;">💡</div>
          <h3 style="font-family:var(--font-heading); font-size:20px; margin-bottom:8px;">No ideas yet</h3>
          <p style="color:var(--text-muted); font-size:14px;">Ideas from your business boards will appear here once tagged with status "ideas".</p>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // ─── Render: Grow Detail ───
  function renderGrowDetail() {
    document.getElementById('growDetail').innerHTML = `
      <div class="detail-links">
        <a href="https://andrewsgparsons-source.github.io/GrowCabin/dashboard/" target="_blank" class="detail-dash-link">🌱 Open Grow Cabin Dashboard →</a>
      </div>
      <div class="detail-card">
        <h3>Stage: Pre-Prototype</h3>
        <div class="james-progress" style="margin:12px 0;">
          <div class="progress-bar"><div class="progress-fill" style="width:15%"></div></div>
          <span class="progress-text">15%</span>
        </div>
      </div>

      <div class="detail-card">
        <h3>⚠️ Blocking Decisions</h3>
        <ul style="list-style:none; padding:0;">
          <li style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
            <span>Mushroom species for v0</span>
            <span class="attention-priority priority-high">pending</span>
          </li>
          <li style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
            <span>Greens format (micro vs baby leaf)</span>
            <span class="attention-priority priority-high">pending</span>
          </li>
          <li style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
            <span>One chamber vs two variants</span>
            <span class="attention-priority priority-high">pending</span>
          </li>
          <li style="padding:10px 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between;">
            <span>Isolation tier selection</span>
            <span class="attention-priority priority-high">pending</span>
          </li>
          <li style="padding:10px 0; display:flex; justify-content:space-between;">
            <span>Target price band</span>
            <span class="attention-priority priority-high">pending</span>
          </li>
        </ul>
      </div>

      <div class="detail-card">
        <h3>Research Completed</h3>
        <p style="font-size:13px; color:var(--text-secondary);">60+ documents covering product architecture, species selection, sensor stacks, business model, costs, investor pack, competitive landscape.</p>
      </div>

      <div class="detail-card">
        <h3>📊 Strategy</h3>
        <p style="font-size:13px; color:var(--text-secondary);">Validate → Prototype → Fund → First sales. Estimated 24-36 months to £100k. Only pursue after Garden Buildings or Forge AI is self-sustaining.</p>
      </div>
    `;
  }

})();
