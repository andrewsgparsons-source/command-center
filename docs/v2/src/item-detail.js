// Item Detail Panel — Notes, Documents, Photos, Associated Items
// Firebase-powered, real-time sync across devices

(function(window) {
  'use strict';

  const NOTES_PATH = 'notes';
  const DOCS_PATH = 'documents';
  const LINKS_PATH = 'links';
  const PHOTOS_PATH = 'photos';

  let currentItemId = null;
  let currentItem = null;
  let panel = null;

  // ─── Create the detail panel DOM (once) ───
  function ensurePanel() {
    if (panel) return panel;

    panel = document.createElement('div');
    panel.className = 'item-detail-panel';
    panel.innerHTML = `
      <div class="idp-backdrop" onclick="ItemDetail.close()"></div>
      <div class="idp-sheet">
        <div class="idp-header">
          <div class="idp-header-left">
            <span class="idp-biz" id="idpBiz"></span>
            <h2 class="idp-title" id="idpTitle"></h2>
            <span class="idp-status" id="idpStatus"></span>
          </div>
          <button class="idp-close" onclick="ItemDetail.close()">✕</button>
        </div>

        <div class="idp-detail" id="idpDetail"></div>

        <!-- Tabs -->
        <div class="idp-tabs">
          <button class="idp-tab active" data-tab="notes" onclick="ItemDetail.switchTab('notes')">📝 Notes</button>
          <button class="idp-tab" data-tab="docs" onclick="ItemDetail.switchTab('docs')">📎 Docs</button>
          <button class="idp-tab" data-tab="photos" onclick="ItemDetail.switchTab('photos')">📷 Photos</button>
          <button class="idp-tab" data-tab="links" onclick="ItemDetail.switchTab('links')">🔗 Links</button>
        </div>

        <!-- Tab content -->
        <div class="idp-tab-content" id="idpTabContent">

          <!-- Notes tab -->
          <div class="idp-pane" id="idpNotes" style="display:block">
            <div class="idp-list" id="idpNotesList"></div>
            <div class="idp-add-row">
              <textarea class="idp-add-input" id="idpNoteInput" placeholder="Add a note..." rows="2"></textarea>
              <button class="idp-add-btn" onclick="ItemDetail.addNote()">Add</button>
            </div>
          </div>

          <!-- Documents tab -->
          <div class="idp-pane" id="idpDocs" style="display:none">
            <div class="idp-list" id="idpDocsList"></div>
            <div class="idp-add-row idp-doc-row">
              <input class="idp-add-input" id="idpDocTitle" placeholder="Document name" />
              <input class="idp-add-input" id="idpDocUrl" placeholder="URL or file path" />
              <button class="idp-add-btn" onclick="ItemDetail.addDoc()">Add</button>
            </div>
          </div>

          <!-- Photos tab -->
          <div class="idp-pane" id="idpPhotos" style="display:none">
            <div class="idp-photo-grid" id="idpPhotoGrid"></div>
            <div class="idp-add-row">
              <label class="idp-upload-btn">
                📷 Upload Photo
                <input type="file" accept="image/*" capture="environment" id="idpPhotoInput" style="display:none" onchange="ItemDetail.uploadPhoto(this)" />
              </label>
              <span class="idp-upload-hint" id="idpUploadHint">Cloudflare Worker not configured yet</span>
            </div>
          </div>

          <!-- Links tab -->
          <div class="idp-pane" id="idpLinks" style="display:none">
            <div class="idp-list" id="idpLinksList"></div>
            <div class="idp-add-row idp-link-row">
              <select class="idp-add-input" id="idpLinkTarget">
                <option value="">Select item to link...</option>
              </select>
              <input class="idp-add-input" id="idpLinkLabel" placeholder="Relationship (optional)" />
              <button class="idp-add-btn" onclick="ItemDetail.addLink()">Add</button>
            </div>
          </div>

        </div>

        <!-- Actions -->
        <div class="idp-actions">
          <button class="idp-action-btn idp-done-btn" id="idpDoneBtn" onclick="ItemDetail.markDone()">✓ Mark Done</button>
          <button class="idp-action-btn idp-dismiss-btn" id="idpDismissBtn" onclick="ItemDetail.dismiss()">✕ Dismiss</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    return panel;
  }

  // ─── Open detail panel for an item ───
  function open(itemId, item) {
    currentItemId = itemId;
    currentItem = item;

    ensurePanel();

    // Populate header
    document.getElementById('idpBiz').textContent = item.biz || '⚡';
    document.getElementById('idpTitle').textContent = item.title || '';
    document.getElementById('idpStatus').textContent = item.status || 'active';
    document.getElementById('idpStatus').className = 'idp-status status-' + (item.status || 'active');
    document.getElementById('idpDetail').textContent = item.detail || '';

    // Show/hide action buttons based on status
    const doneBtn = document.getElementById('idpDoneBtn');
    const dismissBtn = document.getElementById('idpDismissBtn');
    if (item.status === 'done' || item.status === 'dismissed') {
      doneBtn.style.display = 'none';
      dismissBtn.style.display = 'none';
    } else {
      doneBtn.style.display = '';
      dismissBtn.style.display = '';
    }

    // Load tab data
    switchTab('notes');
    loadNotes();
    loadDocs();
    loadPhotos();
    loadLinks();

    // Populate link target dropdown with all attention items
    populateLinkTargets();

    // Show panel
    panel.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    if (!panel) return;

    // Detach Firebase listeners before clearing ID
    if (currentItemId && window.FireSync) {
      const db = FireSync.db();
      if (db) {
        db.ref(NOTES_PATH + '/' + currentItemId).off();
        db.ref(DOCS_PATH + '/' + currentItemId).off();
        db.ref(PHOTOS_PATH + '/' + currentItemId).off();
        db.ref(LINKS_PATH + '/' + currentItemId).off();
      }
    }

    panel.classList.remove('open');
    document.body.style.overflow = '';
    currentItemId = null;
    currentItem = null;
  }

  // ─── Tab switching ───
  function switchTab(tabName) {
    document.querySelectorAll('.idp-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.idp-pane').forEach(p => p.style.display = 'none');

    const paneMap = { notes: 'idpNotes', docs: 'idpDocs', photos: 'idpPhotos', links: 'idpLinks' };
    const pane = document.getElementById(paneMap[tabName]);
    if (pane) pane.style.display = 'block';
  }

  // ─── Notes ───
  function loadNotes() {
    if (!currentItemId || !window.FireSync) return;
    FireSync.onTasks(NOTES_PATH + '/' + currentItemId, renderNotes);
  }

  function renderNotes(notesObj) {
    const list = document.getElementById('idpNotesList');
    const notes = Object.entries(notesObj)
      .map(([id, n]) => ({ ...n, id }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (notes.length === 0) {
      list.innerHTML = '<div class="idp-empty">No notes yet</div>';
      return;
    }

    list.innerHTML = notes.map(n => {
      const when = n.createdAt ? timeAgo(n.createdAt) : '';
      const author = n.author || 'Andrew';
      return `
        <div class="idp-note">
          <div class="idp-note-header">
            <span class="idp-note-author">${escHtml(author)}</span>
            <span class="idp-note-time">${when}</span>
            <button class="idp-del-btn" onclick="ItemDetail.deleteNote('${n.id}')" title="Delete">🗑</button>
          </div>
          <div class="idp-note-text">${escHtml(n.text)}</div>
        </div>
      `;
    }).join('');
  }

  function addNote() {
    const input = document.getElementById('idpNoteInput');
    const text = input.value.trim();
    if (!text || !currentItemId) return;

    FireSync.addTask(NOTES_PATH + '/' + currentItemId, {
      text: text,
      author: 'Andrew',
      createdAt: new Date().toISOString()
    });

    input.value = '';
  }

  function deleteNote(noteId) {
    if (!currentItemId) return;
    FireSync.deleteTask(NOTES_PATH + '/' + currentItemId, noteId);
  }

  // ─── Documents ───
  function loadDocs() {
    if (!currentItemId || !window.FireSync) return;
    FireSync.onTasks(DOCS_PATH + '/' + currentItemId, renderDocs);
  }

  function renderDocs(docsObj) {
    const list = document.getElementById('idpDocsList');
    const docs = Object.entries(docsObj)
      .map(([id, d]) => ({ ...d, id }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (docs.length === 0) {
      list.innerHTML = '<div class="idp-empty">No documents yet</div>';
      return;
    }

    list.innerHTML = docs.map(d => {
      const icon = getDocIcon(d.url);
      return `
        <div class="idp-doc">
          <span class="idp-doc-icon">${icon}</span>
          <a href="${escAttr(d.url)}" target="_blank" class="idp-doc-title">${escHtml(d.title || d.url)}</a>
          <button class="idp-del-btn" onclick="ItemDetail.deleteDoc('${d.id}')" title="Delete">🗑</button>
        </div>
      `;
    }).join('');
  }

  function addDoc() {
    const titleInput = document.getElementById('idpDocTitle');
    const urlInput = document.getElementById('idpDocUrl');
    const title = titleInput.value.trim();
    const url = urlInput.value.trim();
    if (!url || !currentItemId) return;

    FireSync.addTask(DOCS_PATH + '/' + currentItemId, {
      title: title || url,
      url: url,
      createdAt: new Date().toISOString()
    });

    titleInput.value = '';
    urlInput.value = '';
  }

  function deleteDoc(docId) {
    if (!currentItemId) return;
    FireSync.deleteTask(DOCS_PATH + '/' + currentItemId, docId);
  }

  function getDocIcon(url) {
    if (!url) return '📄';
    const lower = url.toLowerCase();
    if (lower.includes('github.com')) return '🐙';
    if (lower.includes('docs.google') || lower.endsWith('.doc') || lower.endsWith('.docx')) return '📝';
    if (lower.endsWith('.pdf')) return '📕';
    if (lower.endsWith('.xls') || lower.endsWith('.xlsx') || lower.includes('sheets.google')) return '📊';
    if (lower.includes('drive.google')) return '💾';
    if (lower.includes('notion.')) return '📓';
    return '📄';
  }

  // ─── Photos ───
  function loadPhotos() {
    if (!currentItemId || !window.FireSync) return;
    FireSync.onTasks(PHOTOS_PATH + '/' + currentItemId, renderPhotos);
  }

  function renderPhotos(photosObj) {
    const grid = document.getElementById('idpPhotoGrid');
    const photos = Object.entries(photosObj)
      .map(([id, p]) => ({ ...p, id }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (photos.length === 0) {
      grid.innerHTML = '<div class="idp-empty">No photos yet</div>';
      return;
    }

    grid.innerHTML = photos.map(p => `
      <div class="idp-photo">
        <img src="${escAttr(p.url)}" alt="${escAttr(p.caption || '')}" onclick="ItemDetail.viewPhoto('${escAttr(p.url)}')" />
        ${p.caption ? '<div class="idp-photo-caption">' + escHtml(p.caption) + '</div>' : ''}
        <button class="idp-photo-del" onclick="ItemDetail.deletePhoto('${p.id}')" title="Delete">✕</button>
      </div>
    `).join('');
  }

  function uploadPhoto(input) {
    // TODO: Connect to Cloudflare Worker for actual upload
    // For now, show a message
    const hint = document.getElementById('idpUploadHint');
    if (input.files && input.files[0]) {
      hint.textContent = 'Photo upload will be available once Cloudflare Worker is set up. File selected: ' + input.files[0].name;
      hint.style.color = '#B45309';
    }
  }

  function viewPhoto(url) {
    // Simple lightbox
    const lb = document.createElement('div');
    lb.className = 'idp-lightbox';
    lb.onclick = () => lb.remove();
    lb.innerHTML = `<img src="${escAttr(url)}" />`;
    document.body.appendChild(lb);
  }

  function deletePhoto(photoId) {
    if (!currentItemId) return;
    FireSync.deleteTask(PHOTOS_PATH + '/' + currentItemId, photoId);
  }

  // ─── Associated Items (Links) ───
  function loadLinks() {
    if (!currentItemId || !window.FireSync) return;
    FireSync.onTasks(LINKS_PATH + '/' + currentItemId, renderLinks);
  }

  function renderLinks(linksObj) {
    const list = document.getElementById('idpLinksList');
    const links = Object.entries(linksObj)
      .map(([id, l]) => ({ ...l, id }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    if (links.length === 0) {
      list.innerHTML = '<div class="idp-empty">No linked items yet</div>';
      return;
    }

    list.innerHTML = links.map(l => {
      const label = l.label || 'Related';
      return `
        <div class="idp-link">
          <span class="idp-link-label">${escHtml(label)}</span>
          <span class="idp-link-target" onclick="ItemDetail.navigateToLink('${l.targetId}')">${escHtml(l.targetTitle || l.targetId)}</span>
          <button class="idp-del-btn" onclick="ItemDetail.deleteLink('${l.id}')" title="Remove link">🗑</button>
        </div>
      `;
    }).join('');
  }

  function populateLinkTargets() {
    const select = document.getElementById('idpLinkTarget');
    // Clear existing options except first
    select.innerHTML = '<option value="">Select item to link...</option>';

    // Get all attention items from FireSync
    FireSync.getTasks('attention', items => {
      Object.entries(items).forEach(([id, item]) => {
        if (id === currentItemId) return; // Don't link to self
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = (item.biz || '⚡') + ' ' + (item.title || id);
        opt.dataset.title = item.title || id;
        select.appendChild(opt);
      });
    });
  }

  function addLink() {
    const select = document.getElementById('idpLinkTarget');
    const labelInput = document.getElementById('idpLinkLabel');
    const targetId = select.value;
    if (!targetId || !currentItemId) return;

    const targetTitle = select.options[select.selectedIndex].dataset.title || targetId;
    const label = labelInput.value.trim() || 'Related';

    // Add link in both directions
    FireSync.addTask(LINKS_PATH + '/' + currentItemId, {
      targetId: targetId,
      targetTitle: targetTitle,
      label: label,
      createdAt: new Date().toISOString()
    });

    // Reverse link
    FireSync.addTask(LINKS_PATH + '/' + targetId, {
      targetId: currentItemId,
      targetTitle: currentItem ? currentItem.title : currentItemId,
      label: label,
      createdAt: new Date().toISOString()
    });

    select.value = '';
    labelInput.value = '';
  }

  function deleteLink(linkId) {
    if (!currentItemId) return;
    FireSync.deleteTask(LINKS_PATH + '/' + currentItemId, linkId);
  }

  function navigateToLink(targetId) {
    // Close current panel, open target
    close();
    FireSync.getTasks('attention/' + targetId, item => {
      if (item) open(targetId, item);
    });
  }

  // ─── Actions ───
  function markDone() {
    if (!currentItemId) return;
    FireSync.completeAttentionItem(currentItemId);
    close();
  }

  function dismiss() {
    if (!currentItemId) return;
    FireSync.dismissAttentionItem(currentItemId);
    close();
  }

  // ─── Utilities ───
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function escAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function timeAgo(iso) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 30) return days + 'd ago';
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ─── Export ───
  window.ItemDetail = {
    open,
    close,
    switchTab,
    addNote,
    deleteNote,
    addDoc,
    deleteDoc,
    uploadPhoto,
    viewPhoto,
    deletePhoto,
    addLink,
    deleteLink,
    navigateToLink,
    markDone,
    dismiss,
  };

})(window);
