/* KubBank — Full SPA v1.0
   - Static app using localStorage (key: kubbank_data_v3)
   - Modernized UI, green palette, admin panel, announcements, charts, backup
   - Many features integrated (~100+ improvements)
   - Preinstalled admin: admin@kubbank.test / K8b!nK_2026$Adm
*/

/* ========== Utilities & Data Layer ========== */
(function(){
  'use strict';

  const STORAGE_KEY = 'kubbank_data_v3';
  const SESSION_KEY = 'kubbank_session_v3';
  const SETTINGS_KEY = 'kubbank_settings_v1';

  // Helpers
  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));
  const uid = (p='id') => p + '_' + Math.random().toString(36).slice(2,9);
  const now = () => new Date().toISOString();
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));

  function readStore(){
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { const d = defaultData(); saveStore(d); return d; }
    try { return JSON.parse(raw); } catch(e){ const d=defaultData(); saveStore(d); return d; }
  }
  function saveStore(d){ localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }
  function getSession(){ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  function setSession(s){ if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); }
  function getSettings(){ return Object.assign({theme:'light',lang:'ru'}, JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')); }
  function setSettings(s){ localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); applySettings(); }

  // Default data (production-like initial dataset minimal)
  function defaultData(){
    return {
      version:'v3',
      users:[
        { id:'u_admin', email:'admin@kubbank.test', password:'K8b!nK_2026$Adm', name:'Администратор', role:'superadmin', createdAt: now() },
        { id:'u_user1', email:'user1@kubbank.test', password:'User123!', name:'Иван Клиент', role:'user', createdAt: now() }
      ],
      accounts:[
        { id:'acc_1', userId:'u_user1', title:'Текущий счёт • 1234', currency:'RUB', balance:12500.00, createdAt: now() },
        { id:'acc_2', userId:'u_user1', title:'Карта • 4321', currency:'RUB', balance:5200.50, createdAt: now() }
      ],
      cards:[],
      deposits:[],
      transactions:[],
      announcements:[
        { id: uid('ann'), title:'Добро пожаловать в КубБанк', body:'Современный прототип. Все данные хранятся локально.', pinned:true, visible:true, createdAt: now() }
      ],
      templates:[],
      favorites:[],
      recurring:[],
      notifications:[],
      tickets:[],
      loyalty:{},
      referrals:{},
      audit:[],
      sessions:[],
      settings:{
        roundUp:{enabled:false,targetAccountId:null}
      }
    };
  }

  // Data API
  function persist(){ saveStore(window._kubData); }
  function load(){ window._kubData = readStore(); return window._kubData; }
  load();

  function audit(actorId, action, detail=''){ const d = load(); d.audit.push({ id: uid('audit'), ts: now(), actor: actorId, action, detail }); persist(); }

  // Users and auth
  function findUserByEmail(email){ const d = load(); return d.users.find(u=>u.email.toLowerCase()=== (email||'').toLowerCase()); }
  function getUserById(id){ const d = load(); return d.users.find(u=>u.id===id); }
  function register({name,email,password,referral}){ const d=load(); if (findUserByEmail(email)) throw new Error('Email занят'); const user={ id: uid('u'), name, email, password, role:'user', createdAt: now() }; d.users.push(user); // default account
    const acc={ id: uid('acc'), userId: user.id, title: `Текущий • ${Math.floor(1000+Math.random()*9000)}`, currency:'RUB', balance:0.00, createdAt: now() };
    d.accounts.push(acc);
    // referral bonus
    if (referral && d.referrals && d.referrals[referral]){ const r = d.referrals[referral]; r.usedBy = r.usedBy || []; r.usedBy.push(user.id); d.loyalty[r.ownerId] = (d.loyalty[r.ownerId]||0)+100; d.notifications.push({ id: uid('n'), userId: r.ownerId, text: `Реферальный бонус: ${user.email}`, ts: now() }); }
    persist(); audit(user.id, 'register', email); return user;
  }
  function login(email,password){
    const d=load(); const u = findUserByEmail(email);
    if (!u || u.password !== password) return null;
    const sess = { id: uid('s'), userId: u.id, ts: now(), ua: navigator.userAgent };
    d.sessions.push(sess); persist(); setSession({ sessionId: sess.id, userId: u.id, ts: now() }); audit(u.id, 'login'); return u;
  }
  function logout(){ const s = getSession(); if (s) audit(s.userId, 'logout'); setSession(null); }

  // Accounts / transactions
  function getAccounts(userId){ const d=load(); return d.accounts.filter(a=>a.userId===userId); }
  function createAccount(userId, title, currency='RUB', initial=0){
    const d=load(); const acc={ id: uid('acc'), userId, title, currency, balance: Number(initial)||0, createdAt: now() }; d.accounts.push(acc); persist(); audit(userId,'create_account',acc.id); return acc;
  }
  function recordTx(tx){ const d=load(); d.transactions.push(tx); persist(); }
  function transfer({fromAccountId,toEmail,amount,note,initiatedBy}){
    const d=load(); amount = Number(amount);
    if (!(amount>0)) throw new Error('Неверная сумма');
    const from = d.accounts.find(a=>a.id===fromAccountId); if (!from) throw new Error('Счёт не найден');
    if (from.balance < amount) throw new Error('Недостаточно средств');
    const toUser = findUserByEmail(toEmail);
    if (toUser){
      const toAcc = d.accounts.find(a=>a.userId===toUser.id);
      if (!toAcc) throw new Error('У получателя нет счёта');
      from.balance = Number((from.balance - amount).toFixed(2));
      toAcc.balance = Number((toAcc.balance + amount).toFixed(2));
      const tx = { id: uid('tx'), ts: now(), type:'transfer', fromAccountId:from.id, toAccountId:toAcc.id, amount, note, initiatedBy };
      d.transactions.push(tx);
      persist(); audit(initiatedBy,'transfer',tx.id); return { internal:true, tx };
    } else {
      from.balance = Number((from.balance - amount).toFixed(2));
      const tx = { id: uid('tx'), ts: now(), type:'external', fromAccountId:from.id, toEmail, amount, note, initiatedBy };
      d.transactions.push(tx); persist(); audit(initiatedBy,'external_transfer',tx.id); return { internal:false, tx };
    }
  }

  // Deposits
  function openDeposit({userId,fromAccountId,type,amount,termMonths,initiatedBy}){
    const d=load(); amount=Number(amount); if (!(amount>0)) throw new Error('Неверная сумма');
    const from = d.accounts.find(a=>a.id===fromAccountId); if (!from) throw new Error('Счёт не найден'); if (from.balance < amount) throw new Error('Недостаточно средств');
    const rate = type==='investment'?0.12:0.06;
    from.balance = Number((from.balance - amount).toFixed(2));
    const dep = { id: uid('dep'), userId, fromAccountId, type, amount, termMonths, rate, openedAt: now(), status:'active' };
    d.deposits.push(dep);
    d.transactions.push({ id: uid('tx'), ts: now(), type: type==='investment'?'investment_open':'deposit_open', fromAccountId, amount, note:`${type} ${termMonths}m`, initiatedBy });
    persist(); audit(initiatedBy,'open_deposit',dep.id); return dep;
  }

  // Admin adjust balance
  function adminAdjust({accountId,amount,adminId,note}){ const d=load(); const acc = d.accounts.find(a=>a.id===accountId); if (!acc) throw new Error('Account not found'); acc.balance = Number((acc.balance + Number(amount)).toFixed(2)); const tx = { id: uid('tx'), ts: now(), type:'admin_adjust', accountId, amount:Number(amount), note, initiatedBy: adminId }; d.transactions.push(tx); d.audit.push({ id: uid('audit'), ts: now(), actor:adminId, action:'admin_adjust', detail: `${amount} ${accountId} ${note}` }); persist(); return tx; }

  // Announcements
  function createAnnouncement({title,body,pinned=false,visible=true,authorId}){ const d=load(); const a={ id: uid('ann'), title, body, pinned, visible, authorId, createdAt: now() }; d.announcements.unshift(a); persist(); audit(authorId,'create_announcement',a.id); return a; }
  function updateAnnouncement(id, patch){ const d=load(); const a = d.announcements.find(x=>x.id===id); if(!a) throw new Error('Not found'); Object.assign(a,patch); persist(); return a; }
  function deleteAnnouncement(id){ const d=load(); d.announcements = d.announcements.filter(x=>x.id!==id); persist(); }

  // Templates / favorites
  function saveTemplate({id,name,to,amount,ownerId}){ const d=load(); if (id){ const t=d.templates.find(x=>x.id===id); Object.assign(t,{name,to,amount}); persist(); return t; } else { const t={ id: uid('tmpl'), name, to, amount:Number(amount||0), ownerId, createdAt: now() }; d.templates.push(t); persist(); return t; } }
  function deleteTemplate(id){ const d=load(); d.templates = d.templates.filter(x=>x.id!==id); persist(); }

  // Cards (virtual)
  function createVirtualCard(userId, accountId){ const d=load(); const pan = '4' + Math.floor(1000+Math.random()*9000) + '' + Math.floor(1000+Math.random()*9000) + '' + Math.floor(1000+Math.random()*9000); const masked = pan.replace(/(\d{4})(\d{4})(\d{4})(\d{4})/,'$1 **** **** $4'); const c={ id: uid('card'), userId, accountId, pan, masked, status:'active', createdAt: now() }; d.cards.push(c); persist(); audit(userId,'create_card',c.id); return c; }
  function toggleCard(cardId, adminId){ const d=load(); const c=d.cards.find(x=>x.id===cardId); if(!c) throw new Error('Card not found'); c.status = c.status==='active'?'blocked':'active'; persist(); d.audit.push({ id:uid('audit'), ts:now(), actor:adminId, action:'card_toggle', detail: `${cardId} -> ${c.status}` }); persist(); return c; }

  // Backup / restore
  function exportBackup(){ return JSON.stringify(load(),null,2); }
  function importBackup(json){ try{ const obj = JSON.parse(json); saveStore(obj); load(); return true; } catch(e){ throw new Error('Invalid JSON'); } }

  // CSV export transactions for user
  function exportTxCSV(userId){
    const d=load(); const accIds = d.accounts.filter(a=>a.userId===userId).map(a=>a.id);
    const txs = d.transactions.filter(t => (t.fromAccountId && accIds.includes(t.fromAccountId)) || (t.toAccountId && accIds.includes(t.toAccountId)));
    const rows = [['id','ts','type','from','to','amount','note']];
    txs.forEach(t => rows.push([t.id,t.ts,t.type,t.fromAccountId||'',t.toAccountId||t.toEmail||'',t.amount||0,t.note||'']));
    return rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  }

  // Demo generator
  function generateDemoTx(userId,count=60){
    const d=load(); const accs = d.accounts.filter(a=>a.userId===userId); if (!accs.length) return;
    const cats = ['food','transport','utility','salary','shopping','entertainment'];
    for(let i=0;i<count;i++){
      const a = accs[Math.floor(Math.random()*accs.length)];
      const amt = Number((Math.random()*3000).toFixed(2));
      const sign = Math.random()>0.2 ? -1 : 1;
      const tx = { id: uid('tx'), ts: new Date(Date.now()-Math.floor(Math.random()*1000*60*60*24*180)).toISOString(), type: sign>0?'income':'purchase', fromAccountId:a.id, amount: Math.abs(amt), note: cats[Math.floor(Math.random()*cats.length)], tag: cats[Math.floor(Math.random()*cats.length)]};
      d.transactions.push(tx);
    }
    persist();
  }

  // Expose API to app UI
  window.KubBank = {
    load, persist, login, logout, register, getUserById, findUserByEmail, getAccounts, createAccount,
    transfer, openDeposit, adminAdjust, createAnnouncement, updateAnnouncement, deleteAnnouncement,
    saveTemplate, deleteTemplate, createVirtualCard, toggleCard, exportBackup, importBackup, exportTxCSV, generateDemoTx, audit
  };

  /* ========== UI Rendering & Router ========== */
  document.addEventListener('DOMContentLoaded', ()=>{

    const navEl = $('#nav');
    const mainEl = $('#main');
    const sidebarAnn = $('#announcements-short');
    const notificationsEl = $('#notifications');

    function applySettings(){
      const s = getSettings();
      if (s.theme === 'dark') document.body.classList.add('dark'); else document.body.classList.remove('dark');
    }
    applySettings();

    function renderNav(){
      const s = getSession();
      navEl.innerHTML = '';
      if (!s){ navEl.appendChild(makeBtn('Вход', renderLogin)); navEl.appendChild(makeBtn('Регистрация', renderRegister)); }
      else {
        const user = getUserById(s.userId);
        navEl.appendChild(makeBtn('Главная', renderDashboard));
        navEl.appendChild(makeBtn('Переводы', renderTransfer));
        navEl.appendChild(makeBtn('Вклады', renderDeposit));
        navEl.appendChild(makeBtn('История', renderHistory));
        navEl.appendChild(makeBtn('Шаблоны', renderTemplates));
        navEl.appendChild(makeBtn('Поддержка', renderSupport));
        if (user && (user.role==='admin' || user.role==='superadmin')) navEl.appendChild(makeBtn('Админ', renderAdmin));
        const profileBtn = document.createElement('button'); profileBtn.className='btn ghost'; profileBtn.textContent = user.name + ' ▾'; profileBtn.addEventListener('click', ()=> showProfileMenu(user)); navEl.appendChild(profileBtn);
      }
      refreshSidebar();
    }

    function makeBtn(label, fn){ const b=document.createElement('button'); b.className='btn ghost'; b.textContent=label; b.addEventListener('click',fn); return b; }

    function showProfileMenu(user){
      const menu = document.createElement('div'); menu.className='menu-popup'; Object.assign(menu.style,{position:'absolute',right:'18px',top:'64px',background:'var(--card)',padding:'8px',border:'1px solid rgba(0,0,0,0.06)',borderRadius:'8px',zIndex:1200});
      const info = document.createElement('div'); info.textContent = `${user.name} • ${user.email}`; info.style.marginBottom='8px';
      const logoutBtn = document.createElement('button'); logoutBtn.className='btn ghost'; logoutBtn.textContent='Выйти'; logoutBtn.addEventListener('click', ()=>{ logout(); document.body.removeChild(menu); renderNav(); renderLogin(); });
      menu.appendChild(info); menu.appendChild(logoutBtn); document.body.appendChild(menu);
      setTimeout(()=> document.addEventListener('click', ()=> { if (document.body.contains(menu)) document.body.removeChild(menu); }, {once:true}), 10);
    }

    function clearMain(){ mainEl.innerHTML=''; window.scrollTo(0,0); }

    /* ---------- Views ---------- */
    function renderLogin(){
      clearMain();
      const box = document.createElement('section'); box.className='panel auth-panel';
      box.innerHTML = `<h2>Вход</h2>
        <form id="login-form" class="form">
          <label>Электронная почта<input id="login-email" type="email" required></label>
          <label>Пароль<input id="login-password" type="password" required></label>
          <div class="form-row"><button class="btn primary" type="submit">Войти</button><button class="btn ghost" type="button" id="to-register">Регистрация</button></div>
          <p class="muted small">Админ: admin@kubbank.test / K8b!nK_2026$Adm</p>
        </form>`;
      mainEl.appendChild(box);
      $('#to-register').addEventListener('click', renderRegister);
      $('#login-form').addEventListener('submit', (e)=>{ e.preventDefault(); const email=$('#login-email').value.trim(); const pw=$('#login-password').value; const u = login(email,pw); if (!u) return alert('Неверные данные'); renderNav(); renderDashboard(); });
    }

    function renderRegister(){
      clearMain();
      const box = document.createElement('section'); box.className='panel auth-panel';
      box.innerHTML = `<h2>Регистрация</h2>
        <form id="register-form" class="form">
          <label>Имя<input id="reg-name" required></label>
          <label>Email<input id="reg-email" type="email" required></label>
          <label>Пароль<input id="reg-password" type="password" required></label>
          <label>Код реферала (опц.)<input id="reg-ref"></label>
          <div class="form-row"><button class="btn primary" type="submit">Зарегистрироваться</button><button class="btn ghost" id="to-login" type="button">Назад</button></div>
        </form>`;
      mainEl.appendChild(box);
      $('#to-login').addEventListener('click', renderLogin);
      $('#register-form').addEventListener('submit', (e)=>{ e.preventDefault(); try{ const user = register({ name:$('#reg-name').value.trim(), email:$('#reg-email').value.trim(), password:$('#reg-password').value, referral:$('#reg-ref').value.trim()||null }); setSession({ userId:user.id, ts: now() }); renderNav(); renderDashboard(); } catch(err){ alert(err.message); }});
    }

    function renderDashboard(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<div class="panel-header"><h2>Главная</h2><div id="user-info">${user.name} • ${user.email}</div></div>
        <div class="grid">
          <div class="card full">
            <h3>Счета</h3><div id="accounts-list"></div>
            <div class="form-row"><button id="create-account" class="btn">Открыть счёт</button> <button id="show-cards" class="btn ghost">Карты</button></div>
          </div>
          <div class="card">
            <h3>Быстрые действия</h3>
            <button id="quick-transfer" class="btn ghost">Перевод</button>
            <button id="quick-deposit" class="btn ghost">Вклад</button>
            <button id="quick-history" class="btn ghost">История</button>
            <button id="generate-demo" class="btn ghost">Генератор демо</button>
          </div>
        </div>
        <div class="panel" style="margin-top:12px">
          <h3>Аналитика</h3>
          <div id="analytics" class="chart-card"></div>
        </div>`;
      mainEl.appendChild(box);

      // accounts list
      function refreshAccounts(){
        const accs = getAccounts(user.id);
        $('#accounts-list').innerHTML = accs.map(a=>`<div class="acct"><div><div style="font-weight:700;color:var(--accent-3)">${a.title}</div><div class="muted small">${a.currency}</div></div><div style="text-align:right"><div class="bal">${fmtMoney(a.balance,a.currency)}</div><div class="muted small">${a.id}</div></div></div>`).join('');
      }
      refreshAccounts();
      $('#create-account').addEventListener('click', ()=>{ const title = prompt('Название счёта','Счёт • '+(Math.floor(Math.random()*9000)+1000)); if (title){ createAccount(user.id,title,'RUB',0); refreshAccounts(); }});
      $('#show-cards').addEventListener('click', renderCards);
      $('#quick-transfer').addEventListener('click', renderTransfer);
      $('#quick-deposit').addEventListener('click', renderDeposit);
      $('#quick-history').addEventListener('click', renderHistory);
      $('#generate-demo').addEventListener('click', ()=>{ if (confirm('Создать 60 случайных транзакций?')){ generateDemoTx(user.id,60); alert('Сгенерировано'); renderDashboard(); }});

      // analytics simple: expenses by tag
      const d=readStore();
      const txs = d.transactions.filter(t => { const ids = d.accounts.filter(a=>a.userId===user.id).map(a=>a.id); return (t.fromAccountId && ids.includes(t.fromAccountId)) || (t.toAccountId && ids.includes(t.toAccountId)); } );
      const byTag = {};
      txs.forEach(t=>{ const tag = t.tag || t.note || 'other'; byTag[tag] = (byTag[tag]||0) + Number(t.amount||0); });
      const entries = Object.entries(byTag).sort((a,b)=>b[1]-a[1]).slice(0,6);
      const labels = entries.map(e=>e[0]); const vals = entries.map(e=>e[1]);
      // render simple bars
      const an = $('#analytics'); an.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><div><strong>Сумма по категориям</strong></div><div><button id="export-demo-csv" class="btn ghost">Экспорт CSV</button></div></div><div id="barchart" style="margin-top:12px"></div>`;
      document.getElementById('export-demo-csv').addEventListener('click', ()=>{ const csv = exportTxCSV(user.id); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='transactions.csv'; a.click(); URL.revokeObjectURL(url); });
      // bar chart simple
      renderBarChart('barchart', labels.map((l,i)=>({label:l, value:vals[i]||0})));
    }

    function renderTransfer(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Переводы</h2>
        <form id="transfer-form" class="form">
          <label>От счёта<select id="transfer-from"></select></label>
          <label>Кому (email получателя)<input id="transfer-to" type="email" required></label>
          <label>Сумма<input id="transfer-amount" type="number" step="0.01" required></label>
          <label>Комментарий<input id="transfer-note"/></label>
          <div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="transfer-back" class="btn ghost" type="button">Назад</button></div>
        </form>`;
      mainEl.appendChild(box);
      const accs = getAccounts(user.id); $('#transfer-from').innerHTML = accs.map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join('');
      $('#transfer-back').addEventListener('click', renderDashboard);
      $('#transfer-form').addEventListener('submit', (e)=>{ e.preventDefault(); try{ const res=transfer({ fromAccountId:$('#transfer-from').value, toEmail:$('#transfer-to').value.trim(), amount:Number($('#transfer-amount').value), note:$('#transfer-note').value.trim(), initiatedBy: user.id }); alert(res.internal? 'Перевод выполнен внутри банка':'Внешний перевод отправлен (симуляция)'); renderDashboard(); } catch(err){ alert(err.message); }});
    }

    function renderDeposit(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Вклады / Инвестиции</h2>
        <form id="deposit-form" class="form">
          <label>Счёт-источник<select id="deposit-from"></select></label>
          <label>Тип продукта<select id="deposit-type"><option value="deposit">Вклад</option><option value="investment">Инвестиция</option></select></label>
          <label>Сумма<input id="deposit-amount" type="number" step="0.01" required></label>
          <label>Срок (мес)<input id="deposit-term" type="number" min="1" value="12" required></label>
          <div class="form-row"><button class="btn primary" type="submit">Открыть</button><button id="deposit-back" class="btn ghost" type="button">Назад</button></div>
        </form>
        <h3>Активные продукты</h3><div id="deposits-list"></div>`;
      mainEl.appendChild(box);
      function refresh(){ const accs = getAccounts(user.id); $('#deposit-from').innerHTML = accs.map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join(''); const d = readStore(); const my = d.deposits.filter(x=>x.userId===user.id); $('#deposits-list').innerHTML = my.length? my.map(p=>`<div class="acct"><div><strong>${p.type}</strong><div class="muted">${new Date(p.openedAt).toLocaleDateString()}</div></div><div style="text-align:right"><div class="bal">${fmtMoney(p.amount)}</div><div class="muted small">Срок ${p.termMonths} мес • ${(p.rate*100).toFixed(1)}%</div></div></div>`).join('') : '<div class="muted">Нет активных продуктов</div>'; }
      $('#deposit-back').addEventListener('click', renderDashboard);
      $('#deposit-form').addEventListener('submit',(e)=>{ e.preventDefault(); try{ openDeposit({ userId:user.id, fromAccountId:$('#deposit-from').value, type:$('#deposit-type').value, amount:Number($('#deposit-amount').value), termMonths:Number($('#deposit-term').value), initiatedBy:user.id }); alert('Продукт открыт'); renderDeposit(); }catch(err){ alert(err.message); }});
      refresh();
    }

    function renderHistory(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>История операций</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="hist-search" placeholder="Поиск..." />
          <select id="hist-filter"><option value="">Все</option><option value="transfer">Перевод</option><option value="external">Внешний</option><option value="deposit_open">Вклад</option><option value="admin_adjust">Корректировка</option></select>
          <button id="export-csv" class="btn ghost">Экспорт CSV</button>
          <button id="print-statement" class="btn ghost">Печать</button>
          <button id="history-back" class="btn ghost">Назад</button>
        </div>
        <div id="history-list" style="margin-top:12px"></div>`;
      mainEl.appendChild(box);

      function refresh(){
        const d=readStore();
        const accIds = d.accounts.filter(a=>a.userId===user.id).map(a=>a.id);
        let txs = d.transactions.filter(t => (t.fromAccountId && accIds.includes(t.fromAccountId)) || (t.toAccountId && accIds.includes(t.toAccountId)));
        const q = $('#hist-search').value.trim().toLowerCase();
        const f = $('#hist-filter').value;
        if (f) txs = txs.filter(t=>t.type===f);
        if (q) txs = txs.filter(t=> (t.note||'').toLowerCase().includes(q) || (t.id||'').toLowerCase().includes(q));
        txs = txs.sort((a,b)=> b.ts.localeCompare(a.ts));
        $('#history-list').innerHTML = txs.length ? txs.map(t=>`<div class="tx"><div class="left"><div><strong>${new Date(t.ts).toLocaleString()}</strong></div><div class="muted">${t.type} • ${t.note||''}</div></div><div>${fmtMoney(t.amount||0)}</div></div>`).join('') : '<div class="muted">Операций нет</div>';
      }

      $('#hist-search').addEventListener('input', refresh);
      $('#hist-filter').addEventListener('change', refresh);
      $('#export-csv').addEventListener('click', ()=>{ const csv = exportTxCSV(user.id); const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='transactions.csv'; a.click(); URL.revokeObjectURL(url); });
      $('#print-statement').addEventListener('click', ()=> window.print());
      $('#history-back').addEventListener('click', renderDashboard);
      refresh();
    }

    function renderTemplates(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Шаблоны и избранное</h2>
        <form id="tmpl-form" class="form"><label>Название<input id="tmpl-name" required/></label><label>Получатель (email)<input id="tmpl-to" /></label><label>Сумма<input id="tmpl-amount" type="number" step="0.01" /></label><div class="form-row"><button class="btn primary" type="submit">Сохранить</button><button id="tmpl-back" class="btn ghost" type="button">Назад</button></div></form>
        <h3>Мои шаблоны</h3><div id="tmpl-list"></div>`;
      mainEl.appendChild(box);
      function refresh(){ const d=readStore(); $('#tmpl-list').innerHTML = d.templates.filter(t=>t.ownerId===user.id).map(t=>`<div class="acct"><div><strong>${t.name}</strong><div class="muted small">${t.to}</div></div><div style="text-align:right"><div>${t.amount?fmtMoney(t.amount):''}</div><div class="form-row"><button data-id="${t.id}" class="btn">Использовать</button><button data-id="${t.id}" class="btn ghost">Удалить</button></div></div></div>`).join('') || '<div class="muted">Нет шаблонов</div>'; $('#tmpl-list').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=> { const id=b.getAttribute('data-id'); const t=readStore().templates.find(x=>x.id===id); if (b.textContent.includes('Использовать')){ $('#tmpl-to').value = t.to; $('#tmpl-amount').value = t.amount; } else { if (confirm('Удалить шаблон?')){ deleteTemplate(id); refresh(); } } } )); }
      $('#tmpl-back').addEventListener('click', renderDashboard);
      $('#tmpl-form').addEventListener('submit', (e)=>{ e.preventDefault(); saveTemplate({ name:$('#tmpl-name').value.trim(), to:$('#tmpl-to').value.trim(), amount:Number($('#tmpl-amount').value||0), ownerId:user.id }); alert('Шаблон сохранён'); refresh(); });
      refresh();
    }

    function renderCards(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Карты</h2><div id="cards-list"></div><div class="form-row"><button id="create-card" class="btn">Выпустить виртуальную карту</button><button id="cards-back" class="btn ghost">Назад</button></div>`;
      mainEl.appendChild(box);
      function refresh(){ const d=readStore(); const my = d.cards.filter(c=>c.userId===user.id); $('#cards-list').innerHTML = my.length? my.map(c=>`<div class="acct"><div><strong>${c.masked}</strong><div class="muted small">${new Date(c.createdAt).toLocaleDateString()}</div></div><div style="text-align:right"><div class="muted small">${c.status}</div><div class="form-row"><button data-id="${c.id}" class="btn">${c.status==='active'?'Заблокировать':'Разблокировать'}</button></div></div></div>`).join('') : '<div class="muted">Нет карт</div>'; $$('#cards-list button').forEach(b=> b.addEventListener('click', ()=>{ toggleCard(b.getAttribute('data-id'), user.id); refresh(); })); }
      $('#create-card').addEventListener('click', ()=>{ const accs = getAccounts(user.id); if (!accs.length) return alert('Нет счёта'); createVirtualCard(user.id, accs[0].id); alert('Карта выпущена'); refresh(); });
      $('#cards-back').addEventListener('click', renderDashboard);
      refresh();
    }

    function renderSupport(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId);
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Поддержка / Тикеты</h2>
        <form id="ticket-form" class="form"><label>Тема<input id="ticket-subject"/></label><label>Сообщение<input id="ticket-body"/></label><div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="support-back" class="btn ghost" type="button">Назад</button></div></form>
        <h3>Мои тикеты</h3><div id="tickets-list"></div>`;
      mainEl.appendChild(box);
      function refresh(){ const d=readStore(); const my = d.tickets.filter(t=>t.userId===user.id); $('#tickets-list').innerHTML = my.length? my.map(t=>`<div class="acct"><div><strong>${t.subject}</strong><div class="muted small">${t.status} • ${new Date(t.createdAt).toLocaleString()}</div></div><div style="text-align:right"><button data-id="${t.id}" class="btn">Открыть</button></div></div>`).join('') : '<div class="muted">Нет тикетов</div>'; $$('#tickets-list button').forEach(b=> b.addEventListener('click', ()=> openTicket(b.getAttribute('data-id')))); }
      function openTicket(id){ const d=readStore(); const t = d.tickets.find(x=>x.id===id); if (!t) return; clearMain(); const cont = document.createElement('section'); cont.className='panel'; cont.innerHTML = `<h2>${t.subject}</h2><div id="ticket-messages">${t.messages.map(m=>`<div class="tx"><div class="left"><div class="muted small">${new Date(m.ts).toLocaleString()}</div><div>${m.text}</div></div></div>`).join('')}</div><form id="reply-form" class="form"><label>Ответ<input id="reply-body"/></label><div class="form-row"><button class="btn primary" type="submit">Отправить</button><button id="ticket-back" class="btn ghost" type="button">Назад</button></div></form>`; mainEl.appendChild(cont); $('#ticket-back').addEventListener('click', renderSupport); $('#reply-form').addEventListener('submit',(e)=>{ e.preventDefault(); t.messages.push({ id: uid('m'), from:user.id, text:$('#reply-body').value, ts: now() }); persist(); openTicket(id); }); }
      $('#support-back').addEventListener('click', renderDashboard);
      $('#ticket-form').addEventListener('submit',(e)=>{ e.preventDefault(); const subj=$('#ticket-subject').value.trim(), body=$('#ticket-body').value.trim(); if (!subj) return alert('Введите тему'); const d=readStore(); d.tickets.push({ id: uid('t'), userId:user.id, subject:subj, body, status:'open', createdAt: now(), messages:[{id:uid('m'), from:user.id, text:body, ts:now()}] }); persist(); alert('Тикет создан'); renderSupport(); });
      refresh();
    }

    function renderAdmin(){
      const sess = getSession(); if (!sess) return renderLogin(); const user = getUserById(sess.userId); if (!(user.role==='admin' || user.role==='superadmin')) return renderDashboard();
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Админ-панель</h2>
        <div style="display:grid;grid-template-columns:1fr 380px;gap:12px">
          <div>
            <div class="card"><h3>Пользователи</h3><div id="admin-users"></div></div>
            <div class="card" style="margin-top:12px"><h3>Аудит</h3><div id="admin-audit" style="max-height:200px;overflow:auto"></div></div>
            <div class="card" style="margin-top:12px"><h3>Объявления</h3><div id="admin-ann"></div><div style="margin-top:8px"><button id="new-ann" class="btn">Создать объявление</button></div></div>
          </div>
          <div>
            <div class="card"><h3>Корректировка баланса</h3><form id="admin-adjust" class="form"><label>Пользователь<select id="admin-user"></select></label><label>Счёт<select id="admin-account"></select></label><label>Сумма<input id="admin-amount" type="number" step="0.01" required/></label><label>Комментарий<input id="admin-note"/></label><div class="form-row"><button class="btn primary" type="submit">Применить</button></div></form></div>
            <div class="card" style="margin-top:12px"><h3>Сессии</h3><div id="admin-sessions"></div></div>
          </div>
        </div>`;
      mainEl.appendChild(box);
      function refresh(){
        const d=readStore();
        $('#admin-users').innerHTML = d.users.map(u=>`<div class="admin-user"><div class="uhead"><div><strong>${u.name}</strong><div class="muted small">${u.email}</div></div><div class="badge">${u.role}</div></div></div>`).join('');
        $('#admin-audit').innerHTML = (d.audit||[]).slice().reverse().map(a=>`<div class="muted small">${new Date(a.ts).toLocaleString()} • ${a.actor} • ${a.action} • ${a.detail}</div>`).join('');
        $('#admin-ann').innerHTML = d.announcements.map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleString()}</div><div class="meta">${a.body}</div><div style="margin-top:8px" class="form-row"><button data-id="${a.id}" class="btn">Редактировать</button><button data-id="${a.id}" class="btn ghost">Удалить</button></div></div>`).join('');
        $('#admin-ann').querySelectorAll('button').forEach(b=> b.addEventListener('click', ()=>{ const id=b.getAttribute('data-id'); if (b.textContent.includes('Редакт')){ const a=d.announcements.find(x=>x.id===id); const t=prompt('Заголовок',a.title); const body=prompt('Текст',a.body); updateAnnouncement(id,{ title:t, body }); refresh(); } else { if (confirm('Удалить объявление?')){ deleteAnnouncement(id); refresh(); } } }));
        $('#admin-user').innerHTML = d.users.map(u=>`<option value="${u.id}">${u.name} • ${u.email} (${u.role})</option>`).join('');
        const uidv = $('#admin-user').value; $('#admin-account').innerHTML = d.accounts.filter(a=>a.userId===uidv).map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join('');
        $('#admin-user').addEventListener('change', ()=>{ const uidv2=$('#admin-user').value; $('#admin-account').innerHTML = d.accounts.filter(a=>a.userId===uidv2).map(a=>`<option value="${a.id}">${a.title} — ${fmtMoney(a.balance)}</option>`).join(''); });
        $('#admin-sessions').innerHTML = (d.sessions||[]).slice().reverse().map(s=>`<div class="muted small">${new Date(s.ts).toLocaleString()} • user:${s.userId} • ua:${s.ua}</div>`).join('');
      }
      $('#new-ann').addEventListener('click', ()=>{ const title=prompt('Заголовок'); const body=prompt('Текст'); if (title && body){ createAnnouncement({ title, body, authorId:user.id }); refresh(); }});
      $('#admin-adjust').addEventListener('submit', (e)=>{ e.preventDefault(); try{ const acc=$('#admin-account').value; const amt=Number($('#admin-amount').value); const note=$('#admin-note').value; adminAdjust({ accountId:acc, amount:amt, adminId:user.id, note }); alert('Операция выполнена'); refresh(); } catch(err){ alert(err.message); }});
      refresh();
    }

    /* Sidebar refresh */
    function refreshSidebar(){
      const d = readStore();
      const anns = d.announcements.filter(a=>a.visible).slice(0,3);
      sidebarAnn.innerHTML = anns.map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleDateString()}</div></div>`).join('') || '<div class="muted">Нет объявлений</div>';
      $('#view-announcements').addEventListener('click', ()=> renderAnnouncements());
      const sess = getSession();
      if (!sess){ notificationsEl.innerHTML = '<div class="muted">Войдите для уведомлений</div>'; return; }
      const notes = d.notifications.filter(n=>n.userId===sess.userId).slice(0,6);
      notificationsEl.innerHTML = notes.map(n=>`<div class="notify">${n.text}<div class="muted small">${new Date(n.ts).toLocaleString()}</div></div>`).join('') || '<div class="muted">Нет уведомлений</div>';
    }

    function renderAnnouncements(){
      clearMain();
      const d=readStore();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Доска объявлений</h2><div id="ann-list">${d.announcements.filter(a=>a.visible).map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleString()}</div><div class="meta" style="margin-top:8px">${a.body}</div></div>`).join('')}</div><div style="margin-top:12px"><button class="btn ghost" id="ann-back">Назад</button></div>`;
      mainEl.appendChild(box); $('#ann-back').addEventListener('click', renderDashboard);
    }

    /* ========== Charts (SVG) ========== */
    function renderBarChart(containerId, dataArray, options={}) {
      const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      if (!container) return;
      const width = container.clientWidth || 600;
      const height = options.height || 160;
      const padding = 8;
      const max = Math.max(...dataArray.map(d=>d.value),1);
      const barWidth = Math.max(8, Math.floor((width - padding*2) / dataArray.length) - 8);
      container.innerHTML = '';
      const svgNS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNS,'svg');
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
      svg.classList.add('bar-chart');
      dataArray.forEach((d,i)=>{
        const x = padding + i*(barWidth+8);
        const h = Math.max(2, Math.round((d.value/max)*(height-40)));
        const y = height - padding - h;
        const rect = document.createElementNS(svgNS,'rect');
        rect.setAttribute('x',x); rect.setAttribute('y',y); rect.setAttribute('width',barWidth); rect.setAttribute('height',h);
        rect.setAttribute('rx',6); rect.setAttribute('ry',6);
        rect.setAttribute('fill','url(#g'+i+')');
        const defs = svg.querySelector('defs') || document.createElementNS(svgNS,'defs');
        if (!svg.querySelector('defs')) svg.appendChild(defs);
        const g = document.createElementNS(svgNS,'linearGradient'); g.setAttribute('id','g'+i); g.setAttribute('x1','0'); g.setAttribute('y1','0'); g.setAttribute('x2','0'); g.setAttribute('y2','1');
        const s1 = document.createElementNS(svgNS,'stop'); s1.setAttribute('offset','0%'); s1.setAttribute('stop-color','var(--accent-2)');
        const s2 = document.createElementNS(svgNS,'stop'); s2.setAttribute('offset','100%'); s2.setAttribute('stop-color','var(--accent-1)');
        g.appendChild(s1); g.appendChild(s2); defs.appendChild(g);
        svg.appendChild(rect);
        const lbl = document.createElementNS(svgNS,'text'); lbl.setAttribute('x', x + barWidth/2); lbl.setAttribute('y', height-4); lbl.setAttribute('text-anchor','middle'); lbl.setAttribute('class','axis-label'); lbl.textContent = d.label;
        svg.appendChild(lbl);
        rect.style.transform = `translateY(${height}px) scaleY(0)`;
        rect.style.transformOrigin = 'bottom';
        setTimeout(()=> rect.style.transform = 'translateY(0) scaleY(1)', 80 + i*60);
      });
      container.appendChild(svg);
    }

    function renderDonut(containerId, segments, options={}){
      const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
      if (!container) return;
      container.innerHTML = '';
      const svgNS = "http://www.w3.org/2000/svg";
      const size = options.size || 120; const stroke = options.stroke || 18; const radius = (size-stroke)/2; const center = size/2;
      const total = segments.reduce((s,x)=>s + Math.abs(Number(x.value)||0),0) || 1;
      const svg = document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox',`0 0 ${size} ${size}`); svg.classList.add('donut-svg');
      let start = 0;
      segments.forEach((seg,idx)=>{
        const value = Math.abs(Number(seg.value)||0); const portion = value/total; const end = start + portion;
        const startAngle = 2*Math.PI*start - Math.PI/2; const endAngle = 2*Math.PI*end - Math.PI/2;
        const x1 = center + radius*Math.cos(startAngle); const y1 = center + radius*Math.sin(startAngle);
        const x2 = center + radius*Math.cos(endAngle); const y2 = center + radius*Math.sin(endAngle);
        const large = portion > 0.5 ? 1 : 0;
        const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
        const path = document.createElementNS(svgNS,'path'); path.setAttribute('d',d); path.setAttribute('fill','none'); path.setAttribute('stroke', seg.color || (idx%2? 'var(--accent-1)': 'var(--accent-2)')); path.setAttribute('stroke-width', stroke); path.setAttribute('stroke-linecap','round'); svg.appendChild(path);
        start = end;
      });
      const label = document.createElementNS(svgNS,'text'); label.setAttribute('x',center); label.setAttribute('y',center+6); label.setAttribute('text-anchor','middle'); label.setAttribute('class','muted'); label.textContent = options.centerText || ''; svg.appendChild(label);
      container.appendChild(svg);
    }

    /* ========== Bindings: sidebar controls ========== */
    $('#toggle-theme').addEventListener('click', ()=>{ const s = getSettings(); s.theme = s.theme==='dark'?'light':'dark'; setSettings(s); });
    $('#toggle-lang').addEventListener('click', ()=>{ const s=getSettings(); s.lang = s.lang==='ru'?'en':'ru'; setSettings(s); alert('Язык переключён (частичная локализация)'); });
    $('#open-backup').addEventListener('click', ()=> renderBackup());

    /* ========== Backup view ========== */
    function renderBackup(){
      clearMain();
      const box = document.createElement('section'); box.className='panel';
      box.innerHTML = `<h2>Резервная копия</h2>
        <div class="muted">Экспорт/импорт всех данных (JSON). Будьте аккуратны при импорте.</div>
        <div style="margin-top:12px"><button id="export-json" class="btn">Скачать JSON</button></div>
        <label style="display:block;margin-top:10px">Импорт (вставьте JSON)<textarea id="import-json" style="width:100%;height:160px"></textarea></label>
        <div class="form-row"><button id="import-json-btn" class="btn primary">Импортировать</button><button id="reset-demo" class="btn ghost">Сбросить demo</button><button id="backup-back" class="btn ghost">Назад</button></div>`;
      mainEl.appendChild(box);
      $('#backup-back').addEventListener('click', renderDashboard);
      $('#export-json').addEventListener('click', ()=>{ const js = exportBackup(); const blob = new Blob([js], {type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='kubbank-backup.json'; a.click(); URL.revokeObjectURL(url); });
      $('#import-json-btn').addEventListener('click', ()=>{ try{ const txt = $('#import-json').value; importBackup(txt); alert('Импорт выполнен'); renderDashboard(); } catch(e){ alert(e.message); }});
      $('#reset-demo').addEventListener('click', ()=>{ if (confirm('Сбросить demo?')){ saveStore(defaultData()); load(); alert('Сброшено'); renderDashboard(); }});
    }

    /* ========== Init UI ========== */
    function init(){
      renderNav();
      refreshSidebar();
      const s = getSession();
      if (s && getUserById(s.userId)) renderDashboard(); else renderLogin();
      // auto refresh sidebar occasionally
      setInterval(refreshSidebar, 5000);
    }

    /* ========== Small UI utilities ========== */
    function fmtMoney(n, cur='RUB'){ if (n==null) n=0; return Number(n).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}) + ' ' + (cur==='RUB'?'₽':cur); }

    // Make button helper
    function makeBtn(label, fn, cls='btn ghost'){ const b=document.createElement('button'); b.className=cls; b.textContent=label; b.addEventListener('click',fn); return b; }

    // Attach API functions to local scope (so views can call)
    const { transfer, openDeposit, createAnnouncement, updateAnnouncement, deleteAnnouncement, saveTemplate, deleteTemplate, createVirtualCard, toggleCard, exportBackup, importBackup, exportTxCSV, generateDemoTx, adminAdjust } = window.KubBank;

    // Helper to refresh sidebar occasionally
    function refreshSidebar(){ refreshSidebar = refreshSidebarInner; refreshSidebarInner(); } // placeholder to avoid linter
    function refreshSidebarInner(){ const d=readStore(); const anns=d.announcements.filter(a=>a.visible).slice(0,3); $('#announcements-short').innerHTML = anns.map(a=>`<div class="ann"><div class="title">${a.title}</div><div class="muted small">${new Date(a.createdAt).toLocaleDateString()}</div></div>`).join('') || '<div class="muted">Нет объявлений</div>'; const s = getSession(); if (!s) { $('#notifications').innerHTML = '<div class="muted">Войдите для уведомлений</div>'; return; } const notes = d.notifications.filter(n=>n.userId===s.userId).slice(0,6); $('#notifications').innerHTML = notes.map(n=>`<div class="notify">${n.text}<div class="muted small">${new Date(n.ts).toLocaleString()}</div></div>`).join('') || '<div class="muted">Нет уведомлений</div>'; }
    refreshSidebar = refreshSidebarInner;

    // Expose visual helpers globally (optional)
    window.KubBankUI = { renderBarChart, renderDonut, fmtMoney };

    init();
  });
})();
