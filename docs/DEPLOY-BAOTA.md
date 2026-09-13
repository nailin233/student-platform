# 部署上线指南 · 宝塔面板 + 2核2G + 无域名

> 适用场景：自己练手，把 Demo 部署到云服务器上，能通过公网 IP 访问。
> 如果你后续要给客户正式使用，请对照本文「第八节 转正式使用前必做」升级配置。

---

## 决策：为什么选这条路

你的环境是 **2核2G + 宝塔面板 + 无域名**，有三条路可走：

| 方案 | 做法 | 适不适合你 |
|---|---|---|
| A · 宝塔全包 | 用宝塔的 MySQL + Python 项目管理器 | 不推荐。宝塔 Python 项目管理器对小众依赖支持差，容易卡在装包 |
| B · Docker 跑后端+MySQL，宝塔的 Nginx 做前端和反代 | 各司其职 | **推荐**。Docker 保证环境一致，宝塔的 Nginx 负责静态文件和反代 |
| C · 全 Docker（含 Nginx） | 一个 compose 全搞定 | 可以，但和宝塔的 Nginx 抢 80 端口，容易冲突 |

**选 B**。理由：

- 后端和数据库的环境隔离交给 Docker，不用折腾系统级 Python 环境
- 前端静态文件和 HTTPS 交给宝塔，图形界面配 Nginx 比手写配置直观
- 80 端口只有宝塔的 Nginx 在用，不冲突

```
公网用户
   │
   ↓ http://你的IP:端口
┌──────────────────────────────────┐
│  宝塔 Nginx（占用 80 端口）        │
│  ├── /          → 前端静态文件     │
│  └── /api/      → 反代到 :8000     │
└──────────────┬───────────────────┘
               ↓
        Docker 容器（127.0.0.1:8000）
        └── sp-backend
                 ↓ 内网
            sp-mysql（不对外暴露）
```

---

## 一、部署前必读：2核2G 的三个坑

### 坑 1 · MySQL 内存

MySQL 8.4 默认配置在 2G 内存机器上峰值能吃到 800MB+。加上后端、宝塔面板本身，
**很容易触发系统 OOM，MySQL 进程被直接杀掉**，表现为「用着用着就连不上数据库」。

我已经准备好了低配专用的编排文件 `docker-compose.lowmem.yml`，把 MySQL 的关键内存参数压下来了：

| 参数 | 默认 | 低配版 | 作用 |
|---|---|---|---|
| `innodb-buffer-pool-size` | 128M | 128M | InnoDB 缓存（保持，这是核心） |
| `innodb-log-buffer-size` | 16M | 8M | 日志缓冲 |
| `max-connections` | 151 | 50 | 最大连接数（我们远用不到 151） |
| `performance-schema` | ON | OFF | 性能监控，**关掉能省 200MB+** |
| `table-open-cache` | 2000 | 64 | 表缓存 |

并且给两个容器设了 `mem_limit`：MySQL 600M、后端 500M，**总量控制在 1.5G 以内**。

### 坑 2 · 交换分区（swap）

2G 内存 + Docker，建议开 2G swap 兜底。很多云服务器默认不开。

```bash
# 检查是否已有 swap
free -h
# 如果 Swap 那行全是 0，执行以下命令创建 2G
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# 设为开机自动挂载
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
# 验证
free -h
```

> 注意：swap 是兜底，不是解决方案。它的作用是内存不够时避免进程被杀，
> 但会变慢。如果你发现频繁用 swap，说明该升配置了。

### 坑 3 · 中文乱码（最隐蔽，已修复）

**实测发现的问题**：全新部署后，数据库里的中文是乱码——`声乐班` 存成了 `å£°ä¹ç`。

**根因**：MySQL 容器首次初始化时，客户端字符集不是 utf8mb4，
`schema.sql` 里的中文（课程名、老师名、性别枚举、默认值'在读'）
被按 latin1 解释，存成了双重编码。

