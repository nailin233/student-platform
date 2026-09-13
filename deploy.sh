#!/usr/bin/env bash
# =============================================================================
# 一键部署脚本 · 学员管理平台 Demo
# =============================================================================
# 适用环境：腾讯云 / 阿里云 等 Linux 服务器 + 宝塔面板 + 2核2G
#
# 这个脚本做四件事：
#   1. 检查环境（内存、Docker、端口）
#   2. 生成 .env 并启动 Docker（MySQL + 后端）
#   3. 构建前端（内存不足时自动降级提示）
#   4. 打印宝塔面板的后续配置步骤
#
# 用法：
#   cd /www/wwwroot/student-platform
#   chmod +x deploy.sh
#   ./deploy.sh
#
# 重复执行安全：已存在的 .env 不会被覆盖；容器重复启动不会丢数据。
# =============================================================================

set -euo pipefail

# ---- 颜色输出 ----
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[信息]${NC} $1"; }
ok()    { echo -e "${GREEN}[完成]${NC} $1"; }
warn()  { echo -e "${YELLOW}[注意]${NC} $1"; }
fail()  { echo -e "${RED}[失败]${NC} $1"; exit 1; }

# 工作目录 = 脚本所在目录
cd "$(dirname "$0")"
ROOT="$(pwd)"
info "项目目录：$ROOT"

COMPOSE_FILE="docker-compose.lowmem.yml"

# =============================================================================
# 第 0 步 · 前置检查
# =============================================================================
echo ""
echo "=========================================="
echo "  第 0 步 · 环境检查"
echo "=========================================="

# 检查 compose 文件
[ -f "$COMPOSE_FILE" ] || fail "找不到 $COMPOSE_FILE，请确认在项目根目录运行"

# 检查 Docker
if ! command -v docker >/dev/null 2>&1; then
  fail "未安装 Docker。请先执行：
  curl -fsSL https://get.docker.com | sh
  sudo systemctl enable --now docker"
fi
ok "Docker 已安装：$(docker --version)"

# 判断 compose 命令形式（新版本是 docker compose，旧版是 docker-compose）
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  fail "找不到 compose 命令。请安装：sudo apt install -y docker-compose-plugin"
fi
ok "compose 命令：$COMPOSE"

# 检查 Docker 服务是否在跑
if ! docker info >/dev/null 2>&1; then
  fail "Docker 服务未运行。执行：sudo systemctl start docker"
fi
ok "Docker 服务运行中"

# 检查内存（某些精简系统没有 free，做个兜底）
if command -v free >/dev/null 2>&1; then
  MEM_MB=$(free -m | awk '/^Mem:/{print $2}')
  info "系统内存：${MEM_MB} MB"
  if [ "${MEM_MB:-0}" -lt 1800 ]; then
    warn "内存不足 2G，MySQL 可能启动失败。建议先加 swap："
    warn "  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile"
    warn "  sudo mkswap /swapfile && sudo swapon /swapfile"
    warn "  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab"
  fi

  SWAP_MB=$(free -m | awk '/^Swap:/{print $2}')
  if [ "${SWAP_MB:-0}" -eq 0 ]; then
    warn "未启用 swap。2G 内存建议加 2G swap 兜底（命令见上）"
  else
    ok "swap 已启用：${SWAP_MB} MB"
  fi
else
  warn "系统没有 free 命令，跳过内存检查"
fi

# 检查磁盘
if command -v df >/dev/null 2>&1; then
  DISK_AVAIL=$(df -m / | awk 'NR==2{print $4}')
  info "根分区可用空间：${DISK_AVAIL} MB"
  if [ "${DISK_AVAIL:-0}" -lt 5000 ]; then
    warn "磁盘剩余不足 5G，镜像和数据可能放不下"
  fi
fi

# 检查端口 8000 是否被占用
# 为什么不用 ss/netstat：这两个命令在精简系统里经常没有，在 Git Bash / WSL
# 里输出格式也和 Linux 不一致，grep ':8000 ' 容易漏检（带空格匹配不到 127.0.0.1:8000）。
# 这里改用「真正尝试绑定端口」，能绑上就是空闲，这是最可靠的方式。
PORT_BUSY=0
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  PY=""
fi

if [ -n "$PY" ]; then
  # 退出码 0 = 端口空闲；非 0 = 被占用
  if ! "$PY" - <<'PYEOF' >/dev/null 2>&1
import socket, sys
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
try:
    s.bind(("127.0.0.1", 8000))
except OSError:
    sys.exit(1)
finally:
    s.close()
PYEOF
  then
    PORT_BUSY=1
  fi
