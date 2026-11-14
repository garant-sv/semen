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
#   * перед перезагрузкой nginx проверяет конфигурацию (nginx -t); при ошибке убирает свою правку;
#   * другие сайты, сертификаты, сервисы и базы данных на сервере не трогает.
# Повторный запуск = обновление игры до последней версии из репозитория.
set -euo pipefail

DOMAIN="${DOMAIN:-zeleny-sad.pravlenie365.ru}"
REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/garant-sv/semen/tar.gz/refs/heads/main}"
ROOT=/var/www/zeleny-sad
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

say "Настраиваю nginx только для $DOMAIN"
{
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

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;

    # Service worker, страница и манифест всегда свежие — так обновления доходят до телефонов.
    location = /sw.js               { add_header Cache-Control "no-cache" always; }
    location = /index.html          { add_header Cache-Control "no-cache" always; }
    location = /manifest.webmanifest {
        default_type application/manifest+json;
        add_header Cache-Control "no-cache" always;
    }
    # Файлы с хэшем в имени можно кэшировать надолго.
    location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable" always; }

    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
} > "$CONF_AVAIL"
apply_conf

say "Проверяю"
CODE=000
for _ in 1 2 3 4 5 6; do
  sleep 1
  CODE="$(curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")" || true
  [ "$CODE" = 200 ] && break
done
echo "Ответ сайта: HTTP $CODE"
[ "$CODE" = 200 ] || die "сайт ответил $CODE вместо 200."
say "Готово! Игра открывается по адресу https://$DOMAIN"
echo "На iPhone: Safari → «Поделиться» → «На экран „Домой“»."