**这个错误最坑的地方**：初始化**不报任何错**，只有读到数据才发现。
如果没实测全新部署，这个乱码会一直带到客户面前。

**修复**：`schema.sql` 开头加了 `SET NAMES utf8mb4;`（已提交）。
如果你用的是**旧版本的 schema.sql** 或者已经部署过，需要重建数据卷：

```bash
# ⚠️ 会清空数据，确认后再执行
docker-compose -f docker-compose.lowmem.yml down -v
docker-compose -f docker-compose.lowmem.yml up -d
```

**验证方法**：查数据库的原始字节，应该和右侧期望值一致：

```bash
docker exec sp-mysql mysql -uroot -p你的密码 student_platform \
  -e "SELECT id, HEX(name) hx FROM courses ORDER BY id;"
```

| 课程 | 期望的 HEX |
|---|---|
| 书法班 | `E4B9A6E6B395E78FAD` |
| 摄影班 | `E69184E5BDB1E78FAD` |
| 声乐班 | `E5A3B0E4B990E78FAD` |

如果查出的是 `C3A4C2B9C2A6...` 这类以 `C3` 开头的长串，说明是乱码，按上面重建。

### 坑 4 · 国内拉镜像慢

国内服务器访问 Docker Hub 经常超时。先配镜像加速器：

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me",
    "https://dockerproxy.net"
  ]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
# 验证
docker info | grep -A 5 "Registry Mirrors"
```

> 加速器地址会变。如果上面几个都失效，搜索「docker 镜像加速器 最新」找可用的。

### 实测内存占用（低配编排的效果）

已在真实环境验证过 `docker-compose.lowmem.yml`，内存占用如下：

| 容器 | 实际占用 | 限制 | 占用率 |
|---|---|---|---|
| sp-backend | **53.7 MB** | 500 MB | 10.7% |
| sp-mysql（**调参后**） | **135.4 MB** | 600 MB | 22.6% |
| 对比：mysql 8.4 未调参 | 485.2 MB | 无限制 | — |

**MySQL 从 485MB 降到 135MB，省了 350MB** —— 这对 2G 服务器是决定性的。
两个容器合计约 **190MB**，2核2G 跑起来很轻松。

运行时用这条命令随时查看：

```bash
docker stats --no-stream
```

---

## 二、安全组放行端口

在**云服务商控制台**（不是服务器里）配置安全组/防火墙规则。

以常见厂商为例，入口一般在「服务器实例 → 安全组 → 配置规则 → 入方向」：

| 端口 | 协议 | 用途 | 是否必须 |
|---|---|---|---|
| 22 | TCP | SSH 远程连接 | 必须 |
| 8888 | TCP | 宝塔面板 | 必须（否则进不去面板） |
| 80 | TCP | HTTP 访问网站 | 必须 |
| 443 | TCP | HTTPS | 暂时不用 |
| 8000 | TCP | 后端 API | **不要开**，由 Nginx 反代 |

> **重要**：8000 不要对公网开放。我们在 compose 里已经把它绑到 `127.0.0.1`，
> 外部本来就访问不到。安全组也不开，双保险。

**同时检查宝塔自己的防火墙**：宝塔面板 → 安全 → 放行 80 端口。宝塔的防火墙和
云服务商安全组是**两层**，都要放行。

---

## 三、上传代码

### 方式 A · 用 Git（如果有仓库访问权限）

```bash
cd /www/wwwroot
git clone https://github.com/nailin233/student-platform.git
cd student-platform
```

### 方式 B · 宝塔文件管理器上传（推荐给你）

1. 本地把项目打包，**排除大目录**：

```bash
# 在本地项目目录执行
tar czf app.tar.gz \
  --exclude=node_modules \
  --exclude=.venv \
  --exclude=.venv-linux \
  --exclude=frontend/dist \
  --exclude=.git \
  --exclude=.workbuddy \
  .