else
  # 没有 python 时退回 ss/netstat
  if command -v ss >/dev/null 2>&1; then
    if ss -tln 2>/dev/null | grep -qE ':8000[[:space:]]'; then PORT_BUSY=1; fi
  elif command -v netstat >/dev/null 2>&1; then
    if netstat -tln 2>/dev/null | grep -qE ':8000[[:space:]]'; then PORT_BUSY=1; fi
  else
    warn "没有 python/ss/netstat，跳过端口检查"
  fi
fi

# 如果被占用，但占用者是本项目自己的容器，那不算冲突
if [ "$PORT_BUSY" = "1" ]; then
  RUNNING_OWN=$(docker ps --filter "name=sp-backend" --format '{{.Names}}' 2>/dev/null || true)
  if [ -n "$RUNNING_OWN" ]; then
    ok "端口 8000 被本项目容器 sp-backend 占用（属正常，脚本会原地重启）"
    PORT_BUSY=0
  else
    fail "端口 8000 已被其它程序占用，容器起不来。先排查：
  sudo ss -tlnp | grep ':8000'          # 看是谁占的
  docker ps --filter publish=8000       # 看是不是旧容器
  如果是旧容器：docker rm -f sp-backend
  如果是本机跑的后端服务，先停掉它"
  fi
fi
[ "$PORT_BUSY" = "0" ] && ok "端口 8000 可用"

# =============================================================================
# 第 1 步 · 生成 .env
# =============================================================================
echo ""
echo "=========================================="
echo "  第 1 步 · 生成配置"
echo "=========================================="

if [ -f .env ]; then
  ok ".env 已存在，保持不变（如需重置请手动删除后重跑）"
else
  if command -v openssl >/dev/null 2>&1; then
    DB_PASS=$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)
  else
    DB_PASS=$(head -c 32 /dev/urandom | base64 | tr -d '/+=' | head -c 20)
  fi
  cat > .env <<EOF
# 由 deploy.sh 自动生成于 $(date '+%Y-%m-%d %H:%M:%S')
# 这个文件包含数据库密码，不要提交到 Git、不要发给别人
MYSQL_ROOT_PASSWORD=${DB_PASS}
EOF
  chmod 600 .env
  ok ".env 已生成（数据库密码已随机生成，权限设为 600）"
fi

# =============================================================================
# 第 2 步 · 启动 Docker
# =============================================================================
echo ""
echo "=========================================="
echo "  第 2 步 · 启动数据库与后端"
echo "=========================================="
info "首次构建需要拉取镜像、装 Python 依赖，2核2G 大约 3-8 分钟……"

$COMPOSE -f "$COMPOSE_FILE" up -d --build

info "等待数据库初始化（首次启动需要建库建表）……"
for i in $(seq 1 30); do
  sleep 3
  if curl -s -m 3 http://127.0.0.1:8000/api/dashboard/stats >/dev/null 2>&1; then
    break
  fi
  printf "."
done
echo ""

# 验证后端
if curl -s -m 5 http://127.0.0.1:8000/api/health | grep -q '"status":"ok"'; then
  ok "后端已启动"
else
  echo ""
  warn "后端健康检查未通过。最近的日志："
  docker logs sp-backend --tail 30 2>&1 || true
  echo ""
  warn "MySQL 日志："
  docker logs sp-mysql --tail 20 2>&1 || true
  fail "请把上面的日志发我排查"
fi

