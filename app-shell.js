/*
 * Let’s Q app shell
 *
 * This layer turns the shared web/mobile UI into an app-shaped interface while
 * leaving the live Neon queue bridge in charge of queue data.
 */
(() => {
  const state = window.letsQState;
  if (!state) return;

  const today = () => new Date().toISOString().slice(0, 10);
  const root = document.documentElement;
  const liveTicketKey = 'lets-q-live-tickets';
  const legacyTicketKey = 'lets-q-live-ticket';
  // These are intentional paired palettes, rather than an unrestricted color
  // picker, so every choice keeps text, buttons, and status colors readable.
  const themes = {
    ocean: { name: 'Ocean', accent: '#2563eb', accent2: '#00b8ff', ink: '#172033', paper: '#ffffff', paper2: '#eff6ff', muted: '#64748b', line: '#dbeafe' },
    sky: { name: 'Sky', accent: '#0284c7', accent2: '#38bdf8', ink: '#132235', paper: '#ffffff', paper2: '#f0f9ff', muted: '#61758a', line: '#bae6fd' },
    indigo: { name: 'Indigo', accent: '#4f46e5', accent2: '#818cf8', ink: '#202041', paper: '#ffffff', paper2: '#eef2ff', muted: '#686b91', line: '#c7d2fe' },
    plum: { name: 'Violet', accent: '#7c3aed', accent2: '#c084fc', ink: '#2a183d', paper: '#ffffff', paper2: '#faf5ff', muted: '#7d6690', line: '#e9d5ff' },
    berry: { name: 'Berry', accent: '#be123c', accent2: '#f43f5e', ink: '#351622', paper: '#ffffff', paper2: '#fff1f2', muted: '#8a6470', line: '#fecdd3' },
    coral: { name: 'Coral', accent: '#e11d48', accent2: '#fb7185', ink: '#351920', paper: '#ffffff', paper2: '#fff1f2', muted: '#8b6670', line: '#fecdd3' },
    sunset: { name: 'Sunset', accent: '#ea580c', accent2: '#f59e0b', ink: '#302117', paper: '#ffffff', paper2: '#fff7ed', muted: '#806452', line: '#fed7aa' },
    citrus: { name: 'Citrus', accent: '#ca8a04', accent2: '#eab308', ink: '#302810', paper: '#ffffff', paper2: '#fefce8', muted: '#7d7047', line: '#fde68a' },
    forest: { name: 'Forest', accent: '#16a34a', accent2: '#4ade80', ink: '#17251d', paper: '#ffffff', paper2: '#f0fdf4', muted: '#5c7667', line: '#bbf7d0' },
    mint: { name: 'Mint', accent: '#0f766e', accent2: '#2dd4bf', ink: '#15302e', paper: '#ffffff', paper2: '#f0fdfa', muted: '#5b7774', line: '#99f6e4' }
  };

  const simplifiedChinese = {
    'Home': '首页', 'Queuer': '排队者', 'Q list': '队列', 'Host': '主办方', 'Reports': '报告', 'Language': '语言',
    'Private queues. No account required.': '私密排队，无需账户。', 'Join a queue': '加入队列', 'Set up a queue': '创建队列',
    'App appearance': '应用外观', 'Your privacy comes first': '你的隐私优先', 'No name, phone number, email, or queuer account is required.': '无需姓名、电话号码、电子邮箱或排队者账户。',
    'Scan or enter a code': '扫描或输入代码', 'My queues': '我的队列', 'Waiting': '等待中', 'Ready': '已叫到', 'Past': '已结束', 'All': '全部',
    'No saved queues yet.': '暂时没有保存的队列。', 'Host setup': '主办方设置', 'Start a queue': '开始队列', 'Booth or event name': '摊位或活动名称',
    'Queue name': '队列名称', 'Take a photo': '拍照', 'Choose from device': '从设备选择', 'Start date': '开始日期', 'End date': '结束日期',
    'Start time': '开始时间', 'End time': '结束时间', 'Planned orders (optional)': '预计服务人数（可选）', 'No limit': '无限制',
    'When a called ticket does not arrive': '叫号后未到场时', 'Start this queue': '开始此队列', 'Scan host QR': '扫描主办方二维码',
    'Enter queue code': '输入队列代码', 'Join with code': '使用代码加入', 'Start camera scanner': '启动相机扫描',
    'QR code': '二维码', 'Download JPG': '下载 JPG', 'Download PDF': '下载 PDF', 'Full screen': '全屏显示',
    'Queue code': '队列代码', 'Notifications': '通知', 'No alerts are enabled.': '未开启提醒。', 'Appearance': '外观',
    'Choose a color for this device. Host and Queuer can each use their own color.': '为此设备选择颜色。主办方和排队者可以分别使用自己的颜色。',
    'Host reports': '主办方报告', 'Watch sponsor video': '观看赞助视频', 'Go ad-free + analytics': '去广告并查看分析',
    'Analytics are private, aggregate-only, and never include a name, phone number, email, secret code, or device identifier.': '分析仅显示私密汇总数据，绝不包含姓名、电话、邮箱、密码或设备标识。'
  };
  Object.assign(simplifiedChinese, {
    'LET’S Q': 'LET’S Q', 'Join a line with a QR or short code, or set up a queue from the same app.': '使用二维码或短代码加入队列，也可在同一应用中创建队列。',
    'Scan a QR or enter a code': '扫描二维码或输入代码', 'Create and manage your own line': '创建和管理自己的队列',
    'Choose your Host and Queuer colors.': '选择主办方和排队者的颜色。', 'No name, phone number, email, or Queuer account.': '无需姓名、电话号码、电子邮箱或排队者账户。',
    'Queue photo (optional)': '队列照片（可选）', 'No photo selected.': '尚未选择照片。', 'Queue dates and hours': '队列日期和时间',
    'This is only a planning number. Joining stays unlimited.': '这只是规划人数，不会限制加入队列。', 'The ticket closes after the first no-show.': '第一次未到场后，号码将关闭。',
    'The ticket keeps its number. After two deferrals, the third no-show closes it.': '号码保持不变。两次移到队尾后，第三次未到场会关闭。',
    'Use this for a short grace period before the ticket is recalled.': '重新叫号前给予短暂宽限时间。', 'Cancel immediately': '立即取消',
    'Move to the back twice, then cancel': '移到队尾两次后取消', 'Hold for': '保留', 'minutes, twice, then cancel': '分钟，两次后取消',
    'Camera is off. Start scanning when you are ready.': '相机已关闭，准备好后开始扫描。', 'Point your camera at the queue QR.': '将相机对准队列二维码。',
    'The QR takes you directly to the host’s queue. No account, phone number, or email is needed.': '二维码会直接带你进入主办方队列，无需账户、电话或邮箱。',
    'Codes begin with Q and use five letters or numbers. Capital and lowercase work the same.': '代码以 Q 开头，后接五个字母或数字，不区分大小写。',
    'Choose a private code': '选择私密代码', 'Optional request to booth': '给摊位的可选说明', 'Join queue': '加入队列',
    'No name, phone number, email, account, or tracking profile is requested. Please do not enter medical, payment, or other sensitive details.': '不需要姓名、电话、邮箱、账户或追踪资料。请不要输入医疗、付款或其他敏感信息。',
    'QR code': '二维码', 'Letter': 'Letter 纸张', 'A4': 'A4', 'Host': '主办方', 'Full screen': '全屏显示',
    'Start a live queue before showing its QR code.': '请先创建实时队列，再显示二维码。', 'Start a live queue before downloading its QR code.': '请先创建实时队列，再下载二维码。',
    'Nothing to catch up on': '没有新通知', 'Let’s Q does not require notification permission or a phone number. Check My queues any time to see the latest live status.': 'Let’s Q 不需要通知权限或电话号码。随时查看“我的队列”即可了解最新状态。',
    'Open Q list': '打开队列列表', 'Join another': '加入另一个', 'Scan a Host QR or enter a queue code. You can hold places in more than one queue at a time.': '扫描主办方二维码或输入队列代码。你可以同时在多个队列中保留位置。',
    'Make Let’s Q yours': '定制你的 Let’s Q', 'Choose a color for this device. Your Host and Queuer views can use different colors.': '为此设备选择颜色。主办方和排队者页面可以使用不同颜色。',
    'Queuer color': '排队者颜色', 'Host color': '主办方颜色', 'Custom color': '自定义颜色', 'Ocean': '海洋', 'Plum': '梅紫', 'Sunset': '日落', 'Forest': '森林',
    'Unlock your queue report': '解锁你的队列报告', 'Reports show only combined counts, wait times, no-show totals, and anonymous rating averages.': '报告仅显示汇总人数、等待时间、未到场总数和匿名评分平均值。',
    'Watch a sponsor video': '观看赞助视频', 'One optional rewarded video unlocks this report once a rewarded ad unit is connected.': '连接激励广告单元后，可选择观看一次广告视频来解锁本报告。',
    'Ad-free removes banners on this device and keeps private Host analytics available without sponsor videos.': '去广告会移除此设备上的横幅广告，并可无需赞助视频查看私密主办方分析。',
    'A rewarded sponsor video needs its own AdMob rewarded-ad unit before it can unlock a report. Ad-free + analytics is ready now.': '激励赞助视频需要单独的 AdMob 激励广告单元才能解锁报告。去广告和分析功能已可使用。'
  });
  try { translations['zh-Hans'] = { ...(translations['zh-Hans'] || {}), ...simplifiedChinese }; } catch {}

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || '') ?? fallback; } catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function esc(value) {
    const node = document.createElement('span');
    node.textContent = String(value || '');
    return node.innerHTML;
  }
  function savedTickets() {
    const many = read(liveTicketKey, []);
    const legacy = read(legacyTicketKey, null);
    const list = Array.isArray(many) ? many : [];
    if (legacy?.accessToken && !list.some((ticket) => ticket.accessToken === legacy.accessToken)) list.push(legacy);
    return list;
  }
  function statusFor(ticket) {
    return ticket.status || ticket.state || 'waiting';
  }
  function applyTheme(role = state.appRole || 'queuer', explicitTheme) {
    const choices = read('lets-q-themes', {});
    const themeId = explicitTheme || choices[role] || 'ocean';
    const theme = themes[themeId] || themes.ocean;
    root.style.setProperty('--ink', theme.ink);
    root.style.setProperty('--paper', theme.paper);
    root.style.setProperty('--paper2', theme.paper2);
    root.style.setProperty('--muted', theme.muted);
    root.style.setProperty('--line', theme.line);
    root.style.setProperty('--app-accent', theme.accent || theme.ink);
    root.style.setProperty('--app-accent-2', theme.accent2 || theme.accent || theme.ink);
    document.querySelectorAll('[data-theme-choice]').forEach((button) => button.classList.toggle('selected', button.dataset.themeChoice === themeId && button.dataset.themeRole === role));
  }
  window.setLetsQTheme = (role, theme) => {
    const choices = read('lets-q-themes', {});
    choices[role] = theme;
    write('lets-q-themes', choices);
    state.appRole = role;
    applyTheme(role, theme);
    window.toast?.(`${(themes[theme] || themes.ocean).name} is now your ${role} palette.`);
  };

  function appRoleForView(view) {
    return ['setup', 'organizer', 'print', 'pair', 'report'].includes(view) ? 'host' : 'queuer';
  }
  function setActiveNav(view) {
    const target = view === 'role' ? 'home' : view === 'scan' || view === 'queuer' || view === 'rate' || view === 'share' ? 'queuer' : view === 'q-list' ? 'q-list' : ['setup', 'organizer', 'print', 'pair'].includes(view) ? 'host' : view === 'report' ? 'report' : '';
    document.querySelectorAll('.app-nav [data-app-tab]').forEach((button) => button.classList.toggle('active', button.dataset.appTab === target));
  }
  function appGoTo(tab) {
    if (tab === 'home') return window.goTo('role');
    if (tab === 'queuer') return window.goTo('scan');
    if (tab === 'q-list') return window.goTo('q-list');
    if (tab === 'host') return window.goTo(state.liveHostQueueId ? 'organizer' : 'setup');
    if (tab === 'report') return window.goTo('report');
  }
  window.appGoTo = appGoTo;

  const appIcons = {
    globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9S14.4 18.5 12 21M12 3C9.6 5.5 8.4 8.5 8.4 12S9.6 18.5 12 21"></path></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"></path><path d="M10 21h4"></path></svg>',
    scan: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"></path><path d="M8 12h8"></path></svg>',
    list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13"></path><path d="M3 6h.01M3 12h.01M3 18h.01"></path></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 11 9-8 9 8"></path><path d="M5 10v11h14V10"></path><path d="M9 21v-7h6v7"></path></svg>',
    host: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="7" r="4"></circle><path d="M5.5 21a6.5 6.5 0 0 1 13 0M18 8h3M19.5 6.5v3"></path></svg>',
    report: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9M10 19V5M16 19v-7M22 19V3"></path></svg>',
    camera: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l1.4-2h7.2L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Z"></path><circle cx="12" cy="13" r="3.5"></circle></svg>'
  };

  function injectShell() {
    const header = document.querySelector('.top');
    const notice = document.querySelector('.notice');
    const adBanner = document.querySelector('#adBanner');
    notice?.remove();
    adBanner?.remove();
    if (header) {
      header.className = 'app-header';
      header.innerHTML = `<button class="wordmark-button" type="button" onclick="appGoTo('home')" aria-label="Let’s Q home"><img class="app-web-logo" src="/Let%27s%20Q%20Web%20logo.jpeg" alt="Let's Q"></button><div class="header-actions"><button class="icon-button" type="button" onclick="toggleLanguageMenu()" aria-label="Choose language">${appIcons.globe}</button><button class="icon-button" type="button" onclick="openNotices()" aria-label="Notifications">${appIcons.bell}</button><div class="language-menu" id="language-menu" hidden><label for="language-select">Language</label><select id="language-select" onchange="setLanguage(this.value)" aria-label="Choose interface language"><option value="en">English</option><option value="es">Español</option><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option><option value="ko">한국어</option><option value="ja">日本語</option></select></div></div>`;
    }
    const role = document.querySelector('#role');
    if (role) role.innerHTML = `<div class="home-hero"><div class="eyebrow">LET’S Q</div><h1>Private queues.<br>No account required.</h1><p>Join a line with a QR or short code, or set up a queue from the same app.</p></div><div class="home-actions"><button class="home-action queuer-action" onclick="appGoTo('queuer')"><span class="home-icon">${appIcons.scan}</span><span><b>Queuer</b><small>Join a queue</small></span></button><button class="home-action host-action" onclick="appGoTo('host')"><span class="home-icon">${appIcons.host}</span><span><b>Host</b><small>Set up a queue</small></span></button></div><div class="home-grid"><button class="info-card" onclick="goTo('appearance')"><b>App appearance</b><span>Choose your Host and Queuer palettes.</span></button><button class="info-card" onclick="goTo('privacy')"><b>Your privacy comes first</b><span>No name, phone number, email, or Queuer account.</span></button></div>`;

    const scan = document.querySelector('#scan');
    if (scan) {
      scan.innerHTML = `<div class="queuer-page"><div class="section-head"><div class="page-kicker">QUEUER</div><h1>Join a queue</h1><p>Scan the Host QR or enter a short code. No account or personal details are required.</p></div><div class="card scanner-card"><div class="scanner-stage"><video class="scanner-video" id="scanVideo" autoplay muted playsinline></video><div class="scan-empty">${appIcons.scan}<span>Ready to scan</span></div><div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div></div><div class="scan-status" id="scanStatus">Camera is off. Start scanning when you are ready.</div><button class="button secondary wide" onclick="startScanner()">${appIcons.camera} Start camera scanner</button><div class="or-divider"><span>or</span></div><label class="field scan-code-field">Queue code<input id="manual-queue-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="e.g. Q7K2M9"></label><button class="button primary wide" onclick="joinByCode()">Join with code</button><p class="hint scan-help">Codes start with Q and use five letters or numbers. Uppercase and lowercase work the same.</p></div><div class="privacy-strip"><span>✓</span><p><b>Private by design</b>No name, phone number, email, or Queuer account is needed.</p></div></div>`;
      scan.querySelector('#scanVideo')?.addEventListener('playing', () => scan.classList.add('camera-live'));
    }

    const setup = document.querySelector('#setup');
    if (setup) setup.innerHTML = `<div class="card host-setup-card"><div class="card-in"><div class="page-kicker">HOST</div><h1>Set up your queue</h1><p class="hint">Use a short public description of the booth or event. Do not put personal information here.</p><div class="field"><label>Booth or event name</label><input id="setup-booth" maxlength="60" placeholder="e.g. Stinky tofu"></div><div class="field"><label>Queue name</label><input id="setup-queue" maxlength="40" placeholder="e.g. Pickup line"></div><div class="field"><label>Queue photo (optional)</label><div class="photo-actions"><label class="button"><input id="setup-camera" type="file" accept="image/*" capture="environment" onchange="previewBoothPhoto(this)" hidden>Take a photo</label><label class="button"><input id="setup-photo" type="file" accept="image/*" onchange="previewBoothPhoto(this)" hidden>Choose from device</label></div><div id="booth-preview" class="photo-preview">No photo selected.</div></div><div class="field"><label>Queue dates and hours</label><div class="date-grid"><div><label for="setup-start-date">Start date</label><input id="setup-start-date" type="date"></div><div><label for="setup-end-date">End date</label><input id="setup-end-date" type="date"></div><div><label for="setup-start">Start time</label><input id="setup-start" type="time" required></div><div><label for="setup-end">End time</label><input id="setup-end" type="time" required></div></div></div><div class="field"><label>Planned orders (optional)</label><input id="setup-service-target" type="number" min="1" inputmode="numeric" placeholder="No limit"><p class="hint">This is only a planning number. Joining stays unlimited.</p><input id="setup-capacity" type="hidden" value="100"></div><div class="field"><label>When a called ticket does not arrive</label><label class="policy-option"><input type="radio" name="noShowPolicy" value="cancel"><b>Cancel immediately</b></label><label class="policy-option"><input type="radio" name="noShowPolicy" value="defer" checked><b>Move to the back twice, then cancel</b></label><label class="policy-option"><input type="radio" name="noShowPolicy" value="hold"><b>Hold for <input id="hold-minutes" type="number" value="5" min="1" max="30" style="width:58px;padding:4px;display:inline"> minutes, twice, then cancel</b></label></div><div class="buttons"><button class="button primary" onclick="applyHostSetup()">Start this queue</button><button class="button" onclick="appGoTo('home')">Home</button></div></div></div>`;

    const qList = document.createElement('section');
    qList.className = 'view'; qList.id = 'q-list';
    qList.innerHTML = `<div class="list-page"><div class="page-head"><div><div class="page-kicker">QUEUER</div><h1>My queues</h1></div><button class="button small" onclick="appGoTo('queuer')">Join another</button></div><div class="segmented" role="tablist"><button data-ticket-filter="waiting" onclick="setTicketFilter('waiting')">Waiting</button><button data-ticket-filter="ready" onclick="setTicketFilter('ready')">Ready</button><button data-ticket-filter="past" onclick="setTicketFilter('past')">Past</button><button data-ticket-filter="all" onclick="setTicketFilter('all')">All</button></div><div class="card"><div class="card-in" id="saved-ticket-list"></div></div></div>`;
    document.querySelector('.shell')?.append(qList);

    const appearance = document.createElement('section');
    appearance.className = 'view'; appearance.id = 'appearance';
    appearance.innerHTML = `<div class="card appearance-card"><div class="card-in"><div class="page-kicker">APPEARANCE</div><h1>Make Let’s Q yours</h1><p class="hint">Choose from ten polished two-color palettes. Your Host and Queuer views can use different palettes.</p><div class="theme-block"><h2>Queuer palette</h2><div class="theme-options">${themeButtons('queuer')}</div></div><div class="theme-block"><h2>Host palette</h2><div class="theme-options">${themeButtons('host')}</div></div><div class="buttons"><button class="button" onclick="appGoTo('home')">Home</button></div></div></div>`;
    document.querySelector('.shell')?.append(appearance);

    const nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = `<button data-app-tab="queuer" onclick="appGoTo('queuer')"><span class="nav-icon">${appIcons.scan}</span><b>Queuer</b></button><button data-app-tab="q-list" onclick="appGoTo('q-list')"><span class="nav-icon">${appIcons.list}</span><b>Q list</b></button><button data-app-tab="home" onclick="appGoTo('home')"><span class="nav-icon">${appIcons.home}</span><b>Home</b></button><button data-app-tab="host" onclick="appGoTo('host')"><span class="nav-icon">${appIcons.host}</span><b>Host</b></button><button data-app-tab="report" onclick="appGoTo('report')"><span class="nav-icon">${appIcons.report}</span><b>Reports</b></button>`;
    document.body.append(nav);

    const overlay = document.createElement('div');
    overlay.id = 'notice-overlay'; overlay.className = 'app-overlay'; overlay.hidden = true;
    overlay.innerHTML = `<div class="overlay-card"><button class="overlay-close" onclick="closeNotices()" aria-label="Close">×</button><div class="page-kicker">NOTIFICATIONS</div><h2>Nothing to catch up on</h2><p>Let’s Q does not require notification permission or a phone number. Check My queues any time to see the latest live status.</p><button class="button primary" onclick="closeNotices();appGoTo('q-list')">Open Q list</button></div>`;
    document.body.append(overlay);

    const qrFocus = document.createElement('div');
    qrFocus.id = 'queue-qr-focus'; qrFocus.className = 'app-overlay qr-focus'; qrFocus.hidden = true;
    qrFocus.innerHTML = `<button class="overlay-close" onclick="closeQueueQrFullscreen()" aria-label="Close">×</button><div class="qr-focus-inner"><img id="queue-qr-focus-image" alt="Queue QR code"><div id="queue-qr-focus-code" class="qr-focus-code"></div></div>`;
    document.body.append(qrFocus);
  }
  function themeButtons(role) {
    return Object.entries(themes).map(([id, theme]) => `<button class="theme-choice ${id}" data-theme-choice="${id}" data-theme-role="${role}" onclick="setLetsQTheme('${role}','${id}')"><i style="--theme-a:${theme.accent};--theme-b:${theme.accent2}"></i>${theme.name}</button>`).join('');
  }
  function upgradePrintView() {
    const print = document.querySelector('#print');
    const heading = print?.querySelector('h1');
    if (heading) heading.textContent = 'Queue QR code';
    const intro = heading?.nextElementSibling;
    if (intro) intro.textContent = 'Choose a size, then save a file or show the code full screen.';
    const toolbar = print?.querySelector('.print-toolbar');
    if (toolbar) toolbar.innerHTML = `<button class="button primary" id="letter-choice" onclick="setPrintSize('letter')">Letter</button><button class="button" id="a4-choice" onclick="setPrintSize('a4')">A4</button><button class="button" onclick="downloadQueueAsset('jpg')">Download JPG</button><button class="button" onclick="downloadQueueAsset('pdf')">Download PDF</button><button class="button green" onclick="openQueueQrFullscreen()">Full screen</button><button class="button" onclick="appGoTo('host')">Host</button>`;
  }
  function upgradeRenderedPanels() {
    const secret = document.querySelector('#code');
    if (secret) { secret.value = ''; secret.removeAttribute('value'); secret.placeholder = 'Choose a private code'; }
    const joinPanel = document.querySelector('#joinPanel');
    const count = joinPanel?.querySelector('.ticket-top span:last-child');
    if (count?.textContent.includes('/')) count.textContent = 'PRIVATE';
    const control = document.querySelector('#controlPanel');
    if (control) control.classList.add('host-control-app');
    const queuePanel = document.querySelector('#queuePanel');
    if (queuePanel) queuePanel.classList.add('queue-panel-app');
    const capacityRow = control?.querySelector('.row');
    if (capacityRow) capacityRow.innerHTML = `<div><div class="label">Live queue</div><b class="code">${state.liveActiveCount ?? (state.tickets || []).filter((ticket) => ['waiting','called','ready','hold'].includes(ticket.state)).length} active</b></div><div class="hint" style="text-align:right">No joining limit</div>`;
    const printQr = document.querySelector('#printSheet .qr');
    if (printQr) { printQr.style.cursor = 'pointer'; printQr.title = 'Show full screen'; printQr.onclick = window.openQueueQrFullscreen; }
    const report = document.querySelector('#reportPanel');
    if (report && state.currentView === 'report' && !state.adFree) {
      report.innerHTML = `<div class="ticket-top"><span>HOST REPORTS</span><span>PRIVATE TOTALS</span></div><h2 style="margin:20px 0 8px">Unlock your queue report</h2><p class="hint">Reports show only combined counts, wait times, no-show totals, and anonymous rating averages.</p><div class="report-unlock"><div><b>Watch a sponsor video</b><span>One optional rewarded video unlocks this report once a rewarded ad unit is connected.</span></div><button class="button" onclick="watchSponsorForReport()">Watch sponsor video</button></div><div class="report-divider"><span>or</span></div><div class="plan"><div class="plan-price">$1<span style="font-size:15px;font-weight:400"> / month</span></div><p class="hint">Ad-free removes banners on this device and keeps private Host analytics available without sponsor videos.</p><button class="button primary" onclick="openSubscription()">Go ad-free + analytics</button></div><p class="hint">Analytics are private, aggregate-only, and never include a name, phone number, email, secret code, or device identifier.</p></div>`;
    }
  }
  function renderTicketList() {
    const holder = document.querySelector('#saved-ticket-list');
    if (!holder) return;
    const filter = state.ticketFilter || 'waiting';
    const tickets = savedTickets();
    const accepted = (ticket) => {
      const status = statusFor(ticket);
      if (filter === 'all') return true;
      if (filter === 'waiting') return ['waiting','called','hold'].includes(status);
      if (filter === 'ready') return status === 'ready';
      return ['served','cancelled'].includes(status);
    };
    document.querySelectorAll('[data-ticket-filter]').forEach((button) => button.classList.toggle('active', button.dataset.ticketFilter === filter));
    const visible = tickets.map((ticket, index) => ({ ticket, index })).filter(({ ticket }) => accepted(ticket));
    holder.innerHTML = visible.length ? `<ul class="saved-queues">${visible.map(({ ticket, index }) => {
      const status = statusFor(ticket);
      return `<li class="saved-queue-card ${status}"><button onclick="openSavedQueue(${index})"><span class="saved-queue-copy"><small>${esc(ticket.queueName || 'Queue')}</small><b>${esc(ticket.boothName || ticket.queueName || 'Live queue')}</b><strong>#${esc(ticket.ticketNumber || '—')}</strong></span><em class="ticket-state ${status}">${esc(status)}</em><span class="saved-chevron">›</span></button></li>`;
    }).join('')}</ul>` : `<div class="empty-list"><b>No saved queues yet.</b><p>Scan a Host QR or enter a queue code. You can hold places in more than one queue at a time.</p><button class="button primary" onclick="appGoTo('queuer')">Join a queue</button></div>`;
  }
  window.setTicketFilter = (filter) => { state.ticketFilter = filter; renderTicketList(); };
  window.openSavedQueue = (index) => {
    const list = savedTickets();
    const ticket = list[index];
    if (!ticket) return;
    state.selectedLiveTicket = ticket.accessToken;
    state.livePublicQueueId = ticket.publicId;
    window.goTo('queuer');
  };
  window.toggleLanguageMenu = () => {
    const menu = document.querySelector('#language-menu');
    if (menu) menu.hidden = !menu.hidden;
  };
  window.openNotices = () => { const overlay = document.querySelector('#notice-overlay'); if (overlay) overlay.hidden = false; };
  window.closeNotices = () => { const overlay = document.querySelector('#notice-overlay'); if (overlay) overlay.hidden = true; };
  window.openQueueQrFullscreen = () => {
    const image = document.querySelector('#queue-qr-focus-image');
    const code = document.querySelector('#queue-qr-focus-code');
    const overlay = document.querySelector('#queue-qr-focus');
    const qr = state.liveQrDataUrl;
    const joinCode = state.liveJoinCode || state.livePublicQueueId;
    if (!qr || !joinCode) return window.toast?.('Start a live queue before showing its QR code.');
    image.src = qr; code.textContent = joinCode; overlay.hidden = false;
  };
  window.closeQueueQrFullscreen = () => { const overlay = document.querySelector('#queue-qr-focus'); if (overlay) overlay.hidden = true; };

  async function queueCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 2200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#fffdf8'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#12383f'; context.textAlign = 'center';
    context.font = '700 72px system-ui'; context.fillText('LET’S Q', 800, 150);
    context.font = '700 95px system-ui'; context.fillText(state.booth || 'Your queue', 800, 310);
    context.font = '500 52px system-ui'; context.fillText(state.queue || 'Scan to join', 800, 395);
    const qr = new Image();
    await new Promise((resolve, reject) => { qr.onload = resolve; qr.onerror = reject; qr.src = state.liveQrDataUrl || ''; });
    context.drawImage(qr, 250, 520, 1100, 1100);
    context.font = '700 60px ui-monospace, monospace'; context.fillText(state.liveJoinCode || '', 800, 1765);
    context.font = '500 42px system-ui'; context.fillText('Scan or enter this code to join privately.', 800, 1860);
    context.font = '500 38px system-ui'; context.fillText('No name · No phone number · No email', 800, 1940);
    return canvas;
  }
  function bytes(...parts) {
    const size = parts.reduce((total, part) => total + part.length, 0);
    const merged = new Uint8Array(size); let offset = 0;
    parts.forEach((part) => { merged.set(part, offset); offset += part.length; });
    return merged;
  }
  function simplePdf(jpeg, width, height) {
    const enc = new TextEncoder();
    const objects = [];
    const pushText = (text) => objects.push(enc.encode(text));
    pushText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    pushText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
    pushText('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
    objects.push(bytes(enc.encode(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`), jpeg, enc.encode('\nendstream\nendobj\n')));
    const content = 'q\n612 0 0 792 0 0 cm\n/Im0 Do\nQ\n';
    pushText(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);
    let offset = enc.encode('%PDF-1.4\n').length;
    const starts = [0];
    objects.forEach((object) => { starts.push(offset); offset += object.length; });
    const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${starts.slice(1).map((start) => `${String(start).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
    return bytes(enc.encode('%PDF-1.4\n'), ...objects, enc.encode(xref));
  }
  window.downloadQueueAsset = async (format) => {
    if (!state.liveQrDataUrl || !state.liveJoinCode) return window.toast?.('Start a live queue before downloading its QR code.');
    try {
      const canvas = await queueCanvas();
      let blob, extension;
      if (format === 'pdf') {
        const data = await (await fetch(canvas.toDataURL('image/jpeg', .94))).arrayBuffer();
        blob = new Blob([simplePdf(new Uint8Array(data), canvas.width, canvas.height)], { type: 'application/pdf' }); extension = 'pdf';
      } else {
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .94)); extension = 'jpg';
      }
      const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `lets-q-${state.liveJoinCode}.${extension}`; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch { window.toast?.('Could not create that QR file. Please try again.'); }
  };
  window.watchSponsorForReport = () => window.toast?.('A rewarded sponsor video needs its own AdMob rewarded-ad unit before it can unlock a report. Ad-free + analytics is ready now.');

  function addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      body{padding-bottom:92px;background:var(--paper2)} .shell{max-width:760px;padding:18px 16px 34px}.app-header{position:sticky;top:0;z-index:8;display:flex;justify-content:space-between;align-items:center;margin:-18px -16px 18px;padding:14px 16px;background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(18px);border-bottom:1px solid color-mix(in srgb,var(--line) 65%,transparent)}.wordmark-button{border:0;background:transparent;padding:0;cursor:pointer}.app-web-logo{display:block;width:180px;height:auto;mix-blend-mode:multiply}.header-actions{display:flex;align-items:center;gap:8px;position:relative}.icon-button{width:42px;height:42px;border:1px solid var(--line);border-radius:14px;background:var(--paper);color:var(--ink);font-size:22px;cursor:pointer}.language-menu{position:absolute;right:50px;top:50px;width:180px;padding:12px;background:var(--paper);border:1px solid var(--line);border-radius:16px;box-shadow:0 16px 35px #0002}.language-menu label{display:block;font:700 11px ui-monospace,monospace;color:var(--muted);letter-spacing:1px;margin:0 0 8px}.language-menu select{padding:9px}.home-hero{padding:24px 4px 22px}.eyebrow,.page-kicker{font:800 11px ui-monospace,monospace;letter-spacing:1.5px;color:var(--muted)}.home-hero h1,.appearance-card h1,.host-setup-card h1,.page-head h1{font-size:clamp(32px,9vw,48px);line-height:1.02;letter-spacing:-2px;margin:10px 0 14px}.home-hero p{max-width:480px;color:var(--muted);font-size:17px}.home-actions{display:grid;gap:12px}.home-action{display:grid;grid-template-columns:48px 1fr 20px;align-items:center;gap:14px;text-align:left;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:18px;border-radius:22px;cursor:pointer;box-shadow:0 9px 22px #0000000c}.home-action b,.home-action small{display:block}.home-action b{font-size:19px}.home-action small{font-size:13px;color:var(--muted);margin-top:3px}.home-icon{display:grid;place-items:center;width:48px;height:48px;border-radius:16px;background:var(--paper2);font-size:25px}.host-action .home-icon{background:#dceee0}.home-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.info-card{padding:16px;text-align:left;border:1px solid var(--line);background:color-mix(in srgb,var(--paper) 70%,var(--paper2));border-radius:18px;color:var(--ink);cursor:pointer}.info-card b,.info-card span{display:block}.info-card span{font-size:13px;line-height:1.35;color:var(--muted);margin-top:5px}.app-nav{position:fixed;z-index:12;bottom:0;left:0;right:0;display:grid;grid-template-columns:repeat(5,1fr);padding:8px max(10px,env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(10px,env(safe-area-inset-right));background:var(--paper);border-top:1px solid var(--line);box-shadow:0 -8px 24px #00000012}.app-nav button{border:0;background:transparent;color:var(--muted);display:grid;gap:2px;place-items:center;padding:4px 1px;cursor:pointer}.app-nav span{font-size:22px;line-height:1}.app-nav b{font-size:10px}.app-nav button.active{color:var(--ink)}.app-nav button.active span{display:grid;place-items:center;width:38px;height:28px;border-radius:11px;background:var(--paper2)}.page-head{display:flex;justify-content:space-between;align-items:center;margin:10px 0 16px}.page-head h1{font-size:31px;margin:5px 0 0}.segmented{display:flex;gap:7px;overflow:auto;margin:0 0 16px}.segmented button{white-space:nowrap;border:1px solid var(--line);background:var(--paper);color:var(--muted);border-radius:99px;padding:8px 13px;cursor:pointer}.segmented button.active{background:var(--ink);color:var(--paper);border-color:var(--ink)}.saved-queues{list-style:none;padding:0;margin:0}.saved-queues li+li{border-top:1px solid var(--line)}.saved-queues button{width:100%;display:grid;grid-template-columns:1fr auto 14px;align-items:center;gap:10px;text-align:left;border:0;background:transparent;color:var(--ink);padding:15px 0;cursor:pointer}.saved-queues b,.saved-queues small{display:block}.saved-queues small{margin-top:3px;color:var(--muted)}.ticket-state{font-style:normal;font-size:11px;font-weight:700;padding:5px 8px;border-radius:99px;background:var(--paper2)}.ticket-state.ready{background:#d9f0df}.ticket-state.cancelled,.ticket-state.served{background:#e8e5df}.empty-list{text-align:center;padding:28px 8px}.empty-list p{color:var(--muted);font-size:14px}.appearance-card{max-width:640px;margin:auto}.theme-block{margin-top:28px}.theme-block h2{font-size:16px;margin:0 0 10px}.theme-options{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}.theme-choice{display:flex;align-items:center;gap:9px;border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:11px;border-radius:14px;cursor:pointer}.theme-choice.selected{outline:2px solid var(--ink);outline-offset:1px}.theme-choice i{display:block;width:18px;height:18px;border-radius:50%;background:var(--ink)}.theme-choice.plum i{background:#4a294a}.theme-choice.sunset i{background:#a45428}.theme-choice.forest i{background:#27704c}.custom-theme{display:flex!important;align-items:center;justify-content:space-between;margin-top:10px;padding:10px 12px!important;border:1px solid var(--line);border-radius:13px;background:var(--paper);font-size:13px!important;color:var(--muted)!important}.custom-theme input{width:44px;height:30px;padding:2px;border-radius:8px;cursor:pointer}.host-setup-card{max-width:680px;margin:auto}.photo-actions{display:flex;gap:9px;flex-wrap:wrap}.date-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.date-grid label{display:block;font-size:12px;font-weight:700;color:var(--muted);margin:0 0 6px}.report-unlock{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:17px;border:1px solid var(--line);border-radius:18px;background:var(--paper2)}.report-unlock b,.report-unlock span{display:block}.report-unlock span{font-size:13px;color:var(--muted);margin-top:4px}.report-unlock .button{flex:0 0 auto}.report-divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:13px;margin:20px 0}.report-divider:before,.report-divider:after{content:"";height:1px;background:var(--line);flex:1}.app-overlay{position:fixed;z-index:30;inset:0;display:grid;place-items:center;padding:24px;background:#092b32cc;backdrop-filter:blur(6px)}.app-overlay[hidden]{display:none}.overlay-card{position:relative;max-width:410px;padding:28px;border-radius:26px;background:var(--paper);color:var(--ink);box-shadow:0 25px 70px #0004}.overlay-card h2{margin:12px 0 8px}.overlay-card p{color:var(--muted)}.overlay-close{position:absolute;right:15px;top:12px;border:0;background:transparent;color:var(--muted);font-size:30px;cursor:pointer}.qr-focus{padding:20px;background:#0e2025}.qr-focus-inner{max-width:min(94vw,760px);width:100%;text-align:center}.qr-focus img{display:block;width:min(78vh,78vw,640px);height:min(78vh,78vw,640px);margin:0 auto;background:#fff;padding:18px;border-radius:12px}.qr-focus-code{margin-top:18px;color:#fff;font:800 clamp(24px,5vw,44px) ui-monospace,monospace;letter-spacing:5px}.qr-focus .overlay-close{color:#fff}.host-actions .button{min-height:52px}.print-toolbar{max-width:690px}.print-toolbar .button{min-width:0}.ad-banner{display:none!important}.toast{bottom:88px;z-index:40}@media(min-width:721px){body{padding-bottom:0}.shell{padding-bottom:36px}.app-nav{top:0;bottom:auto;left:auto;right:24px;width:410px;background:transparent;border:0;box-shadow:none;padding:20px 0}.app-nav button{display:none}.app-nav button.active{display:grid}.app-nav button.active span{display:none}.app-nav button.active b{font-size:13px}.app-header{margin-top:-18px;padding-right:430px}.home-grid{max-width:560px}.app-web-logo{width:210px}}@media(max-width:460px){.app-web-logo{width:146px}.home-grid{grid-template-columns:1fr}.date-grid{grid-template-columns:1fr}.header-actions{gap:5px}.icon-button{width:38px;height:38px}.card-in{padding:20px}.print-toolbar{gap:7px}.print-toolbar .button{font-size:12px;padding:10px 8px}.report-unlock{display:block}.report-unlock .button{margin-top:12px}}
    `;
    document.head.append(style);
  }

  function addPrototypeVisualLayer() {
    const style = document.createElement('style');
    style.textContent = `
      :root{--app-accent:#2563eb;--app-accent-2:#00b8ff;--app-accent-soft:#eff6ff}
      html,body{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;background:radial-gradient(circle at 20% 0,#fff 0,#edf4ff 35%,#e8f0fa 100%)!important;color:var(--ink)}
      body{letter-spacing:0;padding-bottom:88px!important}.shell{max-width:620px!important;padding:18px 14px 34px!important}.app-header{min-height:72px;margin:-18px -14px 18px!important;padding:14px!important;background:color-mix(in srgb,var(--paper) 94%,transparent)!important;border-color:var(--line)!important}.app-web-logo{width:175px!important;mix-blend-mode:normal!important}.header-actions{gap:7px!important}.icon-button{display:grid!important;place-items:center;width:39px!important;height:39px!important;border-radius:13px!important;font-size:0!important;color:var(--ink)!important}.icon-button svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.language-menu{right:45px!important;top:46px!important;border-radius:17px!important;box-shadow:0 18px 38px #0f172a20!important}
      .page-kicker,.eyebrow,.ticket-top{font:800 10px Inter,-apple-system,sans-serif!important;letter-spacing:.12em!important;color:var(--app-accent)!important}.ticket-top span:last-child{color:var(--muted)!important}.home-hero{padding:18px 3px 17px!important}.home-hero h1,.appearance-card h1,.host-setup-card h1,.page-head h1{font-family:Inter,-apple-system,sans-serif!important;font-size:clamp(30px,8.5vw,43px)!important;letter-spacing:-1.55px!important;line-height:1.06!important}.home-hero p{font-size:15px!important;line-height:1.55!important}.home-actions{gap:11px!important}.home-action{border-radius:20px!important;padding:16px!important;border-color:var(--line)!important;box-shadow:0 10px 28px #0f172a0c!important}.home-action:hover{transform:translateY(-1px)}.home-icon{width:46px!important;height:46px!important;border-radius:15px!important;background:color-mix(in srgb,var(--app-accent) 11%,#fff)!important;color:var(--app-accent);font-size:24px!important}.host-action .home-icon{background:color-mix(in srgb,var(--app-accent-2) 13%,#fff)!important}.home-action b{font-size:17px!important}.home-action small{font-size:12px!important}.home-grid{gap:10px!important;margin-top:13px!important}.info-card{border-radius:17px!important;background:var(--paper)!important;border-color:var(--line)!important}.info-card b{font-size:13px}.info-card span{font-size:11px!important}
      .card{border:1px solid var(--line)!important;border-radius:22px!important;background:var(--paper)!important;box-shadow:0 9px 28px #0f172a0b!important}.card-in{padding:19px!important}.button{min-height:44px!important;border:1px solid var(--line)!important;border-radius:14px!important;background:var(--paper)!important;color:var(--ink)!important;font-family:Inter,-apple-system,sans-serif!important;font-size:13px!important;font-weight:800!important;box-shadow:none!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}.button:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--app-accent) 48%,var(--line))!important}.button.primary{border:0!important;background:linear-gradient(135deg,var(--app-accent),var(--app-accent-2))!important;color:#fff!important;box-shadow:0 10px 23px color-mix(in srgb,var(--app-accent) 27%,transparent)!important}.button.secondary,.button.green{background:color-mix(in srgb,var(--app-accent) 9%,#fff)!important;border-color:color-mix(in srgb,var(--app-accent) 24%,var(--line))!important;color:var(--app-accent)!important}.button.danger{color:#b91c1c!important;background:#fef2f2!important;border-color:#fecaca!important}.button svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:middle;margin-right:5px}.wide{width:100%}
      input,select,textarea{border:1px solid var(--line)!important;border-radius:13px!important;background:color-mix(in srgb,var(--paper2) 48%,#fff)!important;color:var(--ink)!important;font-family:Inter,-apple-system,sans-serif!important}.field>label,.field>label:first-child,.field label{font:800 11px Inter,-apple-system,sans-serif!important;color:var(--ink)!important}.field input:focus,.field select:focus,.field textarea:focus{outline:0!important;border-color:var(--app-accent)!important;box-shadow:0 0 0 4px color-mix(in srgb,var(--app-accent) 13%,transparent)!important}
      .section-head{margin:3px 2px 14px}.section-head h1{font:800 27px Inter,-apple-system,sans-serif!important;letter-spacing:-.8px;margin:5px 0 5px}.section-head p{font-size:12px;line-height:1.55;color:var(--muted);margin:0}.queuer-page{max-width:520px;margin:auto}.scanner-card{padding:14px!important}.scanner-stage{height:226px;position:relative;display:grid;place-items:center;overflow:hidden;border-radius:19px;background:linear-gradient(145deg,#07172f,#143d7a)}.scanner-stage:after{content:"";position:absolute;left:34px;right:34px;top:50%;height:2px;background:linear-gradient(90deg,transparent,#57d9ff,transparent);box-shadow:0 0 14px #57d9ff;animation:letsq-scan 2.4s infinite}@keyframes letsq-scan{0%,100%{transform:translateY(-72px)}50%{transform:translateY(72px)}}.scanner-video{position:absolute!important;inset:0!important;z-index:1!important;width:100%!important;height:100%!important;max-width:none!important;aspect-ratio:auto!important;margin:0!important;border:0!important;border-radius:0!important;opacity:.95}.scan-empty{position:relative;z-index:2;display:grid;place-items:center;gap:10px;color:#dbeafe;font-size:12px;font-weight:800;transition:opacity .2s}.scan-empty svg{width:58px;height:58px;stroke:#fff;fill:none;stroke-width:1.4}.camera-live .scan-empty{opacity:0}.scan-frame{position:absolute;z-index:3;width:150px;height:150px;pointer-events:none}.scan-frame i{position:absolute;width:28px;height:28px;border-color:#fff;border-style:solid}.scan-frame i:nth-child(1){left:0;top:0;border-width:3px 0 0 3px;border-radius:10px 0 0}.scan-frame i:nth-child(2){right:0;top:0;border-width:3px 3px 0 0;border-radius:0 10px 0 0}.scan-frame i:nth-child(3){right:0;bottom:0;border-width:0 3px 3px 0;border-radius:0 0 10px 0}.scan-frame i:nth-child(4){left:0;bottom:0;border-width:0 0 3px 3px;border-radius:0 0 0 10px}.scan-status{margin:11px 0!important;border:1px solid var(--line)!important;border-radius:12px!important;background:var(--paper2)!important;color:var(--muted)!important;text-align:center;font-size:11px!important}.or-divider{display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--muted);font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.or-divider:before,.or-divider:after{content:"";height:1px;background:var(--line);flex:1}.scan-code-field{display:block!important;margin-bottom:11px!important}.scan-code-field input{display:block!important;width:100%;margin-top:7px!important}.scan-help{text-align:center!important;font-size:10px!important;margin:10px 6px 0!important}.privacy-strip{display:flex;align-items:flex-start;gap:10px;padding:14px;margin-top:12px;border:1px solid color-mix(in srgb,var(--app-accent) 19%,var(--line));border-radius:17px;background:color-mix(in srgb,var(--app-accent) 7%,#fff)}.privacy-strip>span{display:grid;place-items:center;flex:0 0 31px;width:31px;height:31px;border-radius:11px;background:var(--app-accent);color:#fff;font-weight:900}.privacy-strip p{margin:0;font-size:11px;line-height:1.45;color:var(--muted)}.privacy-strip b{display:block;color:var(--ink);margin-bottom:2px}
      .app-nav{height:78px!important;padding:7px max(7px,env(safe-area-inset-left)) calc(7px + env(safe-area-inset-bottom)) max(7px,env(safe-area-inset-right))!important;background:color-mix(in srgb,var(--paper) 96%,transparent)!important;border-color:var(--line)!important;backdrop-filter:blur(18px)}.app-nav button{display:flex!important;flex-direction:column;justify-content:center;gap:3px!important;border-radius:13px!important;padding:4px 2px!important}.app-nav .nav-icon{display:grid!important;place-items:center;width:36px!important;height:28px!important;background:transparent!important;border-radius:10px!important}.app-nav svg{width:19px;height:19px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.app-nav b{font:800 9px Inter,-apple-system,sans-serif!important}.app-nav button.active{color:var(--app-accent)!important}.app-nav button.active .nav-icon{background:color-mix(in srgb,var(--app-accent) 10%,#fff)!important}.app-nav button.active span{width:36px!important;height:28px!important;background:color-mix(in srgb,var(--app-accent) 10%,#fff)!important}
      .segmented{padding:4px!important;border:1px solid var(--line)!important;border-radius:14px!important;background:var(--paper)!important;gap:2px!important}.segmented button{border:0!important;border-radius:10px!important;background:transparent!important;padding:8px 10px!important;font:800 10px Inter,-apple-system,sans-serif!important}.segmented button.active{background:color-mix(in srgb,var(--app-accent) 10%,#fff)!important;color:var(--app-accent)!important}.saved-queues{display:grid!important;gap:10px!important}.saved-queues li+li{border:0!important}.saved-queue-card{border:1px solid var(--line)!important;border-left:4px solid var(--app-accent)!important;border-radius:15px!important;background:var(--paper)!important;box-shadow:0 7px 20px #0f172a0a!important}.saved-queue-card.ready{border-left-color:#22c55e!important}.saved-queue-card.served,.saved-queue-card.cancelled{border-left-color:#94a3b8!important}.saved-queues button{display:flex!important;align-items:center!important;gap:11px!important;width:100%;padding:12px!important}.saved-queue-copy{display:grid!important;gap:3px!important;flex:1!important;min-width:0}.saved-queues b{font-size:14px!important}.saved-queues small{font:800 9px Inter,-apple-system,sans-serif!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:var(--muted)!important}.saved-queue-copy strong{font:900 19px Inter,-apple-system,sans-serif!important;color:var(--app-accent)!important}.saved-chevron{font-size:23px!important;color:var(--muted)!important}.ticket-state{background:#fef3c7!important;color:#92400e!important;font-size:9px!important}.ticket-state.ready{background:#dcfce7!important;color:#166534!important}.ticket-state.cancelled,.ticket-state.served{background:#e5e7eb!important;color:#475569!important}.empty-list{padding:25px 5px!important}.empty-list b{font-size:15px}
      .host-setup-card{border-radius:24px!important}.host-setup-card h1{font-size:31px!important}.photo-actions .button{display:inline-flex;align-items:center}.photo-preview{border:1px dashed var(--line)!important;border-radius:13px!important;background:var(--paper2)!important}.policy-option{border:1px solid var(--line)!important;border-radius:14px!important;background:var(--paper)!important}.policy-option:has(input:checked){border-color:var(--app-accent)!important;background:color-mix(in srgb,var(--app-accent) 7%,#fff)!important;box-shadow:0 0 0 3px color-mix(in srgb,var(--app-accent) 9%,transparent)!important}.host-control-app .number{font:900 66px Inter,-apple-system,sans-serif!important;color:var(--app-accent)!important;letter-spacing:-3px!important}.host-control-app .schedule-chip{background:color-mix(in srgb,var(--app-accent) 8%,#fff)!important;color:var(--app-accent)!important;border-radius:12px!important}.queue-panel-app .q-list li{padding:12px 0!important}.queue-panel-app .pill{background:color-mix(in srgb,var(--app-accent) 9%,#fff)!important;color:var(--app-accent)!important;border-radius:999px!important;font-size:9px!important}.metric,.stat{border:1px solid var(--line)!important;background:var(--paper2)!important;border-radius:14px!important}.metric b{color:var(--app-accent)!important}.progress i{background:linear-gradient(90deg,var(--app-accent),var(--app-accent-2))!important}.plan{border:1px solid color-mix(in srgb,var(--app-accent) 28%,var(--line))!important;background:linear-gradient(145deg,color-mix(in srgb,var(--app-accent) 9%,#fff),#fff)!important;border-radius:21px!important}.plan-price{color:var(--app-accent)!important}.report-unlock{border-color:var(--line)!important;background:var(--paper2)!important}
      @media (min-width:721px){body{padding:14px 0 0!important}.shell{min-height:calc(100vh - 28px);margin:14px auto!important;border:1px solid var(--line);border-radius:34px;background:var(--paper);box-shadow:0 30px 90px #0f172a20;overflow:hidden}.app-header{border-radius:34px 34px 0 0!important}.app-nav{position:fixed!important;top:auto!important;left:50%!important;right:auto!important;bottom:14px!important;transform:translateX(-50%);width:min(590px,calc(100vw - 28px));border:1px solid var(--line)!important;border-radius:20px;box-shadow:0 14px 35px #0f172a20}.shell{padding-bottom:108px!important}.app-nav button{display:flex!important}.app-nav button.active span{display:grid!important}.app-header{padding-right:14px!important}.columns{grid-template-columns:1fr!important}.home-grid{max-width:none!important}.app-web-logo{width:195px!important}}
      @media(max-width:420px){.app-web-logo{width:145px!important}.home-grid{grid-template-columns:1fr!important}.scanner-stage{height:202px}.card-in{padding:17px!important}.app-nav b{font-size:8px!important}}
    `;
    document.head.append(style);
  }

  function addRequestedPolish() {
    const style = document.createElement('style');
    style.textContent = `
      /* The two primary roles are intentionally equal, large touch targets. */
      .home-actions{grid-template-columns:repeat(2,minmax(0,1fr))!important;align-items:stretch!important}.home-action{display:flex!important;min-height:185px!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:12px!important;padding:22px 10px!important;text-align:center!important}.home-action .home-icon{width:74px!important;height:74px!important;border-radius:24px!important;font-size:0!important}.home-action .home-icon svg{width:38px;height:38px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.home-action b{font-size:19px!important}.home-action small{margin-top:4px!important;line-height:1.3!important}
      /* Keep no-show actions short and aligned with their radio check. */
      .policy-option{display:flex!important;align-items:center!important;gap:12px!important;min-height:58px!important;padding:14px!important}.policy-option>input[type="radio"]{width:20px!important;height:20px!important;min-width:20px!important;margin:0!important;accent-color:var(--app-accent)!important}.policy-option>b{display:block!important;flex:1!important;margin:0!important;font:800 15px/1.35 Inter,-apple-system,sans-serif!important;color:var(--ink)!important}.policy-option>b input{width:54px!important;min-height:34px!important;margin:0 3px!important;padding:4px!important;text-align:center!important}
      /* Every palette is a deliberate two-color combination. */
      .theme-options{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.theme-choice{min-height:56px!important;padding:10px!important;font:800 12px Inter,-apple-system,sans-serif!important}.theme-choice i{width:30px!important;height:30px!important;min-width:30px!important;border:2px solid #fff!important;box-shadow:0 0 0 1px var(--line)!important;background:linear-gradient(135deg,var(--theme-a) 0 50%,var(--theme-b) 50% 100%)!important}.theme-choice.selected{outline:2px solid var(--app-accent)!important;outline-offset:1px!important}
      @media(max-width:360px){.home-action{min-height:164px!important;padding:17px 7px!important}.home-action .home-icon{width:62px!important;height:62px!important}.home-action .home-icon svg{width:31px;height:31px}.home-action b{font-size:17px!important}.home-action small{font-size:10px!important}.theme-choice{font-size:11px!important}}
    `;
    document.head.append(style);
  }

  const originalGoTo = window.goTo;
  window.goTo = (view) => {
    if (view === 'host') view = state.liveHostQueueId ? 'organizer' : 'setup';
    originalGoTo(view);
    state.appRole = appRoleForView(view); applyTheme(state.appRole); setActiveNav(view);
    if (view === 'setup') {
      const startDate = document.querySelector('#setup-start-date'); const endDate = document.querySelector('#setup-end-date');
      if (startDate && !startDate.value) startDate.value = state.startDate || today();
      if (endDate && !endDate.value) endDate.value = state.endDate || state.startDate || today();
      const start = document.querySelector('#setup-start'); const end = document.querySelector('#setup-end');
      if (start && !start.value) start.value = state.startTime || '09:00';
      if (end && !end.value) end.value = state.endTime || '17:00';
    }
    if (view === 'q-list') renderTicketList();
    upgradeRenderedPanels();
  };
  const originalRender = window.render;
  window.render = () => { originalRender(); upgradeRenderedPanels(); renderTicketList(); setActiveNav(state.currentView); };

  const originalSetLanguage = window.setLanguage;
  window.setLanguage = (value) => {
    if (['en','es','zh-Hant','zh-Hans','ko','ja'].includes(value)) {
      try { localStorage.setItem('letsq-interface-language', value); } catch {}
      // The original localizer owns its text-node cache. It supports the added
      // dictionary once its saved language check is extended below in index.html.
      originalSetLanguage(value);
    } else originalSetLanguage('en');
    document.querySelector('#language-menu')?.setAttribute('hidden', '');
  };

  injectShell();
  addStyles();
  addPrototypeVisualLayer();
  addRequestedPolish();
  upgradePrintView();
  state.appRole = appRoleForView(state.currentView);
  applyTheme(state.appRole);
  window.goTo(state.currentView || 'role');
})();
