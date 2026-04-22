#!/bin/sh
set -e

# Fix volume ownership (Docker volumes mount as root)
chown -R node:node /home/node/.openclaw 2>/dev/null || true
chown -R node:node /app/wx-filehelper-api/downloads 2>/dev/null || true

echo "[entrypoint] Registering plugin..."
su -s /bin/sh node -c "/app/register-plugin.sh"

echo "[entrypoint] Starting wx-filehelper-api..."
cd /app/wx-filehelper-api
python3 main.py &

# Wait for wx-filehelper-api to be ready
echo "[entrypoint] Waiting for wx-filehelper-api on port 23051..."
for i in $(seq 1 30); do
  if node -e "fetch('http://localhost:23051/bot/getMe').then(r=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "[entrypoint] wx-filehelper-api is ready"
    break
  fi
  sleep 1
done

echo "[entrypoint] Starting OpenClaw gateway as node user..."
cd /app
exec su -s /bin/sh node -c "exec node openclaw.mjs gateway --bind ${OPENCLAW_GATEWAY_BIND:-lan}"