# 检查数据库连通与中文编码
STATS=$(curl -s -m 5 http://127.0.0.1:8000/api/dashboard/stats)
info "统计数据：$STATS"

COURSE_RAW=$(curl -s -m 5 http://127.0.0.1:8000/api/courses | head -c 100)
if echo "$COURSE_RAW" | grep -q '声乐班\|书法班\|摄影班'; then
  ok "中文编码正常"
else
  warn "中文可能异常，当前输出：$COURSE_RAW"
  warn "如果显示类似 'å£°ä¹ç' 的乱码，说明 schema.sql 编码有问题"
fi

# 容器资源占用
echo ""
info "容器资源占用："
docker stats --no-stream --format "  {{.Name}}\t内存 {{.MemUsage}}\tCPU {{.CPUPerc}}" 2>/dev/null | grep -E "sp-" || true

# =============================================================================
# 第 3 步 · 构建前端
# =============================================================================
echo ""
echo "=========================================="
echo "  第 3 步 · 构建前端"
echo "=========================================="

SKIP_BUILD=0
FORCE_BUILD="${FORCE_BUILD:-0}"

if [ -f frontend/dist/index.html ] && [ "$FORCE_BUILD" != "1" ]; then
  ok "前端已构建过（frontend/dist 存在）"
  info "如需重新构建，用：FORCE_BUILD=1 ./deploy.sh"
  SKIP_BUILD=1
fi

if [ "$SKIP_BUILD" != "1" ]; then
  if [ ! -d frontend ]; then
    fail "找不到 frontend 目录。请确认代码上传完整（项目根目录应有 frontend/、backend/、database/）"
  fi

  if ! command -v npm >/dev/null 2>&1; then
    warn "未安装 Node.js，无法在服务器上构建前端。"
    warn "两个选择："
    warn "  1. 安装 Node：curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"
    warn "  2. 在本机执行 npm run build，然后把 frontend/dist 上传到服务器"
    warn "前端未构建时，网站无法访问。"
  else
    ok "Node.js 已安装：$(node -v)"
    # 注意：set -e 不会捕获 if 块内的 cd 失败，必须显式判断
    if ! cd frontend; then
      fail "无法进入 frontend 目录"
    fi
    if [ ! -d node_modules ]; then
      info "安装前端依赖（约 1-3 分钟）……"
      npm install --no-audit --no-fund
    else
      ok "依赖已安装，跳过"
    fi
    info "构建中（2核2G 需要 30-90 秒，限制内存防止 OOM）……"
    NODE_OPTIONS="--max-old-space-size=768" npm run build
    cd "$ROOT"
    if [ -f frontend/dist/index.html ]; then
      ok "前端构建完成：frontend/dist"
    else
      fail "构建未产出 dist/index.html，请检查上面的报错"
    fi
  fi
fi

# 前端产物是后面 Nginx 的站点根目录，必须存在
if [ ! -f frontend/dist/index.html ]; then
  warn "前端产物 frontend/dist/index.html 不存在。"
  warn "网站根目录还没准备好，宝塔里的站点添加后会是空白页。"
  warn "请先构建前端（或在本地 npm run build 后上传 frontend/dist）。"
fi

# =============================================================================
# 完成 · 打印后续步骤
# =============================================================================
# 尝试自动获取公网 IP（失败不影响流程）
if command -v curl >/dev/null 2>&1; then
  IPV4=$(curl -s -m 8 https://api.ipify.org 2>/dev/null || echo "")
  # 校验拿到的是不是合法 IPv4
  if ! echo "$IPV4" | grep -qE '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
    IPV4=""
  fi
else
  IPV4=""
fi

if [ -z "$IPV4" ]; then
  IPV4="<你的公网IP>"
  warn "未能自动获取公网 IP，下面请手动替换成你的服务器 IP"
fi

echo ""
echo "=========================================="
echo "  后端部署完成！接下来在宝塔面板操作"
echo "=========================================="
echo ""
echo -e "${GREEN}后端已在运行${NC}，地址 http://127.0.0.1:8000"
if [ -f frontend/dist/index.html ]; then
  echo -e "${GREEN}前端产物已就绪${NC}：${ROOT}/frontend/dist"
else
  echo -e "${RED}前端产物缺失${NC}：宝塔站点添加后会显示空白页，请先完成第 3 步构建"
fi
echo ""
echo -e "${YELLOW}还需要在宝塔面板做两件事：${NC}"
echo ""
echo "【1】添加网站"
echo "     宝塔 → 网站 → 添加站点"
echo "     · 域名：填 ${IPV4}"
echo "     · 根目录：${ROOT}/frontend/dist"
echo "     · PHP 版本：纯静态"
echo ""
echo "【2】配置反向代理（关键，不做的话页面能打开但没数据）"
echo "     点该站点 → 设置 → 反向代理 → 添加"
echo "     · 代理名称：api"
echo "     · 目标URL：http://127.0.0.1:8000"
echo "     · 发送域名：\$host"
echo ""
echo -e "${YELLOW}别忘了在腾讯云控制台放行 80 端口（安全组/防火墙）。${NC}"
echo ""
echo "──────────────────────────────────────────"
echo "常用命令："
echo "  查看状态   $COMPOSE -f $COMPOSE_FILE ps"
echo "  查看日志   docker logs sp-backend --tail 50 -f"
echo "  重启后端   $COMPOSE -f $COMPOSE_FILE restart backend"
echo "  停止服务   $COMPOSE -f $COMPOSE_FILE down"
echo ""
echo "灌入演示数据（可选）："
echo "  docker cp database/seed_demo.py sp-backend:/app/seed_demo.py"
echo "  docker exec sp-backend python /app/seed_demo.py"
echo "  docker exec sp-backend rm -f /app/seed_demo.py"
echo "──────────────────────────────────────────"
