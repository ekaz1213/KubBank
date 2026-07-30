# КубБанк — Modern SPA (LocalStorage)

Это современный одностраничный SPA‑прототип цифрового банка «КубБанк», полностью статический и работающий в браузере. Все данные хранятся в `localStorage` — пользователи, счета, транзакции, объявления, шаблоны, карты, тикеты и т.д.

Важно
- Это демонстрационная статическая версия (без серверной части). Не используйте в продакшн для реальных денег.
- Пароли хранятся в явном виде в localStorage — это удобно для демонстраций, но небезопасно для продакшн.

Файлы
- index.html — основной HTML
- style.css — стили (современный строгий стиль, зелёная палитра)
- script.js — полная логика приложения (модель, UI, storage, backup, charts)
- (опционально) LICENSE — по желанию MIT

Предустановленные учётные записи
- Admin: admin@kubbank.test / K8b!nK_2026$Adm
- Demo user: user1@kubbank.test / User123!

Ключевые возможности (реализовано/интегрировано ≥100 улучшений)
- Регистрация / вход / сессии / просмотр и разрыв сессий
- Роли: user / admin / superadmin
- Полный профиль / KYC (загрузка файлов в localStorage)
- Мультивалютные счета, создание счетов, баланс
- Виртуальные карты: выпуск, masked PAN, блокировка
- Переводы внутри банка и внешние (симуляция)
- Платёжные шаблоны, избранные получатели, mass payments (CSV import demo)
- Повторяющиеся платежи (recurring) — сохраняются, можно запускать
- Вклады/инвестиции (открытие, калькулятор, закрытие)
- История транзакций: фильтры, поиск, категории/теги
- Экспорт/импорт транзакций CSV, экспорт/импорт полного backup JSON
- Printable statements (печать), PDF‑печаль via print
- Доска объявлений (announcements) — preview в сайдбаре, CRUD в админке
- Notifications (in‑app), простая очередь уведомлений
- Тикеты поддержки (создать, ответить), чатный поток
- Loyalty & referrals (баллы, referral codes)
- Простая аналитика: bar chart, donut chart (SVG), demo generator
- Темы (light/dark), частичная локализация RU/EN
- Админ‑панель: пользователи, сессии, аудит, баланс adjustments, announcements
- Backup / Restore, Reset demo, Demo data generator
- UI: современные кнопки, микровзаимодействия, responsive layout
- И многое мелкое: rate limit, consent, onboarding hints, saved reports и пр.

Как запустить
1. Скопируйте `index.html`, `style.css`, `script.js` в корень репозитория.
2. На GitHub: Settings → Pages → выберите ветку `main` и директорию `root` (или `docs`).
3. Подождите минуту — сайт будет доступен по URL GitHub Pages.

Как изменить админ‑пароль
- В браузерной консоли:
```js
(function(newPass){
  const key='kubbank_data_v3';
  const raw=localStorage.getItem(key);
  if(!raw) return console.warn('No data');
  const d=JSON.parse(raw);
  const admin=d.users.find(u=>u.email==='admin@kubbank.test');
  if(admin){ admin.password=newPass; localStorage.setItem(key, JSON.stringify(d)); console.log('Пароль обновлён'); }
})('YourNewStrongPass!');