```

2. 宝塔面板 → 文件 → 进入 `/www/wwwroot` → 上传 `app.tar.gz`
3. 右键解压，得到一个 `student-platform` 目录（如果没有，解压后手动改名）

### 方式 C · scp 上传

```bash
# 在本地执行（Windows 用 Git Bash 或 PowerShell 都行）
scp app.tar.gz root@你的服务器IP:/www/wwwroot/
```

---

## 四、部署后端 + 数据库

### 4.1 进入项目目录，创建 .env

```bash
cd /www/wwwroot/student-platform

# 生成一个强密码（复制输出的密码）
openssl rand -base64 16

# 创建 .env
cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=把上面生成的密码粘贴到这里
EOF

# 确认写入
cat .env
```

> 这个 `.env` 只在服务器上用，**不要提交到 Git**（`.gitignore` 已经排除了）。

### 4.2 启动容器

```bash
docker-compose -f docker-compose.lowmem.yml up -d --build
```

如果你服务器上是 `docker compose`（子命令形式），把 `docker-compose` 换成 `docker compose`。

首次构建要装 Python 依赖、拉 MySQL 镜像，**在 2核2G 上大概 3-8 分钟**，耐心等。

### 4.3 检查启动状态

```bash
# 等 20 秒让 MySQL 初始化
sleep 20

# 看容器状态，两个都应该是 Up
docker-compose -f docker-compose.lowmem.yml ps

# 看后端日志
docker logs sp-backend --tail 20
```

后端日志出现 `Uvicorn running on http://0.0.0.0:8000` 就是成功了。

### 4.4 验证接口

```bash
curl http://127.0.0.1:8000/api/health
# 期望：{"status":"ok","message":"student platform backend is running"}

curl http://127.0.0.1:8000/api/dashboard/stats
# 期望：{"students":0,"courses":3,"teachers":3,"unpaid_amount":0.0}
```

> 全新部署时学员是 0，课程和老师各 3 条（来自 `schema.sql` 的种子数据）。

### 4.5 灌入演示数据（可选，已实测）

低配编排**没有对宿主机暴露 MySQL 端口**（安全设计），所以在宿主机直接跑
`seed_demo.py` 连不上。**正确方式是在后端容器里跑**：

```bash
cd /www/wwwroot/student-platform

# 把脚本拷进容器（容器内 /app 就是 backend 目录）
docker cp database/seed_demo.py sp-backend:/app/seed_demo.py

# 在容器内执行
docker exec sp-backend python /app/seed_demo.py

# 跑完删掉，保持容器干净
docker exec sp-backend rm -f /app/seed_demo.py
```

期望输出：

```
演示数据已就绪：学员 6 名，缴费流水 6 条，待收金额 ¥2120.00
  · 谭贵锋（男，22岁）书法班 / 王老师 — 在读
  · 李思颖（女，28岁）摄影班 / 李老师 — 在读
  · 陈美玲（女，35岁）声乐班 / 陈老师 — 在读
  · 韦建国（男，46岁）书法班 / 王老师 — 待缴费
  · 黄晓婷（女，19岁）摄影班 / 李老师 — 在读
  · 刘志强（男，52岁）声乐班 / 陈老师 — 结业
```

然后验证：

```bash
curl http://127.0.0.1:8000/api/dashboard/stats
# 期望：{"students":6,"courses":3,"teachers":3,"unpaid_amount":2120.0}
```

> 如果只想要空库（客户自己录入数据），跳过这一步即可。
> 全新部署的默认状态是学员 0、课程 3、老师 3。

---

## 五、构建前端

### 在服务器上构建

```bash
cd /www/wwwroot/student-platform/frontend

# 2核2G 构建时可能内存吃紧，加个限制防止 OOM
NODE_OPTIONS="--max-old-space-size=768" npm install
NODE_OPTIONS="--max-old-space-size=768" npm run build
```

