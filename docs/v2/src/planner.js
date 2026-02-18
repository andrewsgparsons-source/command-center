// Solution Planner v2 — Command Centre with Sidebar Navigation

(function() {
  'use strict';

  // ─── Data Sources ───
  const DATA_URLS = {
    sheds: 'https://andrewsgparsons-source.github.io/shed-project-board/data/cards.json',
    farm:  'https://andrewsgparsons-source.github.io/whelpley-farm-dashboard/data/financial_data.json',
    forge: 'https://raw.githubusercontent.com/andrewsgparsons-source/forge-ai/main/data/cards.json',
    gptChats: '../data/gpt-chats.json',
  };

  // ─── State ───
  let state = {
    currentView: localStorage.getItem('sp2-view') || 'today',
    filter: 'all',
    shedCards: [],
    farmFinancials: null,
    forgeCards: [],
    gptChats: [],
  };

  // ─── Init ───
  document.addEventListener('DOMContentLoaded', async () => {
    setGreeting();
    setupSidebarNav();
    setupMobileMenu();
    setupBusinessFilter();
    await loadAllData();
    switchView(state.currentView);
    document.getElementById('loadingScreen').style.display = 'none';
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

    // Scroll to top
    window.scrollTo(0, 0);
  }

  function renderView(viewId) {
    switch(viewId) {
      case 'today': renderToday(); break;
      case 'questions': renderQuestions(); break;
      case 'james': renderJamesDetail(); break;
      case 'gpt-chats': renderGptChats(); break;
      case 'biz-sheds': renderShedDetail(); break;
      case 'biz-farm': renderFarmDetail(); break;
      case 'biz-forge': renderForgeDetail(); break;
      case 'biz-grow': renderGrowDetail(); break;
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

    // Update sidebar badges
    document.getElementById('navGptBadge').textContent = state.gptChats.length;
    // Attention badge is updated by Firebase listener
    document.getElementById('navShedBadge').textContent = state.shedCards.filter(c => c.status === 'in-progress').length;
    document.getElementById('sidebarStatus').textContent = `Data loaded · ${new Date().toLocaleTimeString('en-GB', {hour:'2-digit', minute:'2-digit'})}`;
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
      { emoji: '📋', title: 'What am I working on?', summary: `${sIP+fIP} active · ${sBL} queued · ${sDN+fDN} done`, status: 'live', label: 'Live data' },
      { emoji: '💰', title: "How's my money?", summary: state.farmFinancials ? 'Farm data available · Sheds coming soon' : 'Coming soon on update', status: state.farmFinancials ? 'partial' : 'coming', label: state.farmFinancials ? 'Partial' : 'Coming soon' },
      { emoji: '👥', title: 'Who are my customers?', summary: 'Coming soon on update', status: 'coming', label: 'Coming soon' },
      { emoji: '📦', title: 'What do I need?', summary: 'Coming soon on update', status: 'coming', label: 'Coming soon' },
      { emoji: '🧭', title: 'Where am I heading?', summary: '4 strategies defined · OKRs coming soon', status: 'partial', label: 'Partial' },
      { emoji: '🤝', title: "Who's helping?", summary: 'Coming soon on update', status: 'coming', label: 'Coming soon' },
      { emoji: '♻️', title: 'What am I wasting?', summary: state.farmFinancials ? 'Farm contractor analysis available' : 'Coming soon on update', status: state.farmFinancials ? 'partial' : 'coming', label: state.farmFinancials ? 'Partial' : 'Coming soon' },
      { emoji: '💡', title: "What's new?", summary: `${state.shedCards.filter(c => c.status === 'ideas').length} shed ideas · Incubator active`, status: 'live', label: 'Live data' },
    ];

    container.innerHTML = questions.map(q => `
      <div class="question-card">
        <span class="question-emoji">${q.emoji}</span>
        <div class="question-content">
          <div class="question-title">${q.title}</div>
          <div class="question-summary">${q.summary}</div>
        </div>
        <span class="question-badge ${q.status}">${q.label}</span>
        <span class="question-arrow">›</span>
      </div>
    `).join('');
  }

  // ─── Render: James Detail ───
  function renderJamesDetail() {
    document.getElementById('jamesDetail').innerHTML = `
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
              <div class="gpt-text-block gpt-prompt">${escapeHtml(chat.prompt)}</div>
            </div>
            <div class="gpt-section">
              <h3>📥 ChatGPT Response</h3>
              <div class="gpt-text-block gpt-response">${escapeHtml(chat.response)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
  }

  // ─── Render: Shed Detail ───
  function renderShedDetail() {
    const cards = state.shedCards;
    const ip = cards.filter(c => c.status === 'in-progress').length;
    const bl = cards.filter(c => c.status === 'backlog').length;
    const dn = cards.filter(c => c.status === 'done').length;
    const id = cards.filter(c => c.status === 'ideas').length;

    document.getElementById('shedDetail').innerHTML = `
      <div class="detail-card">
        <h3>Configurator Development</h3>
        <div class="detail-stat-row">
          <div class="detail-stat"><div class="detail-stat-value">${ip}</div><div class="detail-stat-label">In Progress</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${bl}</div><div class="detail-stat-label">Backlog</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${dn}</div><div class="detail-stat-label">Done</div></div>
          <div class="detail-stat"><div class="detail-stat-value">${id}</div><div class="detail-stat-label">Ideas</div></div>
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

  // ─── Render: Grow Detail ───
  function renderGrowDetail() {
    document.getElementById('growDetail').innerHTML = `
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
