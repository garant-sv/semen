# Семён

Личные проекты для Семёна.

| Папка / файл | Что это |
| --- | --- |
| `index.html` | «Семён учится» — учебная страница (одним файлом). |
| `zeleny-sad/` | **«Зелёный сад»** — детская PWA-игра: сад, огород, природные зоны России, гости, задания Листика, вопросы по «Окружающему миру» 4 класса. Исходники (TypeScript + Vite), тесты и подробный README внутри. |
| `zeleny-sad/site/` | Готовая сборка игры — именно её выкладывает скрипт на сервер. |
| `deploy/zeleny-sad-install.sh` | Установка и обновление игры на сервере с nginx. |

## Обновить игру на сервере

На сервере под root:

```bash
curl -fsSL https://raw.githubusercontent.com/garant-sv/semen/main/deploy/zeleny-sad-install.sh | bash
```

По умолчанию игра ставится на `zeleny-sad.pravlenie365.ru` (используется уже имеющийся wildcard-сертификат). Другой адрес — `DOMAIN=sad.example.ru` перед `bash`. Скрипт трогает только папку `/var/www/zeleny-sad` и один файл `/etc/nginx/sites-available/zeleny-sad.conf`, а перед перезагрузкой проверяет `nginx -t`.

## Собрать игру после изменений

```bash
cd zeleny-sad
npm install
npm run check          # типы, юнит-тесты, сборка, e2e
npm run build && rm -rf site && cp -r dist site
```