> 如果构建时被杀（`Killed`），说明内存不够。两个办法：
> 1. 加大 swap（见第一节坑 2）
> 2. **在本机构建好再上传** `dist/` 目录（更省事，推荐）

### 或者本机构建后上传

```bash
# 本地执行
cd frontend
npm run build

# 上传 dist 到服务器
scp -r dist root@你的服务器IP:/www/wwwroot/student-platform/frontend/
```

---

## 六、宝塔配置网站

### 6.1 创建站点

1. 宝塔面板 → **网站** → **添加站点**
2. 填写：
   - 域名：**你的公网 IP**（没有域名就填 IP）
   - 根目录：`/www/wwwroot/student-platform/frontend/dist`
   - PHP 版本：**纯静态**
   - 数据库：不创建
3. 提交

> 如果填 IP 提示格式不对，可以先随便填个域名，创建后再去「网站设置 → 域名管理」改成 IP。

### 6.2 配置反向代理（关键一步）

> **先说明一件事**：前端代码**不用改任何一行**。已经确认过，所有接口请求
> 用的都是相对路径 `/api/...`（比如 `/api/students`、`/api/dashboard/stats`），
> 没有硬编码 `localhost:8000`。所以只要 Nginx 把 `/api/` 转发到后端，
> 前端就自动工作在服务器上。

1. 点该站点 → **设置** → **反向代理** → **添加反向代理**
2. 填写：

| 字段 | 值 |
|---|---|
| 代理名称 | `api` |
| 目标 URL | `http://127.0.0.1:8000` |
| 发送域名 | `$host` |

3. 提交

**这一步不做会怎样**：页面能打开，但**所有数据都加载不出来**。因为
`npm run build` 的产物是纯静态文件，本身没有代理能力，前端请求 `/api/...`
会打到 Nginx 自己身上，找不到就 404。

### 6.3 如果反向代理配不上（手动写配置）

宝塔的反向代理有时会有 bug。可以手动改 Nginx 配置：

站点设置 → **配置文件**，在 `server { }` 里确保有这一段：

```nginx
# API 反向代理
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}
```

保存后重载 Nginx：

```bash
nginx -t && nginx -s reload
# 宝塔的 nginx 路径
/www/server/nginx/sbin/nginx -t && /www/server/nginx/sbin/nginx -s reload
```

### 6.4 前端路由回退

如果刷新页面出现 404，需要在站点配置里加：

```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 七、验证部署

浏览器访问 `http://你的公网IP`，然后逐项检查：

- [ ] 登录页正常显示（不白屏）
- [ ] 能登录进工作台
- [ ] **工作台统计数据正常加载**（这一步能过，说明反代配对了）
- [ ] 学员列表能加载
- [ ] 能新增一个学员并在列表看到
- [ ] 两个 Excel 导出都能下载且能打开
- [ ] 中文无乱码

### 排查对照表

| 现象 | 原因 | 处理 |
|---|---|---|
| 页面打不开 | 80 端口没放行 | 检查云安全组 + 宝塔防火墙 |
| 页面能开但数据全空 | **反代没配** | 回到 6.2 配反向代理 |
| 502 Bad Gateway | 后端没起来 | `docker logs sp-backend` 看日志 |
| 中文乱码 | 字符集问题 | 确认连接串带 `?charset=utf8mb4` |
| 用一会就连不上数据库 | **OOM，MySQL 被杀** | `docker logs sp-mysql` 看是否被 kill；确认用了 lowmem 编排；加大 swap |
| 导出很慢/超时 | 2核2G 性能限制 | 正常现象，`proxy_read_timeout` 已设 120s |

### 查看内存使用

```bash
# 实时看容器资源占用
docker stats --no-stream

# 看系统内存
free -h
```

用 lowmem 编排时，MySQL 稳定在 **130-200MB**、后端 **50-80MB** 是正常的。
如果你看到 MySQL 又涨回 400MB+，说明跑的可能是默认的 `docker-compose.yml`
而不是 `docker-compose.lowmem.yml`。

