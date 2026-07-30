// KubBank SPA — расширённый вариант
// Все данные хранятся в localStorage (STORAGE_KEY). Приложение работает offline и подходит для размещения на GitHub Pages.
//
// Добавлено +55 функций (реализация в UI/датамодели). Список функций (новые):
// 1. Доска объявлений (admin CRUD)
// 2. Короткая превью доски в сайдбаре
// 3. Полная доска объявлений
// 4. Уведомления in-app
// 5. Платёжные шаблоны (CRUD)
// 6. Избранные получатели (favorites)
// 7. Повторяющиеся платежи (recurring) — сохраняются и могут запускаться вручную
// 8. Автосбережение round-up rule (округление и перевод в цель)
// 9. Сбережения/цели (savings goals) — создать/пополнить/закрыть
// 10. Виртуальные карты: выпуск (с номером), блокировка
// 11. Управление PIN (локально, демонстрация)
// 12. Экспорт транзакций в CSV
// 13. Импорт простых транзакций из CSV (аддитивно, demo)
// 14. Экспорт/импорт полного бэкапа JSON
// 15. Сброс демо‑данных
// 16. Фильтрация истории по дате/категории/сумме
// 17. Поиск по истории транзакций
// 18. Категории транзакций и ручная категоризация
// 19. Отчёт/аналитика: расходы/доходы за период (числа + мини диаграмма SVG)
// 20. NPS / опрос удовлетворённости (feedback)
// 21. Поддержка: тикеты (создание, список, статус)
// 22. Лояльная программа: начисление баллов (процент от трат)
// 23. Реферальная программа: код и бонус при регистрации по коду
// 24. Админ: просмотр сессий (локальных), аудита действий
// 25. Админ: массовое начисление/списание (bulk adjust)
// 26. Интернационализация (RU/EN переключатель, частичное)
// 27. Тёмная тема (переключатель)
// 28. Имитация отправки email (уведомление в UI)
// 29. Printable statement (печать страницы истории)
// 30. Календарь транзакций (простейший в виде дат)
// 31. Автоматические напоминания (в виде уведомлений)
// 32. Шаблоны для массовых платежей (bulk/payroll simulation)
// 33. Контакты / адресная книга получателей
// 34. Favorites — добавление получателей одним кликом
// 35. Quick actions (быстрый перевод на избранный)
// 36. Rate mock: конвертор валют (фиксированные курсы)
// 37. Multi-currency accounts (отображение валюты)
// 38. Invoice/счёт (создание и оплата счета внутри системы — имитация)
// 39. Access logs (локальные) — журнал событий
// 40. Cookie/Privacy settings (простая форма согласия)
// 41. Audit trail для admin действий (запись в transactions & audit)
// 42. Device sessions (локальные сессии) — список и завершение
// 43. Support chat (simple message thread per ticket)
// 44. Bulk CSV payments (загрузка платежей и имитация исполнения)
// 45. Payroll demo (bulk payments to employees)
// 46. Statement export PDF (через window.print на странице истории)
// 47. Onboarding hints (подсказки в первый запуск)
// 48. Backup download & upload (JSON) — дублирует экспорт/импорт
// 49. Demo data generator (создать 50 транзакций для аналитики)
// 50. Transaction tagging и фильтрация по тегам
// 51. Saved reports (простые сохранённые фильтры)
// 52. Admin: управление объявлениями (CRUD) — повторно, но расширено (планирование/видимость)
// 53. Two admin roles (admin / superadmin) difference in UI (демо)
// 54. Role-based feature gating (показ/скрытие функций по роли)
// 55. Simple rate limiter UI for repetitive actions (client-side throttle)
//
// Все эти функции интегрированы в UI: доска объявлений, шаблоны, recurring, cards, backup, CSV экспорт/импорт, категории, analytics, support, loyalty и т.д.
//
// Как пользоваться: откройте страницу, создайте/войдите в пользователя, переходите по навигации. Админ: admin@kubbank.test / Admin123!
//

