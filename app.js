/**
 * Clp — Universal Real-Time Clipboard Synchronization Studio
 * Frontend Application Controller & Mesh Network Manager
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  const state = {
    activeTab: 'dashboard',
    activeFilter: 'all',
    searchQuery: '',
    audioEnabled: true,
    autoPasteEnabled: true,
    e2eeEnabled: true,
    e2eePassphrase: 'clp-super-secure-mesh-key-2026',
    activeClip: {
      id: 'clip-init',
      content: 'https://github.com/DocHoax/clp-universal-sync',
      type: 'link',
      originDevice: '💻 MacBook Pro 16"',
      timestamp: Date.now() - 45000,
      pinned: true
    },
    clips: [
      {
        id: 'clip-1',
        content: 'https://github.com/DocHoax/clp-universal-sync',
        type: 'link',
        originDevice: '💻 MacBook Pro 16"',
        timestamp: Date.now() - 45000,
        pinned: true
      },
      {
        id: 'clip-2',
        content: 'const clpSync = new WebSocket("ws://localhost:5000/sync");\nclpSync.onmessage = (e) => console.log(JSON.parse(e.data));',
        type: 'code',
        originDevice: '🐧 ThinkPad X1 (Linux)',
        timestamp: Date.now() - 180000,
        pinned: true
      },
      {
        id: 'clip-3',
        content: '#8b5cf6',
        type: 'color',
        originDevice: '📱 iPhone 16 Pro',
        timestamp: Date.now() - 360000,
        pinned: false
      },
      {
        id: 'clip-4',
        content: '{\n  "status": "synchronized",\n  "nodes": 4,\n  "meshProtocol": "E2EE-AES-GCM",\n  "latencyMs": 8\n}',
        type: 'json',
        originDevice: '🖥️ Alienware 38" (Windows)',
        timestamp: Date.now() - 720000,
        pinned: false
      },
      {
        id: 'clip-5',
        content: 'Meeting notes: Finalize multi-device cross-clipboard bridge release candidates by Friday.',
        type: 'text',
        originDevice: '💻 MacBook Pro 16"',
        timestamp: Date.now() - 1440000,
        pinned: false
      }
    ],
    devices: [
      { id: 'dev-macbook', name: 'MacBook Pro 16"', os: 'macos', icon: '💻', active: true, latency: '8ms', battery: '92%' },
      { id: 'dev-iphone', name: 'iPhone 16 Pro', os: 'ios', icon: '📱', active: true, latency: '12ms', battery: '88%' },
      { id: 'dev-windows', name: 'Alienware 38" Desktop', os: 'windows', icon: '🖥️', active: true, latency: '6ms', battery: 'AC' },
      { id: 'dev-linux', name: 'ThinkPad X1 Ubuntu', os: 'linux', icon: '🐧', active: true, latency: '11ms', battery: '76%' }
    ],
    streamLogs: [],
    wsClient: null,
    broadcastChannel: null,
    pairingCode: 'CLP-' + Math.floor(1000 + Math.random() * 9000) + '-SYNC',
    lastCopiedText: ''
  };

  // Load persisted history from localStorage if available
  try {
    const saved = localStorage.getItem('clp_saved_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        state.clips = parsed;
        state.activeClip = parsed[0];
      }
    }
  } catch (e) {
    console.warn('Could not read localStorage:', e);
  }

  // --- AUDIO SYNTHESIZER (Web Audio API) ---
  let audioCtx = null;
  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playSound(type) {
    if (!state.audioEnabled) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'sync') {
        // High-tech futuristic double chime (violet sync)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.08); // A5
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1174.66, now + 0.06); // D6
        gain2.gain.setValueAtTime(0.08, now + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
        osc2.start(now + 0.06);
        osc2.stop(now + 0.26);

      } else if (type === 'copy') {
        // Crisp tick sound
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.04);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);

      } else if (type === 'connect') {
        // Ascending chord
        [440, 554.37, 659.25].forEach((freq, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          o.connect(g);
          g.connect(ctx.destination);
          g.gain.setValueAtTime(0.06, now + i * 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.05 + 0.25);
          o.start(now + i * 0.05);
          o.stop(now + i * 0.05 + 0.25);
        });
      } else if (type === 'delete') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch (e) {
      console.warn('Audio synthesis failed:', e);
    }
  }

  // --- CONTENT CLASSIFIER ---
  function detectContentType(text) {
    if (!text || typeof text !== 'string') return 'text';
    const trimmed = text.trim();

    // 1. URL detection
    if (/^https?:\/\/[^\s]+$/i.test(trimmed)) {
      return 'link';
    }

    // 2. Color Hex / RGB / HSL
    if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed) || 
        /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/i.test(trimmed) ||
        /^hsla?\(\s*\d+\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)$/i.test(trimmed)) {
      return 'color';
    }

    // 3. JSON detection
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        JSON.parse(trimmed);
        return 'json';
      } catch (e) {
        // Not valid JSON
      }
    }

    // 4. Code detection heuristics
    const codeIndicators = [
      'const ', 'let ', 'var ', 'function ', 'import ', 'export ', 'class ',
      'def ', 'return ', 'print(', 'console.', '<div', '</div>', '=>', 'SELECT ',
      'FROM ', 'WHERE ', 'async ', 'await ', 'public ', 'private ', 'interface '
    ];
    let matches = 0;
    for (const token of codeIndicators) {
      if (trimmed.includes(token)) matches++;
    }
    if (matches >= 2 || (matches >= 1 && (trimmed.includes(';') || trimmed.includes('{') || trimmed.includes('}')))) {
      return 'code';
    }

    return 'text';
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info', icon = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let defaultIcon = '✨';
    if (type === 'success') defaultIcon = '✓';
    if (type === 'warning') defaultIcon = '⚠️';
    if (type === 'sync') defaultIcon = '⚡';

    toast.innerHTML = `
      <div class="toast-icon">${icon || defaultIcon}</div>
      <div class="toast-message">${escapeHtml(message)}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px) scale(0.95)';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatRelativeTime(ts) {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 10) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  // --- MESH & BROADCAST ENGINE ---
  function initMeshChannels() {
    // 1. Cross-tab BroadcastChannel
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        state.broadcastChannel = new BroadcastChannel('clp_universal_sync_mesh');
        state.broadcastChannel.onmessage = (event) => {
          if (event.data && event.data.type === 'clip_broadcast') {
            handleIncomingClip(event.data.payload, false);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel error:', e);
    }

    // 2. Storage event fallback for cross-tab sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'clp_cross_tab_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.id !== state.activeClip.id) {
            handleIncomingClip(data, false);
          }
        } catch (err) {}
      }
    });

    // 3. Connect to WebSocket backend if available
    connectWebSocket();
  }

  function connectWebSocket() {
    const wsUrl = (document.getElementById('setting-ws-url')?.value || 'ws://localhost:5000/sync');
    const token = (document.getElementById('setting-user-token')?.value || 'mock-token-adam');
    const deviceName = encodeURIComponent(document.getElementById('setting-device-name')?.value || 'Web Studio Client');
    
    try {
      const fullUrl = `${wsUrl}?token=${token}&deviceName=${deviceName}&osType=web`;
      state.wsClient = new WebSocket(fullUrl);

      state.wsClient.onopen = () => {
        updateNetworkStatus(true, 'Live Sync', '8ms');
        logActivity('Connected to backend WebSocket mesh', 'device');
        playSound('connect');
      };

      state.wsClient.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === 'clipboard_sync' && parsed.payload) {
            handleIncomingClip({
              id: 'ws-' + Date.now(),
              content: parsed.payload.content,
              originDevice: 'Remote Peer (WS)',
              timestamp: parsed.payload.timestamp || Date.now()
            }, false);
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      state.wsClient.onclose = () => {
        updateNetworkStatus(true, 'Local Peer Bus', '< 2ms');
        // Auto reconnect attempt after 5 seconds
        setTimeout(connectWebSocket, 8000);
      };

      state.wsClient.onerror = () => {
        // Seamless fallback to peer broadcast
        updateNetworkStatus(true, 'Local Peer Mesh', '< 1ms');
      };
    } catch (e) {
      updateNetworkStatus(true, 'Local Peer Mesh', '< 1ms');
    }
  }

  function updateNetworkStatus(online, text, latency) {
    const pill = document.getElementById('status-pill');
    const txt = document.getElementById('status-text');
    const lat = document.getElementById('status-latency');
    if (txt) txt.textContent = text;
    if (lat) lat.textContent = latency;
    if (pill) {
      pill.className = online ? 'status-pill status-connected' : 'status-pill';
    }
  }

  // --- CLIP ACTIONS ---
  function broadcastClip(content, origin = 'Web Studio Client', notify = true) {
    if (!content || !content.trim()) {
      showToast('Clipboard content is empty', 'warning');
      return;
    }

    const type = detectContentType(content);
    const newClip = {
      id: 'clip-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      content,
      type,
      originDevice: origin,
      timestamp: Date.now(),
      pinned: false
    };

    handleIncomingClip(newClip, true);

    // Broadcast across all open browser tabs
    if (state.broadcastChannel) {
      state.broadcastChannel.postMessage({
        type: 'clip_broadcast',
        payload: newClip
      });
    }

    // Persist to storage event
    try {
      localStorage.setItem('clp_cross_tab_event', JSON.stringify(newClip));
    } catch (e) {}

    // Send to WebSocket backend if connected
    if (state.wsClient && state.wsClient.readyState === WebSocket.OPEN) {
      state.wsClient.send(JSON.stringify({
        type: 'clipboard_update',
        payload: {
          content: content,
          timestamp: Date.now()
        }
      }));
    }

    if (notify) {
      showToast(`Broadcasted clip to all 4 mesh devices`, 'success', '⚡');
    }
  }

  function handleIncomingClip(clip, isLocal = false) {
    state.activeClip = clip;

    // Check if clip already in list
    const existingIdx = state.clips.findIndex(c => c.content === clip.content);
    if (existingIdx !== -1) {
      // Move to top and preserve pinned status
      const existing = state.clips.splice(existingIdx, 1)[0];
      clip.pinned = existing.pinned;
      state.clips.unshift(clip);
    } else {
      state.clips.unshift(clip);
      if (state.clips.length > 50) state.clips.pop();
    }

    // Save to localStorage
    try {
      localStorage.setItem('clp_saved_history', JSON.stringify(state.clips));
    } catch (e) {}

    // Play sound & notify
    playSound('sync');
    logActivity(`Synced from <strong>${clip.originDevice}</strong> (${clip.content.length} chars)`, 'sync');

    // Update UI elements
    renderActiveClip();
    renderHistoryCards();
    updateMetrics();
    syncSimulatedDevices(clip);

    // Auto-update cipher inspector
    updateCipherDemo(clip.content);
  }

  function copyToSystemClipboard(text, notifyText = 'Copied to system clipboard!') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        state.lastCopiedText = text;
        playSound('copy');
        showToast(notifyText, 'success', '📋');
      }).catch(err => {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      state.lastCopiedText = text;
      playSound('copy');
      showToast('Copied to system clipboard!', 'success', '📋');
    } catch (err) {
      showToast('Could not access clipboard', 'warning');
    }
    document.body.removeChild(ta);
  }

  function readSystemClipboard() {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(text => {
        if (text && text.trim()) {
          const input = document.getElementById('clip-input');
          if (input) {
            input.value = text;
            updateInputStats();
          }
          showToast('Grabbed system clipboard content', 'info', '📥');
          playSound('copy');
        } else {
          showToast('System clipboard is currently empty', 'warning');
        }
      }).catch(err => {
        showToast('Clipboard read access was not granted by browser', 'warning');
      });
    } else {
      showToast('System clipboard API unavailable in this browser context', 'warning');
    }
  }

  // --- RENDER FUNCTIONS ---
  function renderActiveClip() {
    const clip = state.activeClip;
    const originEl = document.getElementById('active-clip-origin');
    const timeEl = document.getElementById('active-clip-time');
    const contentEl = document.getElementById('active-clip-content');
    const lenEl = document.getElementById('active-clip-length');
    const typeEl = document.getElementById('active-clip-type');

    if (originEl) originEl.textContent = clip.originDevice || 'Mesh Device';
    if (timeEl) timeEl.textContent = formatRelativeTime(clip.timestamp);
    if (lenEl) lenEl.textContent = `${clip.content.length} chars`;
    if (typeEl) typeEl.textContent = clip.type ? clip.type.toUpperCase() : 'TEXT';

    if (contentEl) {
      if (clip.type === 'color') {
        contentEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:12px;">
            <div class="color-swatch-box" style="background-color: ${escapeHtml(clip.content)}; width:36px; height:36px;"></div>
            <code>${escapeHtml(clip.content)}</code>
          </div>
        `;
      } else if (clip.type === 'link') {
        contentEl.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#06b6d4;">🔗</span>
            <a href="${escapeHtml(clip.content)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8; text-decoration:underline; word-break:break-all;">${escapeHtml(clip.content)}</a>
          </div>
        `;
      } else {
        contentEl.innerHTML = `<code>${escapeHtml(clip.content)}</code>`;
      }
    }
  }

  function renderHistoryCards() {
    const container = document.getElementById('history-cards-container');
    if (!container) return;

    let filtered = state.clips;

    // Apply Filter
    if (state.activeFilter === 'pinned') {
      filtered = filtered.filter(c => c.pinned);
    } else if (state.activeFilter !== 'all') {
      filtered = filtered.filter(c => c.type === state.activeFilter);
    }

    // Apply Search
    if (state.searchQuery.trim()) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.content.toLowerCase().includes(q) || 
        (c.originDevice && c.originDevice.toLowerCase().includes(q)) ||
        (c.type && c.type.toLowerCase().includes(q))
      );
    }

    // Update filter badge counts
    updateFilterCounts();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📭</div>
          <p style="font-size: 14px; font-weight: 500;">No clipboard items match your criteria</p>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(clip => {
      let previewHtml = escapeHtml(clip.content);
      if (clip.type === 'color') {
        previewHtml = `
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="display:inline-block; width:18px; height:18px; border-radius:4px; background:${escapeHtml(clip.content)}; border:1px solid rgba(255,255,255,0.3);"></span>
            <span>${escapeHtml(clip.content)}</span>
          </div>
        `;
      }

      return `
        <div class="history-card ${clip.pinned ? 'pinned' : ''}" data-clip-id="${clip.id}">
          <div class="history-card-header">
            <span class="history-type-badge ${clip.type || 'text'}">${clip.type || 'text'}</span>
            <div class="history-card-actions">
              <button class="icon-btn clip-pin-btn" data-id="${clip.id}" title="${clip.pinned ? 'Unpin' : 'Pin'}" style="width:28px; height:28px;">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="${clip.pinned ? '#fbbf24' : 'currentColor'}" fill="${clip.pinned ? '#fbbf24' : 'none'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              </button>
              <button class="icon-btn clip-copy-btn" data-id="${clip.id}" title="Copy to system" style="width:28px; height:28px;">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button class="icon-btn clip-delete-btn" data-id="${clip.id}" title="Delete clip" style="width:28px; height:28px;">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div class="history-content-preview">${previewHtml}</div>

          <div class="history-card-footer">
            <span>${escapeHtml(clip.originDevice || 'Mesh')}</span>
            <span>${formatRelativeTime(clip.timestamp)}</span>
          </div>
        </div>
      `;
    }).join('');

    // Attach card event listeners
    container.querySelectorAll('.clip-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const clip = state.clips.find(c => c.id === id);
        if (clip) copyToSystemClipboard(clip.content);
      });
    });

    container.querySelectorAll('.clip-pin-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const clip = state.clips.find(c => c.id === id);
        if (clip) {
          clip.pinned = !clip.pinned;
          playSound('copy');
          renderHistoryCards();
          try { localStorage.setItem('clp_saved_history', JSON.stringify(state.clips)); } catch (err) {}
        }
      });
    });

    container.querySelectorAll('.clip-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        state.clips = state.clips.filter(c => c.id !== id);
        playSound('delete');
        renderHistoryCards();
        updateMetrics();
        try { localStorage.setItem('clp_saved_history', JSON.stringify(state.clips)); } catch (err) {}
      });
    });
  }

  function updateFilterCounts() {
    const total = state.clips.length;
    const pinned = state.clips.filter(c => c.pinned).length;
    const links = state.clips.filter(c => c.type === 'link').length;
    const codes = state.clips.filter(c => c.type === 'code').length;
    const colors = state.clips.filter(c => c.type === 'color').length;
    const jsons = state.clips.filter(c => c.type === 'json').length;
    const texts = state.clips.filter(c => c.type === 'text').length;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('filter-count-all', total);
    setTxt('filter-count-pinned', pinned);
    setTxt('filter-count-link', links);
    setTxt('filter-count-code', codes);
    setTxt('filter-count-color', colors);
    setTxt('filter-count-json', jsons);
    setTxt('filter-count-text', texts);

    const badge = document.getElementById('history-count-badge');
    if (badge) badge.textContent = total;
  }

  function renderDevicesList() {
    const list = document.getElementById('connected-devices-list');
    if (!list) return;

    list.innerHTML = state.devices.map(dev => `
      <div class="device-item">
        <div class="device-item-left">
          <div class="device-icon-box">${dev.icon}</div>
          <div class="device-details">
            <span class="device-name-text">${escapeHtml(dev.name)}</span>
            <span class="device-meta-sub">${dev.os.toUpperCase()} • Latency: ${dev.latency}</span>
          </div>
        </div>
        <div class="device-item-right">
          <span class="status-badge-online">Online</span>
        </div>
      </div>
    `).join('');
  }

  function updateMetrics() {
    const totalClips = document.getElementById('metric-total-clips');
    const activeDevs = document.getElementById('metric-active-devices');
    if (totalClips) totalClips.textContent = state.clips.length;
    if (activeDevs) activeDevs.textContent = state.devices.length;
  }

  function logActivity(msg, type = 'sync') {
    const stream = document.getElementById('sync-activity-stream');
    if (!stream) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.className = `stream-entry entry-${type}`;
    entry.innerHTML = `
      <span class="stream-time">${timeStr}</span>
      <span class="stream-msg">${msg}</span>
    `;

    stream.insertBefore(entry, stream.firstChild);

    // Limit stream size
    while (stream.children.length > 25) {
      stream.removeChild(stream.lastChild);
    }
  }

  // --- MULTI-DEVICE SIMULATOR SYNC ---
  function syncSimulatedDevices(clip) {
    document.querySelectorAll('.sim-device').forEach(dev => {
      const devId = dev.dataset.deviceId;
      const ta = dev.querySelector('.sim-textarea');
      const notif = dev.querySelector('.sim-device-notification');

      if (ta && ta.value !== clip.content) {
        ta.value = clip.content;
      }

      if (notif) {
        const notifTxt = notif.querySelector('.sim-notif-text');
        if (notifTxt) notifTxt.textContent = `📥 Synced from ${clip.originDevice || 'Mesh'}`;
        notif.classList.remove('hidden');
        setTimeout(() => notif.classList.add('hidden'), 2800);
      }
    });
  }

  function setupSimulatorEvents() {
    document.querySelectorAll('.sim-device').forEach(dev => {
      const devId = dev.dataset.deviceId;
      const copyBtn = dev.querySelector('.sim-copy-btn');
      const pasteBtn = dev.querySelector('.sim-paste-btn');
      const ta = dev.querySelector('.sim-textarea');
      const title = dev.querySelector('.frame-title')?.textContent || 'Device';

      if (copyBtn && ta) {
        copyBtn.addEventListener('click', () => {
          const val = ta.value;
          if (val && val.trim()) {
            broadcastClip(val, title, true);
          } else {
            showToast('Type some text in the device first', 'warning');
          }
        });
      }

      if (pasteBtn && ta) {
        pasteBtn.addEventListener('click', () => {
          ta.value = state.activeClip.content || '';
          playSound('copy');
          showToast(`Pasted active universal clip into ${title}`, 'info');
        });
      }
    });

    const sampleBtn = document.getElementById('sim-random-data-btn');
    if (sampleBtn) {
      const samples = [
        'curl -X POST https://api.clp.dev/v1/sync -H "Authorization: Bearer mock-token-adam"',
        'rgb(14, 165, 233)',
        'https://tailwindcss.com/docs/backdrop-blur',
        '{"event": "device_mesh_heartbeat", "status": 200, "activeNodes": 4}',
        'SSH Key: ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG... user@macbook'
      ];
      sampleBtn.addEventListener('click', () => {
        const item = samples[Math.floor(Math.random() * samples.length)];
        broadcastClip(item, '💻 MacBook Pro 16"');
      });
    }

    const triggerAllBtn = document.getElementById('sim-send-all-btn');
    if (triggerAllBtn) {
      triggerAllBtn.addEventListener('click', () => {
        const text = `Mesh pulse broadcast @ ${new Date().toLocaleTimeString()}`;
        broadcastClip(text, '⚡ Mesh Broadcast Node');
      });
    }
  }

  // --- CIPHER INSPECTOR & E2EE TESTBED ---
  function updateCipherDemo(plainText) {
    const input = document.getElementById('cipher-sample-plain');
    const out = document.getElementById('cipher-wire-output');
    if (input && plainText) input.value = plainText;
    
    const src = (input ? input.value : plainText) || 'Secret payload';
    
    // Simulate AES-GCM IV + AuthTag + Encrypted Base64 wire string
    try {
      const iv = btoa(Math.random().toString(36).substr(2, 8));
      const simulatedEnc = btoa(encodeURIComponent(src).split('').reverse().join(''));
      const wire = btoa(JSON.stringify({ iv, cph: simulatedEnc.substr(0, 32) + '...' }));
      if (out) out.textContent = wire;
    } catch (e) {
      if (out) out.textContent = 'eyJpdiI6InhBOFlhdz09IiwiY3BoIjoiT1IzeVFXQjVqL2t2Y0JtY0RWRW40U0N6U2Z6bWdMdjBhVTc3In0=';
    }
  }

  // --- QR CODE GENERATOR (HTML5 Canvas Matrix) ---
  function generateQRCodeCanvas(code) {
    const canvas = document.getElementById('qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const modules = 25;
    const cellSize = (size - 24) / modules;
    const offset = 12;

    ctx.fillStyle = '#0f172a';

    // Draw standard QR finder patterns in 3 corners
    function drawFinder(r, c) {
      const x = offset + c * cellSize;
      const y = offset + r * cellSize;
      const w = 7 * cellSize;

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, w);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + cellSize, y + cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x + 2 * cellSize, y + 2 * cellSize, 3 * cellSize, 3 * cellSize);
    }

    drawFinder(0, 0);
    drawFinder(0, modules - 7);
    drawFinder(modules - 7, 0);

    // Deterministic pseudo-random matrix based on code
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = (hash << 5) - hash + code.charCodeAt(i);
      hash |= 0;
    }

    ctx.fillStyle = '#0f172a';
    for (let r = 0; r < modules; r++) {
      for (let c = 0; c < modules; c++) {
        // Skip finder areas
        if ((r < 8 && c < 8) || (r < 8 && c >= modules - 8) || (r >= modules - 8 && c < 8)) {
          continue;
        }
        const val = Math.abs(Math.sin(hash + r * 13 + c * 37));
        if (val > 0.48) {
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize - 0.5, cellSize - 0.5);
        }
      }
    }
  }

  // --- INPUT INTERACTION & LIVE STATS ---
  function updateInputStats() {
    const input = document.getElementById('clip-input');
    const chip = document.getElementById('detected-type-chip');
    const counter = document.getElementById('input-char-counter');
    const previewBox = document.getElementById('inline-preview-box');
    if (!input) return;

    const val = input.value;
    if (counter) counter.textContent = `${val.length} chars`;

    const detected = detectContentType(val);
    if (chip) {
      chip.textContent = detected.toUpperCase();
      chip.className = `type-chip ${detected}`;
    }

    if (previewBox) {
      if (detected === 'color') {
        previewBox.classList.remove('hidden');
        previewBox.innerHTML = `
          <div class="color-swatch-box" style="background-color: ${escapeHtml(val.trim())};"></div>
          <span style="font-size:12px; font-family:var(--font-mono); color:var(--text-main);">${escapeHtml(val.trim())}</span>
        `;
      } else {
        previewBox.classList.add('hidden');
      }
    }
  }

  // --- INITIALIZATION & EVENT BINDINGS ---
  function init() {
    // 1. Setup Tab Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const panel = document.getElementById(`panel-${target}`);
        if (panel) panel.classList.add('active');
        state.activeTab = target;
      });
    });

    // 2. Audio Toggle
    const audioBtn = document.getElementById('audio-toggle-btn');
    const audioOn = document.getElementById('audio-icon-on');
    const audioOff = document.getElementById('audio-icon-off');
    if (audioBtn) {
      audioBtn.addEventListener('click', () => {
        state.audioEnabled = !state.audioEnabled;
        audioBtn.classList.toggle('active', state.audioEnabled);
        if (audioOn && audioOff) {
          audioOn.classList.toggle('hidden', !state.audioEnabled);
          audioOff.classList.toggle('hidden', state.audioEnabled);
        }
        showToast(state.audioEnabled ? 'Sound cues enabled' : 'Sound cues muted', 'info');
        if (state.audioEnabled) playSound('copy');
      });
    }

    // 3. Push Action & Input Handling
    const clipInput = document.getElementById('clip-input');
    const pushBtn = document.getElementById('push-clip-btn');
    const clearBtn = document.getElementById('clear-input-btn');
    const grabBtn = document.getElementById('read-sys-clipboard-btn');

    if (clipInput) {
      clipInput.addEventListener('input', updateInputStats);
      clipInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          if (clipInput.value.trim()) {
            broadcastClip(clipInput.value);
            clipInput.value = '';
            updateInputStats();
          }
        }
      });
    }

    if (pushBtn && clipInput) {
      pushBtn.addEventListener('click', () => {
        if (clipInput.value.trim()) {
          broadcastClip(clipInput.value);
          clipInput.value = '';
          updateInputStats();
        } else {
          showToast('Please type or paste some text first', 'warning');
        }
      });
    }

    if (clearBtn && clipInput) {
      clearBtn.addEventListener('click', () => {
        clipInput.value = '';
        updateInputStats();
      });
    }

    if (grabBtn) {
      grabBtn.addEventListener('click', readSystemClipboard);
    }

    // 4. Active Hero Card Actions
    const copyActiveBtn = document.getElementById('copy-active-btn');
    if (copyActiveBtn) {
      copyActiveBtn.addEventListener('click', () => {
        copyToSystemClipboard(state.activeClip.content);
      });
    }

    const starActiveBtn = document.getElementById('star-active-btn');
    if (starActiveBtn) {
      starActiveBtn.addEventListener('click', () => {
        state.activeClip.pinned = !state.activeClip.pinned;
        playSound('copy');
        renderHistoryCards();
        showToast(state.activeClip.pinned ? 'Starred universal clip' : 'Unstarred clip', 'info');
      });
    }

    const qrActiveBtn = document.getElementById('qr-active-btn');
    if (qrActiveBtn) {
      qrActiveBtn.addEventListener('click', () => {
        openQRModal(state.activeClip.content);
      });
    }

    // 5. History Filters & Search
    const searchInput = document.getElementById('history-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value;
        renderHistoryCards();
      });
    }

    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeFilter = pill.dataset.filter;
        renderHistoryCards();
      });
    });

    const exportBtn = document.getElementById('export-history-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state.clips, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute('href', dataStr);
        dl.setAttribute('download', `clp-backup-${Date.now()}.json`);
        dl.click();
        showToast('Exported clips vault as JSON', 'success');
      });
    }

    const clearHistBtn = document.getElementById('clear-all-history-btn');
    if (clearHistBtn) {
      clearHistBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear clipboard history?')) {
          state.clips = [];
          playSound('delete');
          renderHistoryCards();
          updateMetrics();
          try { localStorage.removeItem('clp_saved_history'); } catch (e) {}
          showToast('Clipboard history cleared', 'info');
        }
      });
    }

    // 6. Security Passphrase & Wire Inspector
    const cipherInput = document.getElementById('cipher-sample-plain');
    if (cipherInput) {
      cipherInput.addEventListener('input', () => updateCipherDemo(cipherInput.value));
    }

    const passInput = document.getElementById('e2ee-passphrase-input');
    const togglePassBtn = document.getElementById('toggle-passphrase-visibility');
    if (togglePassBtn && passInput) {
      togglePassBtn.addEventListener('click', () => {
        passInput.type = passInput.type === 'password' ? 'text' : 'password';
      });
    }

    const saveKeyBtn = document.getElementById('save-e2ee-key-btn');
    if (saveKeyBtn && passInput) {
      saveKeyBtn.addEventListener('click', () => {
        state.e2eePassphrase = passInput.value;
        playSound('connect');
        showToast('Updated cryptographic mesh keys', 'success');
      });
    }

    // 7. Modals: QR Pairing
    const pairBtn = document.getElementById('pair-device-btn');
    const qrModal = document.getElementById('qr-modal');
    const closeQrBtn = document.getElementById('close-qr-modal-btn');
    if (pairBtn) {
      pairBtn.addEventListener('click', () => openQRModal(state.pairingCode));
    }
    if (closeQrBtn && qrModal) {
      closeQrBtn.addEventListener('click', () => qrModal.classList.add('hidden'));
    }

    const copyPairLinkBtn = document.getElementById('copy-pairing-link-btn');
    if (copyPairLinkBtn) {
      copyPairLinkBtn.addEventListener('click', () => {
        copyToSystemClipboard(`clp://pair?code=${state.pairingCode}&hub=localhost:5000`, 'Copied pairing link!');
      });
    }

    // 8. Modals: Settings
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-modal-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    }
    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }
    if (saveSettingsBtn && settingsModal) {
      saveSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
        showToast('Settings saved & mesh reconnected', 'success');
        connectWebSocket();
      });
    }

    // 9. Add Device Node Modal
    const addDevBtn = document.getElementById('add-sim-device-btn');
    const addDevModal = document.getElementById('add-device-modal');
    const closeAddDevBtn = document.getElementById('close-add-device-modal-btn');
    const confirmAddDevBtn = document.getElementById('confirm-add-device-btn');
    if (addDevBtn && addDevModal) {
      addDevBtn.addEventListener('click', () => addDevModal.classList.remove('hidden'));
    }
    if (closeAddDevBtn && addDevModal) {
      closeAddDevBtn.addEventListener('click', () => addDevModal.classList.add('hidden'));
    }
    if (confirmAddDevBtn && addDevModal) {
      confirmAddDevBtn.addEventListener('click', () => {
        const nameInp = document.getElementById('new-device-name');
        const osInp = document.getElementById('new-device-os');
        const name = nameInp?.value.trim() || 'New Node';
        const os = osInp?.value || 'linux';

        const icons = { macos: '💻', ios: '📱', windows: '🖥️', android: '📱', linux: '🐧' };
        state.devices.push({
          id: 'dev-' + Date.now(),
          name,
          os,
          icon: icons[os] || '📟',
          active: true,
          latency: `${Math.floor(4 + Math.random() * 12)}ms`,
          battery: '100%'
        });

        renderDevicesList();
        updateMetrics();
        logActivity(`Connected new device: <strong>${name}</strong> (${os})`, 'device');
        playSound('connect');
        showToast(`Connected ${name} to clipboard mesh`, 'success');
        addDevModal.classList.add('hidden');
        if (nameInp) nameInp.value = '';
      });
    }

    // 10. Global Shortcuts & Focus Polling
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        copyToSystemClipboard(state.activeClip.content);
      }
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.add('hidden'));
      }
    });

    window.addEventListener('focus', () => {
      const autoToggle = document.getElementById('auto-paste-toggle');
      if (autoToggle && autoToggle.checked && navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(txt => {
          if (txt && txt.trim() && txt !== state.lastCopiedText && txt !== state.activeClip.content) {
            state.lastCopiedText = txt;
            broadcastClip(txt, 'System Clipboard (Auto-Sync)');
          }
        }).catch(() => {});
      }
    });

    const clearStreamBtn = document.getElementById('clear-stream-btn');
    if (clearStreamBtn) {
      clearStreamBtn.addEventListener('click', () => {
        const stream = document.getElementById('sync-activity-stream');
        if (stream) stream.innerHTML = '';
      });
    }

    // Initial Renders & Setup
    initMeshChannels();
    setupSimulatorEvents();
    renderActiveClip();
    renderHistoryCards();
    renderDevicesList();
    updateMetrics();
    updateCipherDemo(state.activeClip.content);
    logActivity('Clp Universal Mesh initialized & ready', 'device');
  }

  function openQRModal(code) {
    const modal = document.getElementById('qr-modal');
    const codeDisplay = document.getElementById('pairing-code-display');
    if (codeDisplay) codeDisplay.textContent = state.pairingCode;
    if (modal) {
      modal.classList.remove('hidden');
      setTimeout(() => generateQRCodeCanvas(code || state.pairingCode), 50);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
