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
#
# Самообновление (с 0.8): скрипт ставит /etc/zeleny-sad/site-update.sh и /etc/cron.d/zeleny-sad-update.
# Раз в 10 минут сервер сам смотрит, изменилась ли ветка main, и если да — забирает ТОЛЬКО
# готовую сборку zeleny-sad/site (статические файлы) и переключает на неё ссылку current.
# Код из GitHub на сервере не исполняется, nginx и другие сайты не трогаются; если после
# переключения сайт не отвечает 200 — возвращается прежний выпуск.
# Выключить: curl -fsSL .../zeleny-sad-install.sh | AUTO_UPDATE=0 bash
set -euo pipefail

DOMAIN="${DOMAIN:-sad.kvestapp.ru}"
REPO_TARBALL="${REPO_TARBALL:-https://codeload.github.com/garant-sv/semen/tar.gz/refs/heads/main}"
ROOT=/var/www/zeleny-sad
LOG_DIR=/var/log/zeleny-sad
ETC=/etc/zeleny-sad
LOGS_REPO="${LOGS_REPO:-$(cat "$ETC/logs-repo" 2>/dev/null || true)}"
AUTO_UPDATE="${AUTO_UPDATE:-1}"
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
# Те же правила, что у самообновления: только обычные файлы веб-типов, без ссылок.
if find "$SRC" ! -type d ! -type f | grep -q . \
   || find "$SRC" -type f ! -regex '.*\.\(html\|js\|css\|json\|webmanifest\|png\|svg\|ico\|txt\|woff2\|webp\|jpg\)$' | grep -q .; then
  die "в сборке неожиданные файлы (ссылки или незнакомые типы) — ничего не выкладываю."
fi
mkdir -p "$RELEASE" "$ROOT/acme"
cp -r --no-preserve=mode,ownership "$SRC/." "$RELEASE/"
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
    # Как и на https: без IP и адресов детей в общем журнале nginx.
    access_log off;
    error_log $LOG_DIR/nginx-error.log crit;
    server_tokens off;
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
# После продления сертификата nginx должен его перечитать, иначе через ~90 дней сайт перестанет
# открываться. Хук certbot вызывает сам после каждого продления; reload — только если конфиг цел.
if [ -d /etc/letsencrypt ]; then
  mkdir -p /etc/letsencrypt/renewal-hooks/deploy
  cat > /etc/letsencrypt/renewal-hooks/deploy/zeleny-sad-nginx-reload.sh <<'HOOK'
#!/bin/sh
# Ставит deploy/zeleny-sad-install.sh: после продления любого сертификата nginx перечитывает его.
nginx -t >/dev/null 2>&1 && systemctl reload nginx
HOOK
  chmod 755 /etc/letsencrypt/renewal-hooks/deploy/zeleny-sad-nginx-reload.sh
fi

command -v python3 >/dev/null || { apt-get update -qq && apt-get install -y -qq python3; }
mkdir -p "$LOG_DIR" "$ETC"
chmod 750 "$LOG_DIR"
# Здесь лежит копия журнала (logs-repo.git) и ключ — только для root.
chmod 700 "$ETC"

# Заголовки безопасности. В nginx add_header внутри location отменяет заголовки сервера,
# поэтому этот набор повторяется в каждом location, где есть свой add_header.
CSP="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
SEC="add_header Content-Security-Policy \"$CSP\" always;
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        add_header Referrer-Policy no-referrer always;
        add_header Cross-Origin-Opener-Policy same-origin always;
        add_header Strict-Transport-Security \"max-age=31536000\" always;
        add_header Cross-Origin-Resource-Policy same-origin always;
        add_header Permissions-Policy \"camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), browsing-topics=(), interest-cohort=()\" always;"