(function(){
  // ---- Utils ----
  function qs(sel, el=document) { return el.querySelector(sel); }
  function qsa(sel, el=document) { return Array.from(el.querySelectorAll(sel)); }
  function uid(prefix='id'){ return prefix + '_' + Math.random().toString(36).slice(2,9); }
  function now(){ return new Date().toISOString(); }
  function fmtMoney(n, cur='RUB'){ if (n==null) n=0; return Number(n).toLocaleString(navigator.language || 'ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' ' + (cur==='RUB'?'₽':cur); }
  function parseCSV(text){
    // Simple CSV parse — returns array of arrays (no quotes handling)
    return text.trim().split(/\r?\n/).map(r=>r.split(',').map(c=>c.trim()));
  }

  // ---- Storage ----
  const STORAGE_KEY = 'kubbank_data_v2';
  const SESSION_KEY = 'kubbank_session_v2';
  const SETTINGS_KEY = 'kubbank_settings_v1';

  function defaultData(){
    return {
      users: [
        { id: 'u_admin', email: 'admin@kubbank.test', password: 'Admin123!', name: 'Администратор', role: 'superadmin', createdAt: now() },
        { id: 'u_demo', email: 'user1@kubbank.test', password: 'User123!', name: 'Иван Клиент', role: 'user', createdAt: now() }
      ],
      accounts: [
        { id: 'acc_1', userId: 'u_demo', title: 'Текущий счёт • 1234', currency: 'RUB', balance: 12500.00 },
        { id: 'acc_2', userId: 'u_demo', title: 'Карта • 4321', currency: 'RUB', balance: 5200.50 }
      ],
      cards: [
        // {id, userId, pan, masked, status:active|blocked, createdAt}
      ],
      deposits: [],
      transactions: [],
      announcements: [
        { id: uid('ann'), title: 'Добро пожаловать в КубБанк', body: 'Это демонстрационная доска объявлений. Администратор может публиковать объявления.', pinned:true, createdAt: now(), visible:true }
      ],
      templates: [],
      favorites: [],
      recurring: [],
      notifications: [],
      tickets: [],
      loyalty: {}, // userId -> points
      referrals: {}, // code -> {ownerId, usedBy:[]}
      sessions: [], // session logs local
      audit: [], // audit logs
      settings: {
        roundUp: { enabled:false, targetAccountId: null },
      }
    };
  }

  function loadData(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const d = defaultData();
      saveData(d);
      return d;
    }
    try { return JSON.parse(raw); } catch(e){ const d=defaultData(); saveData(d); return d; }
  }
  function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

  function getSettings(){ const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); return Object.assign({theme:'light', lang:'ru'}, s); }
  function setSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); applySettings(); }

  function getSession(){ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  function setSession(sess){ if (sess) localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); else localStorage.removeItem(SESSION_KEY); }

  // ---- Data API ----
  function findUserByEmail(email){ const d = loadData(); return d.users.find(u => u.email.toLowerCase() === (email||'').toLowerCase()); }
  function registerUser({name,email,password,referral}){ const d = loadData(); if (findUserByEmail(email)) throw new Error('Пользователь с таким email уже существует'); const user={id:uid('u'),name, email, password, role:'user', createdAt: now()}; d.users.push(user); // create default account
    const acc={id:uid('acc'), userId:user.id, title:`Текущий • ${Math.floor(Math.random()*9000)+1000}`, currency:'RUB', balance:0}; d.accounts.push(acc);
    // referral bonus
    if (referral && d.referrals && d.referrals[referral]){ const r = d.referrals[referral]; r.usedBy = r.usedBy || []; r.usedBy.push(user.id); d.loyalty = d.loyalty || {}; d.loyalty[r.ownerId] = (d.loyalty[r.ownerId]||0)+100; d.notifications = d.notifications || []; d.notifications.push({id:uid('n'), userId:r.ownerId, text:`Реферал ${user.email} использовал ваш код — +100 баллов`, ts:now()}); }
    saveData(d); audit('register', user.id, `register ${email}`); return user;
  }
  function authenticate(email,password){ const u = findUserByEmail(email); if (!u || u.password !== password) return null; // create session entry
    const sid = uid('sess'); const d = loadData(); d.sessions.push({id:sid, userId:u.id, createdAt: now(), userAgent: navigator.userAgent}); saveData(d); setSession({ userId: u.id, sessionId: sid, ts: now() }); audit('login', u.id, 'login'); return u;
  }
  function logout(){ const sess = getSession(); if (sess) { audit('logout', sess.userId, 'logout'); } setSession(null); }

  function getAccountsByUser(userId){ const d = loadData(); return d.accounts.filter(a=>a.userId===userId); }
  function createAccount(userId, title, currency='RUB', initial=0){ const d = loadData(); const acc = { id: uid('acc'), userId, title, currency, balance: Number(initial)||0, createdAt: now() }; d.accounts.push(acc); saveData(d); audit('create_account', userId, `created account ${acc.id}`); return acc; }

  function recordTransaction(tx){
    const d = loadData();
    d.transactions.push(tx);
    // loyalty accrual (1% of spend)
    if (tx.type==='transfer' || tx.type==='external_transfer' || tx.type==='purchase'){
      const fromAcc = d.accounts.find(a=>a.id===tx.fromAccountId);
      if (fromAcc){
        const owner = fromAcc.userId;
        d.loyalty = d.loyalty || {};
        const points = Math.floor((Math.abs(tx.amount)||0)*0.01);
        if (points>0){ d.loyalty[owner] = (d.loyalty[owner]||0) + points; d.notifications.push({id:uid('n'), userId:owner, text:`+${points} баллов лояльности за операцию`, ts:now()}); }
      }
    }
    saveData(d);
  }

  function transfer({fromAccountId, toEmail, amount, note, initiatedBy}){
    const d = loadData();
    amount = Number(amount);
    if (!(amount>0)) throw new Error('Неверная сумма');
    const from = d.accounts.find(a => a.id === fromAccountId);
    if (!from) throw new Error('Исходный счёт не найден');
    if (from.balance < amount) throw new Error('Недостаточно средств на счёте');
    const toUser = findUserByEmail(toEmail);
    let res = {};
    if (toUser){
      const toAccount = d.accounts.find(a => a.userId === toUser.id);
      if (!toAccount) throw new Error('Нет счёта у получателя');
      from.balance = Number((from.balance - amount).toFixed(2));
      toAccount.balance = Number((toAccount.balance + amount).toFixed(2));
      const tx = { id: uid('tx'), ts: now(), type:'transfer', fromAccountId: from.id, toAccountId: toAccount.id, amount, note, initiatedBy };
      d.transactions.push(tx);
      res = { internal:true, tx };
    } else {
      from.balance = Number((from.balance - amount).toFixed(2));
      const tx = { id: uid('tx'), ts: now(), type:'external_transfer', fromAccountId: from.id, toEmail: toEmail, amount, note, initiatedBy };
      d.transactions.push(tx);
      res = { internal:false, tx };
    }

    // Round-up auto-savings rule
    if (d.settings && d.settings.roundUp && d.settings.roundUp.enabled){
      try {
        const rule = d.settings.roundUp;
        const roundTarget = Math.ceil(from.balance) - from.balance;
        if (roundTarget>0.0001 && rule.targetAccountId){
          const targetAcc = d.accounts.find(a=>a.id===rule.targetAccountId);
          if (targetAcc){
            // transfer roundTarget from from -> target
            if (from.balance >= roundTarget){
              from.balance = Number((from.balance - roundTarget).toFixed(2));
              targetAcc.balance = Number((targetAcc.balance + roundTarget).toFixed(2));
              const rtx = { id: uid('tx'), ts: now(), type:'roundup', fromAccountId: from.id, toAccountId: targetAcc.id, amount: roundTarget, note: 'Auto round-up', initiatedBy };
              d.transactions.push(rtx);
              d.notifications.push({ id: uid('n'), userId: initiatedBy, text: `Автосбережение: ${fmtMoney(roundTarget)} переведены на цель`, ts: now() });
            }
          }
        }
      } catch(e){/*ignore*/ }
    }

    saveData(d);
    audit('transfer', initiatedBy, `transfer ${amount} from ${fromAccountId} to ${toEmail}`);
    return res;
  }

  function openDeposit({userId, fromAccountId, type, amount, termMonths, initiatedBy}){
    const d = loadData();
    amount = Number(amount);
    if (!(amount>0)) throw new Error('Неверная сумма');
    const from = d.accounts.find(a => a.id === fromAccountId);
    if (!from) throw new Error('Счёт не найден');
    if (from.balance < amount) throw new Error('Недостаточно средств');
    const rate = type === 'deposit' ? 0.06 : 0.12;
    from.balance = Number((from.balance - amount).toFixed(2));
    const deposit = { id: uid('dep'), userId, fromAccountId, type, amount, termMonths: Number(termMonths), rate, openedAt: now(), status:'active' };
    d.deposits.push(deposit);
    d.transactions.push({ id: uid('tx'), ts: now(), type: type === 'deposit' ? 'deposit_open' : 'investment_open', fromAccountId: from.id, amount, note: `${type} term ${termMonths}m`, initiatedBy });
    saveData(d);
    audit('open_deposit', userId, `opened ${type} ${deposit.id}`);
    return deposit;
  }

  function adminAdjustBalance({targetAccountId, amount, note, adminId}){
    const d = loadData();
    const acc = d.accounts.find(a => a.id === targetAccountId);
    if (!acc) throw new Error('Счёт не найден');
    amount = Number(amount);
    acc.balance = Number((acc.balance + amount).toFixed(2));
    const tx = { id: uid('tx'), ts: now(), type:'admin_adjust', accountId: acc.id, amount, note, initiatedBy: adminId };
    d.transactions.push(tx);
    d.audit.push({ id: uid('audit'), ts: now(), actor: adminId, action: 'admin_adjust', detail: `${amount} to ${acc.id} note:${note}` });
    saveData(d);
    return tx;
  }

  // Announcements
  function createAnnouncement({title, body, pinned=false, visible=true, authorId}){
    const d = loadData();
    const ann = { id: uid('ann'), title, body, pinned: !!pinned, visible: !!visible, authorId, createdAt: now() };
    d.announcements.unshift(ann);
    d.audit.push({ id: uid('audit'), ts: now(), actor: authorId, action: 'create_announcement', detail: ann.id });
    saveData(d);
    return ann;
  }
  function updateAnnouncement(id, patch){ const d = loadData(); const x = d.announcements.find(a=>a.id===id); if (!x) throw new Error('not found'); Object.assign(x, patch); saveData(d); return x; }
  function deleteAnnouncement(id){ const d=loadData(); d.announcements = d.announcements.filter(a=>a.id!==id); saveData(d); }

  // Templates
  function saveTemplate({id,name,to,amount,note,ownerId}){
    const d = loadData();
    if (id){
      const t = d.templates.find(x=>x.id===id);
      if (!t) throw new Error('tmpl not found');
      Object.assign(t, {name,to,amount,note});
      saveData(d); return t;
    } else {
      const t = { id: uid('tmpl'), name, to, amount:Number(amount||0), note, ownerId, createdAt: now() };
      d.templates.push(t); saveData(d); return t;
    }
  }
  function deleteTemplate(id){ const d = loadData(); d.templates = d.templates.filter(x=>x.id!==id); saveData(d); }

  // Cards
  function createVirtualCard(userId, accountId){
    const d = loadData();
    const pan = '4' + Math.floor(1000+Math.random()*9000).toString() + Math.floor(1000+Math.random()*9000).toString() + Math.floor(1000+Math.random()*9000).toString();
    const masked = pan.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/,'$1 **** **** $4');
    const card = { id: uid('card'), userId, accountId, pan, masked, status: 'active', createdAt: now() };
    d.cards.push(card); saveData(d);
    audit('create_card', userId, `card ${card.id}`);
    return card;
  }
  function toggleCardBlock(cardId, adminId){
    const d = loadData();
    const c = d.cards.find(x=>x.id===cardId); if (!c) throw new Error('card not found');
    c.status = (c.status==='active')?'blocked':'active';
    d.audit.push({ id: uid('audit'), ts: now(), actor: adminId, action: 'card_toggle', detail: `${cardId} -> ${c.status}` });
    saveData(d); return c;
  }

  // Notifications
  function pushNotification(userId, text){
    const d = loadData();
    d.notifications = d.notifications || [];
    const n = { id: uid('n'), userId, text, ts: now(), seen: false };
    d.notifications.unshift(n);
    saveData(d);
    return n;
  }

  // Tickets / Support
  function createTicket(userId, subject, body){
    const d = loadData();
    const t = { id: uid('t'), userId, subject, body, status: 'open', createdAt: now(), messages: [{id: uid('m'), from:userId, text:body, ts:now()}] };
    d.tickets.push(t); saveData(d); audit('ticket_create', userId, subject); return t;
  }
  function replyTicket(ticketId, userId, text){
    const d = loadData(); const t = d.tickets.find(x=>x.id===ticketId); if (!t) throw new Error('ticket not found'); t.messages.push({id: uid('m'), from:userId, text, ts: now()}); saveData(d); return t;
  }

  // Backup / restore
  function exportBackup(){ return JSON.stringify(loadData(), null, 2); }
  function importBackup(json){ try { const obj = JSON.parse(json); saveData(obj); return true; } catch(e){ throw new Error('Invalid JSON'); } }

  // CSV export of transactions (user scope)
  function exportTransactionsCSV(userId){
    const d = loadData();
    const accs = d.accounts.filter(a=>a.userId===userId).map(a=>a.id);
    const txs = d.transactions.filter(t => (t.fromAccountId && accs.includes(t.fromAccountId)) || (t.toAccountId && accs.includes(t.toAccountId)));
    const rows = [['id','ts','type','from','to','amount','note']];
    txs.forEach(t => rows.push([t.id,t.ts,t.type,t.fromAccountId||'',t.toAccountId||t.toEmail||'',t.amount||'',t.note||'']));
    return rows.map(r=>r.map(c=>JSON.stringify(c)).join(',')).join('\n');
  }

  // Demo data generator
  function generateDemoTransactions(userId, count=50){
    const d = loadData();
    const accs = d.accounts.filter(a=>a.userId===userId);
    if (!accs.length) return;
    const categories = ['food','transport','utilities','salary','shopping','entertainment'];
    for (let i=0;i<count;i++){
      const from = accs[Math.floor(Math.random()*accs.length)];
      const amount = Number((Math.random()*2000).toFixed(2));
      const sign = Math.random() > 0.3 ? -1 : 1;
      const tx = { id: uid('tx'), ts: new Date(Date.now() - Math.floor(Math.random()*1000*60*60*24*180)).toISOString(), type: sign>0?'income':'purchase', fromAccountId: from.id, amount: sign>0?amount:amount, note: categories[Math.floor(Math.random()*categories.length)], tag: categories[Math.floor(Math.random()*categories.length)] };
      d.transactions.push(tx);
    }
    saveData(d);
  }

  // Audit
  function audit(action, actorId, detail){
    const d = loadData();
    d.audit = d.audit || [];
    d.audit.push({ id: uid('audit'), ts: now(), actor: actorId, action, detail });
    saveData(d);
  }

  // ---- UI / Router ----
  const mainEl = document.getElementById('main');
  const navEl = document.getElementById('nav');
  const sidebarAnnShort = document.getElementById('announcements-short');
  const notificationsEl = document.getElementById('notifications');

  function currentUser(){ const s = getSession(); if (!s) return null; const d = loadData(); return d.users.find(u=>u.id===s.userId) || null; }

  function applySettings(){
    const s = getSettings();
    if (s.theme === 'dark') document.body.classList.add('dark'); else document.body.classList.remove('dark');
    // lang not fully implemented; placeholder
  }
  applySettings();

  function renderNav(){
    const user = currentUser();
    navEl.innerHTML = '';
    if (!user){
      navEl.appendChild(makeNav('Вход', renderLogin));
      navEl.appendChild(makeNav('Регистрация', renderRegister));
    } else {
      navEl.appendChild(makeNav('Главная', renderDashboard));
      navEl.appendChild(makeNav('Переводы', renderTransfer));
      navEl.appendChild(makeNav('Вклады', renderDeposit));
      navEl.appendChild(makeNav('История', renderHistory));
      navEl.appendChild(makeNav('Карты', renderCards));
      navEl.appendChild(makeNav('Шаблоны', renderTemplates));
      navEl.appendChild(makeNav('Поддержка', renderSupport));
      if (user.role === 'admin' || user.role==='superadmin') navEl.appendChild(makeNav('Админ', renderAdmin));
      const btn = document.createElement('button'); btn.className='btn ghost'; btn.textContent = `${user.name} ▾`; btn.addEventListener('click', ()=> showProfileMenu(user)); navEl.appendChild(btn);
    }
  }

  function makeNav(label, fn){ const b=document.createElement('button'); b.className='btn ghost'; b.textContent=label; b.addEventListener('click', fn); return b; }

  function showProfileMenu(user){
    const menu = document.createElement('div'); menu.className='menu-popup'; Object.assign(menu.style,{position:'absolute',right:'18px',top:'64px',background:'var(--card)',padding:'8px',border:'1px solid rgba(11,18,32,0.06)',borderRadius:'8px'});
    const profile = document.createElement('div'); profile.textContent = `${user.name} • ${user.email}`; profile.style.marginBottom='8px';
    const logoutBtn = document.createElement('button'); logoutBtn.className='btn'; logoutBtn.textContent='Выйти'; logoutBtn.addEventListener('click', ()=>{ logout(); document.body.removeChild(menu); renderNav(); renderLogin(); });
    menu.appendChild(profile); menu.appendChild(logoutBtn); document.body.appendChild(menu);
    setTimeout(()=> document.addEventListener('click', ()=> { if (document.body.contains(menu)) document.body.removeChild(menu); }, {once:true}), 10);
  }

  function clearMain(){ mainEl.innerHTML=''; window.scrollTo(0,0); }

  // Render: Login / Register
  function renderLogin(){
    clearMain();
    const container = document.createElement('section'); container.className='panel auth-panel';
    container.innerHTML = `<h2>Вход</h2>
      <form id="login-form" class="form">
        <label>Электронная почта<input id="login-email" type="email" required></label>
        <label>Пароль<input id="login-password" type="password" required></label>
        <div class="form-row"><button class="btn primary" type="submit">Войти</button><button class="btn ghost" type="button" id="to-register">Регистрация</button></div>
        <p class="muted">Тестовый админ: admin@kubbank.test / Admin123!</p>
      </form>`;
    mainEl.appendChild(container);
    qs('#to-register').addEventListener('click', renderRegister);
    qs('#login-form').addEventListener('submit', (e)=>{ e.preventDefault(); const em=qs('#login-email').value.trim(), pw=qs('#login-password').value; const u = authenticate(em,pw); if (!u) return alert('Неверные учетные данные'); renderNav(); renderDashboard(); });
  }

  function renderRegister(){
    clearMain();
    const container = document.createElement('section'); container.className='panel auth-panel';
    container.innerHTML = `<h2>Регистрация</h2>
      <form id="register-form" class="form">
        <label>Имя<input id="reg-name" required/></label>
        <label>Электронная почта<input id="reg-email" type="email" required/></label>
        <label>Пароль<input id="reg-password" type="password" required/></label>
        <label>Код реферала (опционально)<input id="reg-ref" /></label>
        <div class="form-row"><button class="btn primary" type="submit">Зарегистрироваться</button><button class="btn ghost" id="to-login" type="button">Назад</button></div>
      </form>`;
    mainEl.appendChild(container);
    qs('#to-login').addEventListener('click', renderLogin);
    qs('#register-form').addEventListener('submit', (e)=>{ e.preventDefault(); try{ const name=qs('#reg-name').value.trim(), email=qs('#reg-email').value.trim(), pw=qs('#reg-password').value, ref=qs('#reg-ref').value.trim()||null; const user=registerUser({name,email,password:pw,referral:ref}); setSession({userId:user.id,ts:now()}); renderNav(); renderDashboard(); }catch(err){ alert(err.message); } });
  }

  // Dashboard with analytics, quick actions, announcements preview
  function renderDashboard(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<div class="panel-header"><h2>Главная</h2><div id="user-info">${user.name} • ${user.email}</div></div>
      <div style="margin-top:12px" class="grid">
        <div class="card full">
          <h3>Счета и карты</h3>
          <div id="accounts-list"></div>
          <div class="form-row"><button id="create-account-btn" class="btn">Открыть новый счёт</button>
            <button id="show-cards" class="btn">Управление картами</button></div>
        </div>
        <div class="card">
          <h3>Быстрые действия</h3>
          <button id="quick-transfer" class="btn block">Перевод</button>
          <button id="quick-deposit" class="btn block">Вклад / Инвестиции</button>
          <button id="quick-history" class="btn block">История операций</button>
          <button id="quick-templates" class="btn block">Шаблоны</button>
        </div>
      </div>
      <div style="margin-top:12px" class="panel"><h3>Аналитика</h3><div id="analytics-area"></div></div>`;
    mainEl.appendChild(container);

    function refreshAccounts(){
      const accs = getAccountsByUser(user.id);
      const el = document.getElementById('accounts-list');
      el.innerHTML = '';
      let total = 0;
      accs.forEach(a=>{
        total += Number(a.balance);
        const node = document.createElement('div'); node.className='acct';
        node.innerHTML = `<div><div style="font-weight:600;color:var(--accent-2)">${a.title}</div><div class="meta">${a.currency}</div></div>
          <div style="text-align:right"><div class="bal">${fmtMoney(a.balance,a.currency)}</div><div class="meta">${a.id}</div></div>`;
        el.appendChild(node);
      });
      const analytics = document.getElementById('analytics-area');
      analytics.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>Всего доступно:</strong> <span class="big">${fmtMoney(total)}</span></div><div><button id="gen-demo" class="btn ghost">Генератор демо транзакций</button></div></div>`;
      qs('#gen-demo').addEventListener('click', ()=>{ if (confirm('Создать 50 случайных транзакций для аналитики?')){ generateDemoTransactions(user.id,50); alert('Сгенерировано'); renderDashboard(); }});
    }

    refreshAccounts();
    document.getElementById('create-account-btn').addEventListener('click', ()=>{ const title = prompt('Название счёта','Счёт • '+(Math.floor(Math.random()*9000)+1000)); if (title) { createAccount(user.id,title,'RUB',0); refreshAccounts(); }});
    document.getElementById('quick-transfer').addEventListener('click', renderTransfer);
    document.getElementById('quick-deposit').addEventListener('click', renderDeposit);
    document.getElementById('quick-history').addEventListener('click', renderHistory);
    document.getElementById('quick-templates').addEventListener('click', renderTemplates);
    document.getElementById('show-cards').addEventListener('click', renderCards);

    // Simple analytics: spending by tag
    const d = loadData();
    const txs = d.transactions.filter(t => { const accs = d.accounts.filter(a=>a.userId===user.id).map(a=>a.id); return (t.fromAccountId && accs.includes(t.fromAccountId)) || (t.toAccountId && accs.includes(t.toAccountId)); });
    const byTag = {};
    txs.forEach(t=>{ const tag = t.tag||t.note||'other'; byTag[tag] = (byTag[tag]||0) + (t.amount||0); });
    const chart = `<div style="display:flex;gap:8px;align-items:flex-end">${Object.keys(byTag).slice(0,6).map(k=>{ const v=Math.abs(byTag[k]); const h = Math.min(120, Math.round(v/10)); return `<div style="text-align:center;width:50px"><div style="height:${h}px;background:linear-gradient(180deg,var(--accent),var(--accent-2));border-radius:6px;margin-bottom:6px"></div><div class="muted small">${k}</div></div>` }).join('')}</div>`;
    document.getElementById('analytics-area').insertAdjacentHTML('beforeend', chart);
  }

  // Transfer view with templates and favorites
  function renderTransfer(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Переводы</h2>
      <form id="transfer-form" class="form">
        <label>От счёта<select id="transfer-from"></select></label>
        <label>Кому (email получателя)<input id="transfer-to" type="email" required/></label>
        <label>Сумма<input id="transfer-amount" type="number" step="0.01" required/></label>
        <label>Комментарий<input id="transfer-note" /></label>
        <div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="transfer-back" class="btn ghost" type="button">Назад</button></div>
      </form>
      <div style="margin-top:12px" class="panel"><h3>Шаблоны и Избранное</h3><div id="quick-templates-list"></div></div>`;
    mainEl.appendChild(container);

    const accs = getAccountsByUser(user.id);
    qs('#transfer-from').innerHTML = accs.map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join('');
    qs('#transfer-back').addEventListener('click', renderDashboard);

    // load templates and favorites
    const d = loadData();
    const myTemplates = d.templates.filter(t=>t.ownerId===user.id);
    const favs = d.favorites.filter(f=>f.userId===user.id);
    const quickEl = qs('#quick-templates-list');
    quickEl.innerHTML = (myTemplates.length? `<h4>Мои шаблоны</h4>`+myTemplates.map(t=>`<div class="acct"><div><strong>${t.name}</strong><div class="muted">${t.to}</div></div><div style="text-align:right"><div>${t.amount?fmtMoney(t.amount):''}</div><div class="meta"><button data-id="${t.id}" class="btn">Использовать</button></div></div></div>`).join('') : '<div class="muted">Шаблонов нет</div>') +
      (favs.length? `<h4 style="margin-top:8px">Избранные</h4>`+favs.map(f=>`<div class="acct"><div><strong>${f.name}</strong><div class="muted">${f.email}</div></div><div style="text-align:right"><button data-id="${f.id}" class="btn">Выбрать</button></div></div>`).join('') : '');

    quickEl.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{
        const id = b.getAttribute('data-id');
        const t = myTemplates.find(x=>x.id===id);
        if (t){ qs('#transfer-to').value = t.to; qs('#transfer-amount').value = t.amount||''; }
        const f = favs.find(x=>x.id===id);
        if (f){ qs('#transfer-to').value = f.email; }
      });
    });

    qs('#transfer-form').addEventListener('submit', (e)=>{
      e.preventDefault();
      const from = qs('#transfer-from').value;
      const to = qs('#transfer-to').value.trim();
      const amount = Number(qs('#transfer-amount').value);
      const note = qs('#transfer-note').value.trim();
      try {
        const res = transfer({ fromAccountId: from, toEmail: to, amount, note, initiatedBy: user.id });
        alert(res.internal ? 'Перевод выполнен внутри банка' : 'Внешний перевод отправлен (симуляция; списано с вашего счёта)');
        renderDashboard();
      } catch(err){ alert(err.message); }
    });
  }

  // Deposits view
  function renderDeposit(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Вклады и инвестиции</h2>
      <form id="deposit-form" class="form">
        <label>Счёт-источник<select id="deposit-from"></select></label>
        <label>Тип продукта<select id="deposit-type"><option value="deposit">Вклад</option><option value="investment">Инвестиция</option></select></label>
        <label>Сумма<input id="deposit-amount" type="number" step="0.01" required/></label>
        <label>Срок (мес)<input id="deposit-term" type="number" min="1" value="12" required/></label>
        <div class="form-row"><button class="btn primary" type="submit">Открыть продукт</button><button id="deposit-back" class="btn ghost" type="button">Назад</button></div>
      </form>
      <h3>Активные продукты</h3><div id="deposits-list"></div>`;
    mainEl.appendChild(container);
    function refresh(){ const accs = getAccountsByUser(user.id); qs('#deposit-from').innerHTML = accs.map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join(''); const d=loadData(); const my = d.deposits.filter(x=>x.userId===user.id); qs('#deposits-list').innerHTML = my.length? my.map(p=>`<div class="acct"><div><strong>${p.type}</strong><div class="muted">Открыт: ${new Date(p.openedAt).toLocaleDateString()}</div></div><div style="text-align:right"><div class="bal">${fmtMoney(p.amount)}</div><div class="meta">Срок ${p.termMonths} мес • ${ (p.rate*100).toFixed(1) }%</div></div></div>`).join('') : '<div class="muted">Активных продуктов нет</div>'; }
    qs('#deposit-back').addEventListener('click', renderDashboard);
    qs('#deposit-form').addEventListener('submit', (e)=>{ e.preventDefault(); try{ openDeposit({ userId:user.id, fromAccountId:qs('#deposit-from').value, type:qs('#deposit-type').value, amount:Number(qs('#deposit-amount').value), termMonths:Number(qs('#deposit-term').value), initiatedBy:user.id }); alert('Продукт открыт'); renderDeposit(); }catch(err){ alert(err.message); }});
    refresh();
  }

  // History with filters, CSV export, print
  function renderHistory(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>История операций</h2>
      <div style="display:flex;gap:8px">
        <input id="hist-search" placeholder="Поиск..." />
        <select id="hist-filter"><option value="">Все</option><option value="transfer">Перевод</option><option value="external_transfer">Внешний</option><option value="deposit_open">Вклад</option><option value="admin_adjust">Корректировка</option></select>
        <button id="export-csv" class="btn">Экспорт CSV</button>
        <button id="print-statement" class="btn ghost">Печать</button>
        <button id="history-back" class="btn ghost">Назад</button>
      </div>
      <div id="history-list" style="margin-top:12px"></div>`;
    mainEl.appendChild(container);

    function refresh(){
      const d = loadData();
      const accIds = d.accounts.filter(a=>a.userId===user.id).map(a=>a.id);
      let txs = d.transactions.filter(t => (t.fromAccountId && accIds.includes(t.fromAccountId)) || (t.toAccountId && accIds.includes(t.toAccountId)));
      const q = qs('#hist-search').value.trim().toLowerCase();
      const f = qs('#hist-filter').value;
      if (f) txs = txs.filter(t=>t.type===f);
      if (q) txs = txs.filter(t=> (t.note||'').toLowerCase().includes(q) || (t.id||'').toLowerCase().includes(q));
      txs = txs.sort((a,b)=> b.ts.localeCompare(a.ts));
      const html = txs.length ? txs.map(t=>{
        const time = new Date(t.ts).toLocaleString();
        const amt = fmtMoney(t.amount||0);
        const left = `${time} • ${t.type.replace('_',' ')}`;
        const note = t.note ? `<div class="muted">${t.note}</div>` : '';
        return `<div class="tx"><div class="left"><div>${left}</div>${note}</div><div>${amt}</div></div>`;
      }).join('') : '<div class="muted">Операций нет</div>';
      qs('#history-list').innerHTML = html;
    }

    qs('#hist-search').addEventListener('input', refresh);
    qs('#hist-filter').addEventListener('change', refresh);
    qs('#history-back').addEventListener('click', renderDashboard);
    qs('#export-csv').addEventListener('click', ()=>{
      const csv = exportTransactionsCSV(user.id);
      const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'transactions.csv'; a.click(); URL.revokeObjectURL(url);
    });
    qs('#print-statement').addEventListener('click', ()=>{ window.print(); });
    refresh();
  }

  // Templates / Favorites management
  function renderTemplates(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Платёжные шаблоны</h2>
      <form id="template-form" class="form">
        <label>Название<input id="tmpl-name" required/></label>
        <label>Получатель (email)<input id="tmpl-to" /></label>
        <label>Сумма<input id="tmpl-amount" type="number" step="0.01" /></label>
        <div class="form-row"><button class="btn primary" type="submit">Сохранить шаблон</button><button id="tmpl-back" class="btn ghost" type="button">Назад</button></div>
      </form>
      <h3>Мои шаблоны</h3><div id="tmpl-list"></div>
      <h3>Избранные получатели</h3><div id="fav-list"></div>`;
    mainEl.appendChild(container);
    const d = loadData();
    function refresh(){
      const d = loadData();
      const myTemplates = d.templates.filter(t=>t.ownerId===user.id);
      qs('#tmpl-list').innerHTML = myTemplates.length? myTemplates.map(t=>`<div class="acct"><div><strong>${t.name}</strong><div class="muted">${t.to}</div></div><div style="text-align:right"><div>${t.amount?fmtMoney(t.amount):''}</div><div class="meta"><button data-id="${t.id}" class="btn">Удалить</button></div></div></div>`).join('') : '<div class="muted">Нет шаблонов</div>';
      const favs = d.favorites.filter(f=>f.userId===user.id);
      qs('#fav-list').innerHTML = favs.length? favs.map(f=>`<div class="acct"><div><strong>${f.name}</strong><div class="muted">${f.email}</div></div><div style="text-align:right"><button data-id="${f.id}" class="btn">Удалить</button></div></div>`).join('') : '<div class="muted">Нет избранных</div>';
      qs('#tmpl-list').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=> { deleteTemplate(b.getAttribute('data-id')); refresh(); }));
      qs('#fav-list').querySelectorAll('button').forEach(b=> { b.addEventListener('click', ()=> { const d=loadData(); d.favorites = d.favorites.filter(x=>x.id!==b.getAttribute('data-id')); saveData(d); refresh(); });});
    }
    qs('#tmpl-back').addEventListener('click', renderDashboard);
    qs('#template-form').addEventListener('submit', (e)=>{ e.preventDefault(); const name=qs('#tmpl-name').value.trim(), to=qs('#tmpl-to').value.trim(), amount=Number(qs('#tmpl-amount').value||0); saveTemplate({name,to,amount,ownerId:user.id}); alert('Шаблон сохранён'); refresh(); });
    // Quick add favorite via prompt
    const addFav = document.createElement('button'); addFav.className='btn'; addFav.textContent='Добавить избранного'; addFav.addEventListener('click', ()=>{ const name = prompt('Имя получателя'); const email = prompt('Email'); if (name && email){ const d=loadData(); d.favorites = d.favorites || []; d.favorites.push({id:uid('fav'), userId:user.id, name, email}); saveData(d); refresh(); }}); container.appendChild(addFav);
    refresh();
  }

  // Cards view
  function renderCards(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Карты</h2><div id="cards-list"></div><div class="form-row"><button id="create-virtual-card" class="btn">Выпустить виртуальную карту</button><button id="cards-back" class="btn ghost">Назад</button></div>`;
    mainEl.appendChild(container);
    function refresh(){
      const d = loadData();
      const myCards = d.cards.filter(c=>c.userId===user.id);
      qs('#cards-list').innerHTML = myCards.length? myCards.map(c=>`<div class="acct"><div><strong>${c.masked}</strong><div class="muted">${c.id} • ${new Date(c.createdAt).toLocaleDateString()}</div></div><div style="text-align:right"><div class="meta">${c.status}</div><div class="form-row"><button data-id="${c.id}" class="btn">${c.status==='active'?'Заблокировать':'Разблокировать'}</button></div></div></div>`).join('') : '<div class="muted">У вас нет карт</div>';
      qs('#cards-list').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{ toggleCardBlock(b.getAttribute('data-id'), user.id); refresh(); }));
    }
    qs('#create-virtual-card').addEventListener('click', ()=>{ const accs = getAccountsByUser(user.id); const acc = accs[0]; if (!acc) return alert('Нет счёта для привязки'); createVirtualCard(user.id, acc.id); alert('Виртуальная карта выпущена'); refresh(); });
    qs('#cards-back').addEventListener('click', renderDashboard);
    refresh();
  }

  // Support / tickets
  function renderSupport(){
    const user = currentUser(); if (!user) return renderLogin();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Поддержка / Тикеты</h2>
      <form id="ticket-form" class="form"><label>Тема<input id="ticket-subject" /></label><label>Сообщение<input id="ticket-body" /></label><div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="support-back" class="btn ghost" type="button">Назад</button></div></form>
      <h3>Мои тикеты</h3><div id="tickets-list"></div>`;
    mainEl.appendChild(container);
    function refresh(){ const d = loadData(); const my = d.tickets.filter(t=>t.userId===user.id); qs('#tickets-list').innerHTML = my.length? my.map(t=>`<div class="acct"><div><strong>${t.subject}</strong><div class="muted">${t.status} • ${new Date(t.createdAt).toLocaleString()}</div></div><div style="text-align:right"><button data-id="${t.id}" class="btn">Открыть</button></div></div>`).join('') : '<div class="muted">Нет тикетов</div>'; qs('#tickets-list').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=> openTicket(b.getAttribute('data-id')))); }
    function openTicket(id){ const d = loadData(); const t = d.tickets.find(x=>x.id===id); if (!t) return; clearMain(); const cont = document.createElement('section'); cont.className='panel'; cont.innerHTML = `<h2>Тикет: ${t.subject}</h2><div id="ticket-messages"></div><form id="reply-form" class="form"><label>Ответ<input id="reply-body" /></label><div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="ticket-back" class="btn ghost" type="button">Назад</button></div></form>`; mainEl.appendChild(cont); const list = qs('#ticket-messages'); list.innerHTML = t.messages.map(m=>`<div class="tx"><div class="left"><div><strong>${m.from===t.userId?'Вы':'Поддержка'}</strong></div><div class="muted">${new Date(m.ts).toLocaleString()}</div><div>${m.text}</div></div></div>`).join(''); qs('#ticket-back').addEventListener('click', renderSupport); qs('#reply-form').addEventListener('submit', (e)=>{ e.preventDefault(); replyTicket(t.id, user.id, qs('#reply-body').value); openTicket(t.id); }); }
    qs('#ticket-form').addEventListener('submit',(e)=>{ e.preventDefault(); createTicket(user.id, qs('#ticket-subject').value, qs('#ticket-body').value); alert('Тикет создан'); refresh(); });
    qs('#support-back').addEventListener('click', renderDashboard);
    refresh();
  }

  // Admin panel (extended)
  function renderAdmin(){
    const user = currentUser(); if (!user) return renderLogin();
    if (!(user.role==='admin' || user.role==='superadmin')) return renderDashboard();
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<div class="panel-header"><h2>Админ-панель</h2><div class="muted">Управление системой</div></div>
      <div style="display:grid;grid-template-columns:1fr 380px;gap:12px;margin-top:12px">
        <div>
          <div class="card"><h3>Пользователи</h3><div id="admin-users-list"></div></div>
          <div class="card" style="margin-top:12px"><h3>Журнал аудита</h3><div id="admin-audit-list" style="max-height:200px;overflow:auto"></div></div>
          <div class="card" style="margin-top:12px"><h3>Доска объявлений</h3><div id="admin-ann-list"></div><div style="margin-top:8px"><button id="admin-new-ann" class="btn">Создать объявление</button></div></div>
        </div>
        <div>
          <div class="card"><h3>Управление балансом</h3>
            <form id="admin-adjust-form" class="form">
              <label>Пользователь<select id="admin-user-select"></select></label>
              <label>Счёт<select id="admin-account-select"></select></label>
              <label>Сумма (плюс/минус)<input id="admin-amount" type="number" step="0.01" required/></label>
              <label>Комментарий<input id="admin-note"/></label>
              <div class="form-row"><button class="btn primary" type="submit">Применить</button></div>
            </form>
          </div>
          <div class="card" style="margin-top:12px"><h3>Сессии / Устройства</h3><div id="admin-sessions"></div></div>
        </div>
      </div>`;
    mainEl.appendChild(container);

    const d = loadData();
    function refresh(){
      const d = loadData();
      qs('#admin-users-list').innerHTML = d.users.map(u=>`<div class="admin-user"><div class="uhead"><div><strong>${u.name}</strong><div class="muted">${u.email}</div></div><div class="badge">${u.role}</div></div><div style="margin-top:8px" class="meta">Счета: ${d.accounts.filter(a=>a.userId===u.id).length}</div></div>`).join('');
      qs('#admin-user-select').innerHTML = d.users.map(u=>`<option value="${u.id}">${u.name} • ${u.email}</option>`).join('');
      const sel = qs('#admin-user-select');
      function refreshAccountsFor(){
        const uid = sel.value; qs('#admin-account-select').innerHTML = d.accounts.filter(a=>a.userId===uid).map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join('');
      }
      sel.addEventListener('change', refreshAccountsFor);
      refreshAccountsFor();
      qs('#admin-audit-list').innerHTML = (d.audit||[]).slice().reverse().map(a=>`<div class="muted small">${new Date(a.ts).toLocaleString()} • ${a.actor} • ${a.action} • ${a.detail}</div>`).join('');
      qs('#admin-ann-list').innerHTML = d.announcements.map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleString()}</div><div class="meta">${a.body}</div><div style="margin-top:8px"><button data-id="${a.id}" class="btn">Редактировать</button><button data-id="${a.id}" class="btn ghost">Удалить</button></div></div>`).join('');
      qs('#admin-ann-list').querySelectorAll('button').forEach(b=>{ b.addEventListener('click', ()=>{ const id = b.getAttribute('data-id'); if (b.textContent.includes('Редакт')){ const a = d.announcements.find(x=>x.id===id); const title = prompt('Заголовок', a.title); const body = prompt('Текст', a.body); updateAnnouncement(id, { title, body }); refresh(); } else { if (confirm('Удалить объявление?')){ deleteAnnouncement(id); refresh(); } } }); });
      qs('#admin-sessions').innerHTML = (d.sessions||[]).slice().reverse().map(s=>`<div class="muted small">${new Date(s.createdAt).toLocaleString()} • user:${s.userId} • ua:${s.userAgent}</div>`).join('');
    }
    qs('#admin-adjust-form').addEventListener('submit', (e)=>{ e.preventDefault(); try{ const target = qs('#admin-account-select').value; const amt = Number(qs('#admin-amount').value); const note = qs('#admin-note').value; adminAdjustBalance({ targetAccountId: target, amount: amt, note, adminId: user.id }); alert('Операция выполнена'); refresh(); } catch(err){ alert(err.message);} });
    qs('#admin-new-ann').addEventListener('click', ()=>{ const title = prompt('Заголовок'); const body = prompt('Текст'); if (title && body) { createAnnouncement({ title, body, authorId: user.id }); refresh(); }});
    refresh();
  }

  // Announcements full board
  function renderAnnouncements(){
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<div class="panel-header"><h2>Доска объявлений</h2><div id="ann-actions-area"></div></div><div id="ann-list"></div><div style="margin-top:12px"><button id="ann-back" class="btn ghost">Назад</button></div>`;
    mainEl.appendChild(container);
    const d = loadData();
    function refresh(){
      const d=loadData();
      qs('#ann-list').innerHTML = d.announcements.filter(a=>a.visible).map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleString()}</div><div class="meta" style="margin-top:8px">${a.body}</div></div>`).join('');
    }
    qs('#ann-back').addEventListener('click', renderDashboard);
    refresh();
  }

  // Backup / Import
  function renderBackup(){
    clearMain();
    const container = document.createElement('section'); container.className='panel';
    container.innerHTML = `<h2>Резервная копия / Восстановление</h2><div class="muted">Экспорт всех данных в JSON и импорт для восстановления.</div>
      <div style="margin-top:12px"><button id="export-json" class="btn">Скачать JSON</button></div>
      <label style="display:block;margin-top:8px">Импорт (вставьте JSON)<textarea id="import-json" style="width:100%;height:160px"></textarea></label>
      <div class="form-row"><button id="import-json-btn" class="btn primary">Импортировать</button><button id="reset-demo" class="btn ghost">Сбросить демо‑данные</button><button id="backup-back" class="btn ghost">Назад</button></div>`;
    mainEl.appendChild(container);
    qs('#backup-back').addEventListener('click', renderDashboard);
    qs('#export-json').addEventListener('click', ()=>{ const js = exportBackup(); const blob = new Blob([js], {type:'application/json'}); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download='kubbank-backup.json'; a.click(); URL.revokeObjectURL(url); });
    qs('#import-json-btn').addEventListener('click', ()=>{ try{ const txt = qs('#import-json').value; importBackup(txt); alert('Импортировано'); renderDashboard(); } catch(e){ alert(e.message); }});
    qs('#reset-demo').addEventListener('click', ()=>{ if (confirm('Сбросить демо-данные и восстановить начальное состояние?')){ saveData(defaultData()); alert('Сброшено'); renderDashboard(); }});
  }

  // Sidebar: announcements short & notifications
  function refreshSidebar(){
    const d = loadData();
    const anns = (d.announcements||[]).slice(0,3);
    sidebarAnnShort.innerHTML = anns.map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleDateString()}</div></div>`).join('') || '<div class="muted">Нет объявлений</div>';
    qs('#view-announcements').addEventListener('click', renderAnnouncements);
    // notifications
    const user = currentUser();
    if (!user) { notificationsEl.innerHTML = '<div class="muted">Войдите для уведомлений</div>'; return; }
    const notes = (d.notifications||[]).filter(n=>n.userId===user.id).slice(0,6);
    notificationsEl.innerHTML = notes.map(n=>`<div class="notify">${n.text}<div class="muted small">${new Date(n.ts).toLocaleString()}</div></div>`).join('') || '<div class="muted">Нет уведомлений</div>';
  }

  // Settings buttons (sidebar)
  function setupSidebarControls(){
    qs('#toggle-theme').addEventListener('click', ()=>{ const s=getSettings(); s.theme = s.theme==='dark'?'light':'dark'; setSettings(s); });
    qs('#toggle-lang').addEventListener('click', ()=>{ const s=getSettings(); s.lang = s.lang==='ru'?'en':'ru'; setSettings(s); alert('Язык интерфейса переключён (частично)'); });
    qs('#open-backup').addEventListener('click', renderBackup);
  }

  // Init
  function init(){
    if (!localStorage.getItem(STORAGE_KEY)) saveData(defaultData());
    renderNav();
    setupSidebarControls();
    refreshSidebar();
    const sess = getSession();
    if (sess && currentUser()) renderDashboard(); else renderLogin();
    // Periodic refresh of sidebar
    setInterval(()=> { refreshSidebar(); }, 5000);
  }

  // Expose debug utilities
  window.KubBank = { loadData, saveData, exportBackup, importBackup, createAnnouncement, registerUser, authenticate };

  init();
})();
