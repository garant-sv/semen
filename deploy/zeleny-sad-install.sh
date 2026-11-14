#!/usr/bin/env bash
# Установка / обновление игры «Зелёный сад» на сервере с nginx (Ubuntu).
#
# Запуск на сервере под root:
#   curl -fsSL https://raw.githubusercontent.com/garant-sv/semen/main/deploy/zeleny-sad-install.sh | bash
# Другой адрес:
#   curl -fsSL .../zeleny-sad-install.sh | DOMAIN=sad.example.ru bash
#
# Что делает (и чего НЕ делает):
#   * кладёт готовую сборку игры в /var/www/zeleny-sad/releases/<время> и переключает ссылку current;
#   * добавляет ОДИН файл /etc/nginx/sites-available/zeleny-sad.conf только для своего домена;
#   * ведёт обезличенный журнал игры (без IP-адресов) в /var/log/zeleny-sad/ и раз в сутки
#     складывает его в файл за день (/etc/cron.d/zeleny-sad-journal); если задан LOGS_REPO —
#     ещё и отправляет его в закрытый репозиторий GitHub, чтобы ИИ мог его разбирать;
#   * перед перезагрузкой nginx проверяет конфигурацию (nginx -t); при ошибке убирает свою правку;
#   * другие сайты, сертификаты, сервисы и базы данных на сервере не трогает.
# Повторный запуск = обновление игры до последней версии из репозитория.
# Адрес по умолчанию: sad.kvestapp.ru (нужна A-запись sad → IP сервера).
# Журнал в GitHub (один раз):  curl -fsSL .../zeleny-sad-install.sh | LOGS_REPO=garant-sv/zeleny-sad-logs bash
set -euo pipefail

DOMAIN="${DOMAIN:-sad.kvestapp.ru}"
REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/garant-sv/semen/tar.gz/refs/heads/main}"
ROOT=/var/www/zeleny-sad
LOG_DIR=/var/log/zeleny-sad
ETC=/etc/zeleny-sad
LOGS_REPO="${LOGS_REPO:-$(cat "$ETC/logs-repo" 2>/dev/null || true)}"
CONF_AVAIL=/etc/nginx/sites-available/zeleny-sad.conf
CONF_ENABLED=/etc/nginx/sites-enabled/zeleny-sad.conf

say() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mОшибка: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "запустите под root (sudo -i)."
command -v nginx >/dev/null || die "nginx не найден — этот скрипт рассчитан на сервер с nginx."
command -v curl >/dev/null || die "нужен curl."
nginx -t >/dev/null 2>&1 || die "nginx -t уже сейчас выдаёт ошибку. Сначала исправьте текущую конфигурацию — я ничего не менял."

say "Домен: $DOMAIN"
SERVER_IP="$(curl -fsS4 --max-time 5 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}')"
if [ -z "$DOMAIN_IP" ]; then
  die "домен $DOMAIN пока не указывает ни на какой адрес. Добавьте A-запись на $SERVER_IP и запустите снова."
elif [ "$DOMAIN_IP" != "$SERVER_IP" ]; then
  echo "Внимание: $DOMAIN указывает на $DOMAIN_IP, а этот сервер — $SERVER_IP. Продолжаю, но сайт может не открыться."
fi

say "Скачиваю последнюю версию игры"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
curl -fsSL "$REPO_TARBALL" | tar -xz -C "$TMP"
SRC="$(find "$TMP" -maxdepth 3 -type d -path '*/zeleny-sad/site' | head -1)"
[ -n "$SRC" ] && [ -f "$SRC/index.html" ] || die "в архиве не найдена сборка zeleny-sad/site."