say "Настраиваю nginx только для $DOMAIN"
{
  cat <<'EOF'
# Журнал игры: только время, версия, случайный номер устройства и события. Без IP и браузера.
log_format zeleny_events escape=json '{"ts":"$time_iso8601","v":"$arg_v","d":"$arg_d","b":"$arg_b"}';
# Ограничение темпа: IPv4 — по адресу, IPv6 — по сети /64 (иначе адрес меняется без труда).
# Класс за одним школьным адресом не должен упираться в лимит, поэтому он щедрый.
map $binary_remote_addr $zeleny_rl_key {
    "~(?s)^(?P<net6>.{8}).{8}$" $net6;
    default $binary_remote_addr;
}
limit_req_zone $zeleny_rl_key zone=zeleny_api:2m rate=10r/s;
# В журнал пишем только запросы игры: разумной длины (игра шлёт не больше ~1800 символов)
# и с настоящим номером устройства (12 знаков 0-9a-f). Остальное получает 204 без записи.
map $request_uri $zeleny_len_ok {
    "~^.{0,2100}$" 1;
    default 0;
}
map $arg_d $zeleny_dev_ok {
    "~^[0-9a-f]{12}$" 1;
    default 0;
}
map "$zeleny_len_ok$zeleny_dev_ok" $zeleny_ev_ok {
    "11" 1;
    default 0;
}

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
    # Сжатие: код игры и указатель озвучки в 3–6 раз меньше. Пакеты голоса (MP3 под .txt) не сжимаем.
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types application/javascript text/css application/json application/manifest+json image/svg+xml;
    # Детям — никаких журналов с адресами: обычный access_log для игры выключен, а в журнал
    # ошибок (там nginx пишет IP) попадают только поломки самого сервера, не запросы детей.
    access_log off;
    error_log $LOG_DIR/nginx-error.log crit;
    log_not_found off;

    # Обезличенный журнал игры (см. src/telemetry.ts). Ничего не отдаёт, только записывает.
    location = /api/e {
        # return сработал бы раньше лимита (фаза rewrite), поэтому ответ — в отдельном месте,
        # куда запрос попадает уже после проверки темпа.
        limit_req zone=zeleny_api burst=60 nodelay;
        limit_req_status 429;
        limit_req_log_level info;
        access_log off;
        try_files /.zeleny-none @zeleny_event;
    }
    location @zeleny_event {
        access_log $LOG_DIR/events.log zeleny_events if=\$zeleny_ev_ok;
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
        try_files \$uri =404;
    }
    # Озвучка и картинки: нет файла — честный 404, а не страница игры (иначе сервис-воркер
    # мог бы сохранить HTML вместо пакета голоса).
    location /voice/ {
        $SEC
        try_files \$uri =404;
    }
    location /icons/ {
        $SEC
        try_files \$uri =404;
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
  # Пишем во временный файл и добавляем целиком: упавший разбор не оставит половину дня,
  # и не остановит отправку прошлых дней.
  if python3 - "$LOG_DIR/events.$DAY.raw" > "$LOG_DIR/days/.$DAY.part" <<'PY'
import json, re, sys, urllib.parse
# Только известные поля и простые значения: журнал читает ИИ, поэтому чужой текст в нём
# не должен выглядеть как указание, а серверные поля (srv, v, dev) клиент подменить не может.
KEYS = {'e', 't', 'g', 'id', 'ok', 'pick', 'n', 'k', 'lvl', 'r', 'hint', 'ans', 'want', 'len', 'sep',
        'st', 'mig', 'q', 'pwa', 'w', 'ua', 'ya', 'first', 'named', 'hat', 'pet', 'kind', 'msg', 'at'}
EVENTS = {'start', 'save_error', 'seeds', 'gardener', 'quiz', 'sign', 'fair', 'fair_bad', 'fair_try',
          'profile', 'quest', 'error'}
DEV = re.compile(r'^[0-9a-f]{12}$')
VER = re.compile(r'^[0-9A-Za-z.\-]{1,24}$')
MAX_PER_DEV = 3000
per_dev = {}
ID = re.compile(r'^[0-9A-Za-z_.\-]{1,40}$')
def clean(k, v, e):
    if v is None or isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v if abs(v) < 1e13 else None
    if isinstance(v, str):
        if k == 'id' and not ID.match(v):
            return None
        if k == 'msg' and e != 'error':
            return None
        # Одиночная половинка эмодзи (обрезанная строка) не должна ронять весь разбор.
        return v[:160].encode('utf-8', 'replace').decode('utf-8')
    return None
for line in open(sys.argv[1], encoding='utf-8', errors='replace'):
    try:
        row = json.loads(line)
        batch = json.loads(urllib.parse.unquote(row.get('b', '')))
    except Exception:
        continue
    dev, ver = str(row.get('d', '')), str(row.get('v', ''))
    if not isinstance(batch, list) or not DEV.match(dev) or not VER.match(ver):
        continue
    for ev in batch[:50]:
        try:
            e = ev.get('e') if isinstance(ev, dict) else None
            if not isinstance(e, str) or e not in EVENTS:
                continue
            per_dev[dev] = per_dev.get(dev, 0) + 1
            if per_dev[dev] > MAX_PER_DEV:
                continue
            out = {'srv': clean('ts', row.get('ts'), e), 'v': ver, 'dev': dev}
            out.update({k: clean(k, v, e) for k, v in ev.items() if k in KEYS})
            print(json.dumps(out, ensure_ascii=False))
        except Exception:
            continue
PY
  then
    cat "$LOG_DIR/days/.$DAY.part" >> "$LOG_DIR/days/$DAY.jsonl"
    rm -f "$LOG_DIR/days/.$DAY.part" "$LOG_DIR/events.$DAY.raw"
  else
    echo "разбор журнала за $DAY не удался, сырой файл оставлен на 7 дней"
    rm -f "$LOG_DIR/days/.$DAY.part"
  fi
fi
# Необработанные остатки (если разбор падал) и старые дни не копим.
find "$LOG_DIR" -maxdepth 1 \( -name 'events.*.raw' -o -name 'events.log.big' \) -mtime +7 -delete
find "$LOG_DIR/days" -name '*.jsonl' -mtime +60 -delete
REPO="$(cat "$ETC/logs-repo" 2>/dev/null || true)"
if [ -n "$REPO" ] && [ -f "$ETC/logs_key" ]; then
  export GIT_SSH_COMMAND="ssh -i $ETC/logs_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  W="$ETC/logs-repo.git"
  [ -d "$W/.git" ] || git clone -q "git@github.com:$REPO.git" "$W"
  cd "$W"
  git pull -q --rebase || true
  mkdir -p days
  # Файл больше 20 МБ GitHub примет плохо (а больше 100 МБ сломает отправку навсегда): такой день остаётся на сервере.
  find "$LOG_DIR/days" -maxdepth 1 -name '*.jsonl' -size -20M -exec cp {} days/ \;
  find "$LOG_DIR/days" -maxdepth 1 -name '*.jsonl' -size +20M -printf 'день %f больше 20 МБ, в репозиторий не отправлен\n'
  find days -name '*.jsonl' -mtime +60 -delete
  git add -A days
  git -c user.name="zeleny-sad server" -c user.email="noreply@kvestapp.ru" commit -qm "Журнал за $DAY" || true
  git push -q || echo "push не удался — попробую завтра"
fi
JOURNAL
chmod 700 "$ETC/journal-daily.sh"
{
  echo '5 0 * * * root /etc/zeleny-sad/journal-daily.sh >> /var/log/zeleny-sad/journal-daily.out 2>&1'
  # Предел размера журнала за день (200 МБ): лишнее откладывается в сторону и не заполняет диск.
  echo '*/15 * * * * root f=/var/log/zeleny-sad/events.log; [ "$(stat -c \%s "$f" 2>/dev/null || echo 0)" -gt 209715200 ] && mv "$f" "$f.big" && [ -s /run/nginx.pid ] && kill -USR1 "$(cat /run/nginx.pid)"'
} > /etc/cron.d/zeleny-sad-journal
chmod 644 /etc/cron.d/zeleny-sad-journal

say "Самообновление игры"
cat > "$ETC/site-update.sh" <<'UPDATE'
#!/usr/bin/env bash
# Самообновление «Зелёного сада»: только статические файлы сборки, только своя папка.
# Ставит и обновляет его deploy/zeleny-sad-install.sh; запускается из /etc/cron.d/zeleny-sad-update.
set -euo pipefail
DOMAIN="$(cat /etc/zeleny-sad/domain)"
ROOT=/var/www/zeleny-sad
ETC=/etc/zeleny-sad
REPO_URL=https://github.com/garant-sv/semen
LOCK=/run/zeleny-sad-update.lock
exec 9>"$LOCK"
flock -n 9 || exit 0

SHA="$(git ls-remote "$REPO_URL" refs/heads/main 2>/dev/null | awk '{print $1}')"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "$(date -Is) не удалось узнать версию main"; exit 0; }
[ "$SHA" = "$(cat "$ETC/deployed-sha" 2>/dev/null || true)" ] && exit 0
# Эту версию уже пробовали, и сайт с ней не ответил: ждём следующую, не дёргаем сайт каждые 10 минут.
[ "$SHA" = "$(cat "$ETC/failed-sha" 2>/dev/null || true)" ] && exit 0

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PREV="$(readlink -f "$ROOT/current" || true)"
# Скачиваем не весь репозиторий (в нём ~50 МБ озвучки), а только файлы сборки, по одному:
# список файлов и их git-хэши берём из GitHub без содержимого; файл, который не изменился
# с прошлого выпуска (озвучка), просто копируем; остальные качаем с докачкой и повторами
# и сверяем с хэшем из git, так что подменённый или оборванный файл не пройдёт.
GIT="$TMP/git"
git init -q "$GIT"
git -C "$GIT" fetch -q --depth 1 --filter=blob:none "$REPO_URL" "$SHA" \
  || { echo "$(date -Is) $SHA: не удалось получить список файлов, попробую через 10 минут"; exit 0; }
SRC="$TMP/site"
mkdir -p "$SRC"
FETCHED=0
REUSED=0
while IFS= read -r -d '' line; do
  meta="${line%%$'\t'*}"
  path="${line#*$'\t'}"
  read -r mode type oid <<<"$meta"
  rel="${path#zeleny-sad/site/}"
  case "$rel" in ''|/*|*..*) echo "$(date -Is) $SHA: странный путь $path, пропускаю выпуск"; exit 0 ;; esac
  # Только обычные файлы: ни ссылок, ни исполняемых.
  [ "$type" = blob ] && [ "$mode" = 100644 ] || { echo "$(date -Is) $SHA: $path не обычный файл, пропускаю выпуск"; exit 0; }
  dest="$SRC/$rel"
  mkdir -p "$(dirname "$dest")"
  if [ -n "$PREV" ] && [ -f "$PREV/$rel" ] && [ "$(git hash-object "$PREV/$rel")" = "$oid" ]; then
    cp "$PREV/$rel" "$dest"
    REUSED=$((REUSED + 1))
    continue
  fi
  ok=0
  for _ in 1 2 3 4 5; do
    curl -fsSL --connect-timeout 20 --max-time 900 -C - -o "$dest" \
      "https://raw.githubusercontent.com/garant-sv/semen/$SHA/$path" || true
    if [ -f "$dest" ] && [ "$(git hash-object "$dest")" = "$oid" ]; then ok=1; break; fi
    # Файл скачан целиком, но не сходится с git: начинаем его заново, а не докачиваем.
    if [ -f "$dest" ] && [ "$(stat -c %s "$dest")" -ge "$(git -C "$GIT" cat-file -s "$oid" 2>/dev/null || echo 0)" ]; then rm -f "$dest"; fi
    sleep 5
  done
  [ "$ok" = 1 ] || { echo "$(date -Is) $SHA: не скачался $path, попробую через 10 минут"; exit 0; }
  FETCHED=$((FETCHED + 1))
done < <(git -C "$GIT" ls-tree -r -z "$SHA" -- zeleny-sad/site/)
[ -f "$SRC/index.html" ] && [ -f "$SRC/sw.js" ] || { echo "$(date -Is) $SHA: в main нет сборки, пропускаю"; exit 0; }
# Только обычные файлы понятных веб-типов и разумный размер — ничего исполняемого и лишнего.
if find "$SRC" ! -type d ! -type f | grep -q . \
   || find "$SRC" -type f ! -regex '.*\.\(html\|js\|css\|json\|webmanifest\|png\|svg\|ico\|txt\|woff2\|webp\|jpg\)$' | grep -q . \
   || [ "$(du -sm "$SRC" | awk '{print $1}')" -gt 50 ]; then
  echo "$(date -Is) $SHA: в сборке неожиданные файлы или она слишком большая, пропускаю"
  exit 0
fi

RELEASE="$ROOT/releases/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RELEASE"
cp -r "$SRC/." "$RELEASE/"
chmod -R a+rX,go-w "$RELEASE"
ln -sfn "$RELEASE" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"

CODE=000
for _ in 1 2 3 4 5; do
  sleep 1
  CODE="$(curl --noproxy '*' -sk -o /dev/null -w '%{http_code}' --resolve "$DOMAIN:443:127.0.0.1" "https://$DOMAIN/")" || true
  [ "$CODE" = 200 ] && break
done
if [ "$CODE" != 200 ] && [ -n "$PREV" ] && [ -d "$PREV" ]; then
  ln -sfn "$PREV" "$ROOT/current.new" && mv -Tf "$ROOT/current.new" "$ROOT/current"
  rm -rf "$RELEASE"
  echo "$SHA" > "$ETC/failed-sha"
  echo "$(date -Is) $SHA: сайт ответил $CODE, вернул прежний выпуск"
  exit 1
fi
echo "$SHA" > "$ETC/deployed-sha"
ls -1dt "$ROOT"/releases/* | tail -n +4 | xargs -r rm -rf
echo "$(date -Is) выложен $SHA (скачано файлов: $FETCHED, взято из прошлого выпуска: $REUSED)"
UPDATE
chmod 700 "$ETC/site-update.sh"
echo "$DOMAIN" > "$ETC/domain"
if [ "$AUTO_UPDATE" = 1 ]; then
  command -v git >/dev/null || { apt-get update -qq && apt-get install -y -qq git; }
  command -v flock >/dev/null || { apt-get update -qq && apt-get install -y -qq util-linux; }
  git ls-remote https://github.com/garant-sv/semen refs/heads/main 2>/dev/null | awk '{print $1}' > "$ETC/deployed-sha" || true
  echo '*/10 * * * * root /etc/zeleny-sad/site-update.sh >> /var/log/zeleny-sad/update.out 2>&1' > /etc/cron.d/zeleny-sad-update
  chmod 644 /etc/cron.d/zeleny-sad-update
  echo "Включено: раз в 10 минут сервер сам забирает новую сборку игры из main (журнал: /var/log/zeleny-sad/update.out)."
else
  rm -f /etc/cron.d/zeleny-sad-update
  echo "Самообновление выключено (AUTO_UPDATE=0)."
fi

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
