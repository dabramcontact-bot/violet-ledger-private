# Violet Ledger Private

Приватный многопользовательский реестр запросов китайским агентам. Интерфейс публикуется через GitHub Pages, а авторизация, общая база и права пользователей работают через Supabase.

## Что защищено

- Незарегистрированный пользователь не получает рабочие данные.
- Регистрация разрешается только для email, заранее добавленных администратором.
- Роли: `admin`, `editor`, `viewer`.
- Таблицы защищены Row Level Security (RLS).
- В браузере используется только безопасный publishable key. `service_role`, secret key и пароль базы нельзя добавлять в GitHub.

## Первый запуск Supabase

1. Откройте `supabase/schema.sql`.
2. Скопируйте весь SQL в Supabase → SQL Editor → New query.
3. В последнем блоке замените `REPLACE_WITH_ADMIN_EMAIL` на email первого администратора в нижнем регистре.
4. Нажмите Run один раз.
5. В Violet Ledger выберите «Получили приглашение? Создать аккаунт» и зарегистрируйтесь с тем же email.

## GitHub Pages

В репозитории откройте Settings → Pages и установите Source: GitHub Actions. После push в `main` workflow `.github/workflows/pages.yml` автоматически собирает и публикует приложение.

Адрес после публикации:

`https://dabramcontact-bot.github.io/violet-ledger-private/`

## Локальный запуск

```bash
npm install
npm run dev
```