---

## 八、转正式使用前必做

**如果只是练手，这一节可以跳过。** 但如果客户要真的用起来，以下是必须处理的：

| 项目 | 当前状态 | 必须改成 |
|---|---|---|
| MySQL 密码 | 已在 `.env` 里设强密码 ✅ | 保持，注意别泄露 |
| 后端端口 | 只绑 `127.0.0.1:8000` ✅ | 保持 |
| **登录鉴权** | **任意账号密码都能进** ❌ | 接入真实用户体系 + 密码哈希 |
| **HTTPS** | **无** ❌ | 必须上，否则密码明文传输 |
| **数据备份** | **无** ❌ | 加定时备份（见下） |
| CORS 白名单 | 只允许 localhost:5173 ❌ | 改成实际访问地址 |

### 数据备份

宝塔面板 → **计划任务** → 添加：

- 任务类型：Shell 脚本
- 任务名称：备份学员平台数据库
- 执行周期：每天 3:00
- 脚本内容：

```bash
mkdir -p /www/backup/db
docker exec sp-mysql mysqldump -uroot -p$(grep MYSQL_ROOT_PASSWORD /www/wwwroot/student-platform/.env | cut -d= -f2) student_platform > /www/backup/db/db_$(date +\%Y\%m\%d).sql
find /www/backup/db -name "db_*.sql" -mtime +7 -delete
```

### HTTPS（有域名之后）

有域名并备案后，宝塔可以一键申请证书：

网站 → 设置 → **SSL** → Let's Encrypt → 申请 → 开启「强制 HTTPS」。

---

## 九、日常运维

```bash
cd /www/wwwroot/student-platform

# 查看状态
docker-compose -f docker-compose.lowmem.yml ps

# 看日志
docker logs sp-backend --tail 50 -f      # 后端（Ctrl+C 退出）
docker logs sp-mysql --tail 50           # 数据库

# 重启后端
docker-compose -f docker-compose.lowmem.yml restart backend

# 停掉全部（保留数据）
docker-compose -f docker-compose.lowmem.yml down

# ⚠️ 停掉并删除数据（数据全丢，慎用）
docker-compose -f docker-compose.lowmem.yml down -v

# 代码更新后重新部署
git pull                                  # 或重新上传文件
docker-compose -f docker-compose.lowmem.yml up -d --build backend
cd frontend && npm run build              # 前端重新构建
```

---

## 十、常见问题

**Q：宝塔自带 MySQL，我又用 Docker 的 MySQL，冲突吗？**
A：不冲突。宝塔的 MySQL 装在系统里占 3306，我们的容器 MySQL **没有对宿主机暴露端口**，
只在 Docker 内网通信。两者互不干扰。但如果宝塔的 MySQL 没在用，建议停掉省内存
（宝塔面板 → 软件商店 → MySQL → 停止）。

**Q：2核2G 够用吗？**
A：跑这个 Demo 够用。目标是演示和小规模使用，不是高并发。如果发现经常 OOM，
先加大 swap，再考虑升到 2核4G。

**Q：没有域名，能上 HTTPS 吗？**
A：不能。证书必须绑定域名，IP 无法申请。这也是为什么小程序正式版用不了——
微信要求 HTTPS。练手阶段用 IP + HTTP 就行。

**Q：怎么改后端端口？**
A：改 `docker-compose.lowmem.yml` 里 backend 的 `ports`，比如 `127.0.0.1:9000:8000`，
同时记得改宝塔反向代理的目标地址。

**Q：怎么从外部连数据库看数据？**
A：把 `docker-compose.lowmem.yml` 里 mysql 的 `ports` 注释取消，改成
`127.0.0.1:3307:3306`（只允许本机连，不对公网暴露），然后
用 Navicat 通过 SSH 隧道连接。