RELEASE="$ROOT/releases/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RELEASE" "$ROOT/acme"
cp -a "$SRC/." "$RELEASE/"
chmod -R a+rX "$ROOT"
ln -sfn "$RELEASE" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
# Храним три последних выпуска, чтобы можно было откатиться.
ls -1dt "$ROOT"/releases/* | tail -n +4 | xargs -r rm -rf

# Сертификат: для *.pravlenie365.ru уже есть wildcard; для другого домена — выпускаем свой.
CERT_DIR=""
case "$DOMAIN" in
  *.pravlenie365.ru)
    [ -f /etc/letsencrypt/live/pravlenie365.ru/fullchain.pem ] && CERT_DIR=/etc/letsencrypt/live/pravlenie365.ru ;;
esac
[ -z "$CERT_DIR" ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ] && CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

# IPv6 слушаем, только если остальные сайты на сервере уже его слушают.
LISTEN6=0
grep -rqs --exclude=zeleny-sad.conf 'listen \[::\]' /etc/nginx/sites-enabled /etc/nginx/conf.d && LISTEN6=1

BACKUP=""
[ -f "$CONF_AVAIL" ] && BACKUP="$(mktemp)" && cp "$CONF_AVAIL" "$BACKUP"

apply_conf() {
  ln -sfn "$CONF_AVAIL" "$CONF_ENABLED"
  if ! nginx -t; then
    echo "nginx -t не прошёл — возвращаю как было."
    if [ -n "$BACKUP" ]; then cp "$BACKUP" "$CONF_AVAIL"; else rm -f "$CONF_ENABLED" "$CONF_AVAIL"; fi
    nginx -t >/dev/null 2>&1 && systemctl reload nginx
    die "конфигурация nginx для игры не применилась; остальные сайты не затронуты."
  fi
  systemctl reload nginx
}

http_block() {
  cat <<EOF
server {
    listen 80;
$( [ "$LISTEN6" = 1 ] && echo '    listen [::]:80;' )
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root $ROOT/acme; }
    location / { return 301 https://\$host\$request_uri; }
}
EOF
}

if [ -z "$CERT_DIR" ]; then
  say "Выпускаю HTTPS-сертификат для $DOMAIN"
  command -v certbot >/dev/null || { apt-get update -qq && apt-get install -y -qq certbot; }
  http_block > "$CONF_AVAIL"
  apply_conf
  certbot certonly --webroot -w "$ROOT/acme" -d "$DOMAIN" --non-interactive --agree-tos \
    --register-unsafely-without-email --keep-until-expiring
  CERT_DIR="/etc/letsencrypt/live/$DOMAIN"
fi

mkdir -p "$LOG_DIR" "$ETC"
chmod 750 "$LOG_DIR"

# Заголовки безопасности. В nginx add_header внутри location отменяет заголовки сервера,
# поэтому этот набор повторяется в каждом location, где есть свой add_header.
CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
SEC="add_header Content-Security-Policy \"$CSP\" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy no-referrer always;
        add_header Cross-Origin-Opener-Policy same-origin always;
        add_header Permissions-Policy \"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()\" always;"

say "Настраиваю nginx только для $DOMAIN"
{
  cat <<'EOF'
# Журнал игры: только время, версия, случайный номер устройства и события. Без IP и браузера.
log_format zeleny_events escape=json '{"ts":"$time_iso8601","v":"$arg_v","d":"$arg_d","b":"$arg_b"}';
limit_req_zone $binary_remote_addr zone=zeleny_api:1m rate=2r/s;

EOF
  http_block
  cat <<EOF

server {
    listen 443 ssl;
$( [ "$LISTEN6" = 1 ] && echo '    listen [::]:443 ssl;' )
    server_name $DOMAIN;

    ssl_certificate     $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;

    root $ROOT/current;
    index index.html;
    server_tokens off;
    # Детям — никаких журналов с адресами: обычный access_log для игры выключен.
    access_log off;

    # Обезличенный журнал игры (см. src/telemetry.ts). Ничего не отдаёт, только записывает.
    location = /api/e {
        limit_req zone=zeleny_api burst=30 nodelay;
        limit_req_status 429;
        access_log $LOG_DIR/events.log zeleny_events;
        add_header Cache-Control "no-store" always;
        return 204;
    }
    location /api/ { return 404; }
    # Скрытые файлы (.git, .env и т.п.) не отдаём никогда.
    location ~ /\. { return 404; }

    # Service worker, страница и манифест всегда свежие — так обновления доходят до телефонов.
    location = /sw.js {
        $SEC
        add_header Cache-Control "no-cache" always;
    }
    location = /index.html {
        $SEC
        add_header Cache-Control "no-cache" always;
    }
    location = /manifest.webmanifest {
        default_type application/manifest+json;
        $SEC
        add_header Cache-Control "no-cache" always;
    }
    # Файлы с хэшем в имени можно кэшировать надолго.
    location /assets/ {
        $SEC
        add_header Cache-Control "public, max-age=31536000, immutable" always;
    }

    location / {
        $SEC
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
} > "$CONF_AVAIL"
apply_conf

say "Журнал игры: ежедневная сводка"
cat > "$ETC/journal-daily.sh" <<'JOURNAL'
#!/usr/bin/env bash
# Раз в сутки: журнал за прошедшие сутки → $LOG_DIR/days/ГГГГ-ММ-ДД.jsonl (одно событие в строке),
# старше 60 дней удаляются. Если настроен репозиторий — отправляет файл туда.
set -euo pipefail
LOG_DIR=/var/log/zeleny-sad
ETC=/etc/zeleny-sad
DAY="$(date -d yesterday +%F)"
mkdir -p "$LOG_DIR/days"
if [ -s "$LOG_DIR/events.log" ]; then
  mv "$LOG_DIR/events.log" "$LOG_DIR/events.$DAY.raw"
  [ -s /run/nginx.pid ] && kill -USR1 "$(cat /run/nginx.pid)"
  sleep 2
  python3 - "$LOG_DIR/events.$DAY.raw" >> "$LOG_DIR/days/$DAY.jsonl" <<'PY'
import json, sys, urllib.parse
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    try:
        row = json.loads(line)
        batch = json.loads(urllib.parse.unquote(row.get('b', '')))
    except Exception:
        continue
    if not isinstance(batch, list):
        continue
    for ev in batch[:50]:
        if isinstance(ev, dict):
            ev = {k: v for k, v in ev.items() if k != 'nick'}
            print(json.dumps({'srv': row.get('ts'), 'v': row.get('v'), 'dev': row.get('d'), **ev}, ensure_ascii=False))
PY
  rm -f "$LOG_DIR/events.$DAY.raw"
fi
find "$LOG_DIR/days" -name '*.jsonl' -mtime +60 -delete
REPO="$(cat "$ETC/logs-repo" 2>/dev/null || true)"
if [ -n "$REPO" ] && [ -f "$ETC/logs_key" ]; then
  export GIT_SSH_COMMAND="ssh -i $ETC/logs_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  W="$ETC/logs-repo.git"
  [ -d "$W/.git" ] || git clone -q "git@github.com:$REPO.git" "$W"
  cd "$W"
  git pull -q --rebase || true
  mkdir -p days
  cp "$LOG_DIR"/days/*.jsonl days/ 2>/dev/null || true
  find days -name '*.jsonl' -mtime +60 -delete
  git add -A days
  git -c user.name="zeleny-sad server" -c user.email="noreply@kvestapp.ru" commit -qm "Журнал за $DAY" || true
  git push -q || echo "push не удался — попробую завтра"
fi
JOURNAL
chmod 700 "$ETC/journal-daily.sh"
echo '5 0 * * * root /etc/zeleny-sad/journal-daily.sh >> /var/log/zeleny-sad/journal-daily.out 2>&1' > /etc/cron.d/zeleny-sad-journal
chmod 644 /etc/cron.d/zeleny-sad-journal

if [ -n "$LOGS_REPO" ]; then
  command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
  echo "$LOGS_REPO" > "$ETC/logs-repo"
  [ -f "$ETC/logs_key" ] || ssh-keygen -q -t ed25519 -N '' -C "zeleny-sad-journal@$(hostname)" -f "$ETC/logs_key"
  chmod 600 "$ETC/logs_key"
  if GIT_SSH_COMMAND="ssh -i $ETC/logs_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new" \
       git ls-remote "git@github.com:$LOGS_REPO.git" >/dev/null 2>&1; then
    echo "Доступ к $LOGS_REPO есть — журнал будет уходить туда каждую ночь в 00:05."
  else
    echo
    echo "Чтобы журнал уходил в GitHub, добавьте ключ в репозиторий $LOGS_REPO:"
    echo "  Settings → Deploy keys → Add deploy key, отметьте «Allow write access», вставьте строку:"
    echo
    cat "$ETC/logs_key.pub"
    echo
    echo "После этого ничего перезапускать не нужно — ночью журнал отправится сам."
  fi
fi

say "Проверяю"
CODE=000
for _ in 1 2 3 4 5 6; do
  sleep 1
  CODE="$(curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")" || true
  [ "$CODE" = 200 ] && break
done
echo "Ответ сайта: HTTP $CODE"
[ "$CODE" = 200 ] || die "сайт ответил $CODE вместо 200."
HDR="$(curl --noproxy '*' -skI --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")"
echo "$HDR" | grep -qi '^content-security-policy:' && echo "Защитные заголовки: есть" || echo "Внимание: заголовок CSP не найден"
BEACON="$(curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/api/e?v=check&d=000000000000&b=%5B%5D")" || true
echo "Журнал игры: HTTP $BEACON (ожидается 204)"
say "Готово! Игра открывается по адресу https://$DOMAIN"
echo "На iPhone: Safari → «Поделиться» → «На экран „Домой“»."
