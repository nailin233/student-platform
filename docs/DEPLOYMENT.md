# 部署说明 · 学员管理平台 Demo V1.0

> 目标环境：Linux 服务器（Ubuntu 22.04 / Debian 12 验证）
> 部署方式：Docker Compose（MySQL + 后端）+ Nginx（前端静态文件 + 反向代理）

---

## 零、先理解部署架构（很重要）

本地开发时，前端的 `/api` 请求由 **Vite 开发服务器代理**转发给后端。但 `npm run build`
产出的 `dist/` 是纯静态文件，**本身没有代理能力**。

所以生产部署必须解决一个问题：**浏览器访问 `你的域名/api/xxx` 时，谁把它转发到后端？**

答案是 **Nginx 反向代理**。整体架构：

```
浏览器
  │
  ├── GET /            → Nginx → 前端静态文件（dist/）
  └── GET /api/xxx     → Nginx → 反代到 http://127.0.0.1:8000（后端容器）
                                                     │
                                                     └── MySQL 容器（内网）
```

> ⚠️ 如果只把 `dist/` 丢进 Nginx 却不配 `/api` 反代，页面能打开但**所有数据都加载不出来**。
> 这是最常见的部署失败原因。

---

## 一、服务器准备

### 1.1 安装 Docker

```bash
# Ubuntu / Debian 一键安装
curl -fsSL https://get.docker.com | sh

# 启动并设为开机自启
sudo systemctl enable --now docker

# 验证
docker --version
docker compose version     # 需要 v2；若报错见下方「命令差异」说明
```

**命令差异说明**：新版 Docker 内置 `docker compose`（子命令，空格）；旧版是独立的
`docker-compose`（连字符）。两者用法一致，本文统一写 `docker-compose`，若你的环境是
子命令形式，把连字符换成空格即可。

### 1.2 安装 Nginx

```bash
sudo apt update && sudo apt install -y nginx
sudo systemctl enable --now nginx
```

### 1.3 安装 Node.js（仅用于在服务器上构建前端）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 应为 v20.x
```

> **也可以在本机构建好前端**，把 `dist/` 传到服务器，省掉服务器装 Node。
> 两种方式都行，见下方「三、构建前端」。

### 1.4 放行端口

```bash
sudo ufw allow 80/tcp
sudo ufw allow 22/tcp
```

---

## 二、部署后端 + 数据库

### 2.1 上传代码

```bash
# 方式一：git clone
cd /opt
sudo git clone https://github.com/nailin233/student-platform.git student-platform
sudo chown -R $USER:$USER /opt/student-platform

# 方式二：本地打包上传（推荐，不依赖仓库权限）
# 本地执行： tar czf app.tar.gz --exclude=node_modules --exclude=.venv --exclude=.venv-linux .
# 上传后解压到 /opt/student-platform
```

### 2.2 检查 docker-compose.yml

```bash
cd /opt/student-platform
cat docker-compose.yml
```

关键点：

| 配置 | 说明 |
|---|---|
| `mysql` 端口 `3307:3306` | 宿主 3307 → 容器 3306。**无需对外暴露**，仅本机后端使用 |
| `backend` 端口 `8000:8000` | 后端服务，供 Nginx 反代 |
| `DATABASE_URL` 里的主机名 `mysql` | 这是 **Compose 内网服务名**，不是 `localhost`。容器间通信靠它 |
| `./database/schema.sql` | 挂载到 MySQL 初始化目录，**只在数据卷首次创建时执行** |
| `mysql_data` 数据卷 | 数据持久化在这里。`docker-compose down` 不会删数据，`down -v` 会 |

### 2.3 启动

```bash
cd /opt/student-platform
docker-compose up -d --build
```

首次构建约 1-3 分钟（要拉取 mysql:8.4 镜像、装 Python 依赖）。

### 2.4 验证后端

```bash
# 等 15 秒让 MySQL 初始化完成
sleep 15

# 健康检查
curl http://127.0.0.1:8000/api/health
# 期望：{"status":"ok","message":"student platform backend is running"}

# 数据检查
curl http://127.0.0.1:8000/api/dashboard/stats
# 期望：{"students":0,"courses":3,"teachers":3,"unpaid_amount":0.0}
# 注意：全新部署时学员为 0，课程/老师各 3 条（来自 schema.sql 种子数据）
```

### 2.5 灌入演示数据（如果需要）

```bash
cd /opt/student-platform/backend
python3 -m venv .venv-linux
source .venv-linux/bin/activate
pip install -r requirements.txt
python ../database/seed_demo.py
```

**或者**直接通过接口逐条录入，或者用管理页面手动加。

> 注意：`seed_demo.py` 走的是 `backend/.env` 的连接串，默认指向
> `127.0.0.1:3307`。服务器上 MySQL 端口映射是 3307，所以能连上。

---

## 三、构建前端

### 方式 A · 在服务器上构建（推荐）

```bash
cd /opt/student-platform/frontend
npm install
npm run build
# 产物在 /opt/student-platform/frontend/dist
```

### 方式 B · 本机构建后上传

```bash
# 本地执行
cd frontend
npm run build
# 把 dist/ 整个传到服务器
scp -r dist/ user@服务器IP:/opt/student-platform/frontend/
```

> 两种方式产出的文件完全相同。前端构建**不需要**配置后端地址——
> 因为它统一请求相对路径 `/api/...`，由 Nginx 代理决定实际去向。

---

## 四、配置 Nginx

### 4.1 创建站点配置

```bash
sudo nano /etc/nginx/sites-available/student-platform
```

写入（**把 `你的域名或IP` 替换成实际值**）：

```nginx
server {
    listen 80;
    server_name 你的域名或IP;

    # 前端静态文件
    root /opt/student-platform/frontend/dist;
    index index.html;

    # 前端路由：刷新子路径时回退到 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理 —— 这一段是部署成功的关键
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Excel 导出可能较慢，放宽超时
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

### 4.2 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/student-platform /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default     # 移除默认站点，避免冲突
sudo nginx -t                                    # 检查语法，应显示 syntax is ok
sudo systemctl reload nginx
```

### 4.3 验证

浏览器访问 `http://服务器IP`，应能看到登录页，且**工作台能加载出统计数据**。

- 页面能打开但数据加载不出来 → 检查 `location /api/` 配置和 `proxy_pass` 地址
- 502 Bad Gateway → 后端没起来，`docker-compose ps` 查看状态

---

## 五、日常运维命令

```bash
cd /opt/student-platform

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f backend      # 后端日志
docker-compose logs -f mysql        # 数据库日志

# 重启后端
docker-compose restart backend

# 代码更新后重新部署
git pull
docker-compose up -d --build backend
cd frontend && npm run build && sudo systemctl reload nginx

# 停止（保留数据）
docker-compose down

# 停止并删除数据（⚠️ 危险，会清空所有数据）
docker-compose down -v
```

---

## 六、数据库备份与恢复

### 备份

```bash
# 备份到文件
docker exec student-platform-demo-mysql-1 \
  mysqldump -uroot -proot student_platform > backup_$(date +%Y%m%d).sql
```

### 恢复

```bash
docker exec -i student-platform-demo-mysql-1 \
  mysql -uroot -proot student_platform < backup_20260914.sql
```

### 建议

演示环境可以手工备份。若正式使用，建议加个 cron 每天自动备份：

```bash
# crontab -e 添加（每天凌晨 3 点备份，保留 7 天）
0 3 * * * cd /opt/student-platform && docker exec student-platform-demo-mysql-1 mysqldump -uroot -proot student_platform > /opt/backup/db_$(date +\%Y\%m\%d).sql && find /opt/backup -name "db_*.sql" -mtime +7 -delete
```

---

## 七、安全加固（正式使用前必做）

Demo 版本为了方便演示，有几处是**不安全**的默认配置，正式上线必须改：

| 项目 | 当前值 | 应改为 |
|---|---|---|
| MySQL root 密码 | `root` | 强密码，并改 `docker-compose.yml` 与 `.env` |
| 后端 8000 端口 | 对宿主暴露 | 只监听 `127.0.0.1:8000:8000`，仅 Nginx 可访问 |
| MySQL 3307 端口 | 对宿主暴露 | 删掉 `ports` 段，只在 Compose 内网通信 |
| CORS | 只允许 `localhost:5173` | 改成实际域名，见 `backend/main.py` |
| 登录 | 固定账号、无后端校验 | 接入真实用户体系 + 密码哈希 + 会话管理 |
| HTTPS | 无 | 上证书（见下） |

### 上 HTTPS（Let's Encrypt，免费）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
# 自动签发证书并改好 Nginx 配置，且自动续期
```

> 注意：微信小程序的**正式版**要求后端必须 HTTPS。Demo 阶段用开发者工具即可，
> 无需 HTTPS。但如果要在真机预览小程序，后端地址必须是 HTTPS 或局域网内网地址。

---

## 八、常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面打开但数据全空 | 未配 Nginx `/api/` 反代。这是最高频问题 |
| 502 Bad Gateway | 后端未启动或崩溃，`docker-compose logs backend` 看日志 |
| 后端启动报连不上数据库 | MySQL 初始化需要时间。compose 里 `depends_on` 只保证容器启动，不保证 MySQL 就绪。等 15 秒后 `docker-compose restart backend` |
| 中文显示成乱码或问号 | 检查数据库字符集是否为 `utf8mb4`；`schema.sql` 里已指定，若为旧数据卷需重建 |
| 端口 80 被占用 | `sudo lsof -i:80` 查占用进程，停掉（常见是 Apache 或旧 Nginx 配置） |
| `docker-compose: command not found` | 用 `docker compose`（子命令形式）；或 `sudo apt install docker-compose-plugin` |
| 修改代码后不生效 | 后端要 `--build` 重建镜像；前端要重新 `npm run build` |
| schema 改动不生效 | `schema.sql` 只在**数据卷首次创建**时执行。改表结构需要 `docker-compose down -v` 重建（会清空数据） |

---

## 九、交付检查清单

部署完成后逐项确认：

- [ ] `docker-compose ps` 中 mysql 与 backend 都是 Up
- [ ] `curl http://127.0.0.1:8000/api/health` 返回 ok
- [ ] `curl http://127.0.0.1:8000/api/dashboard/stats` 返回统计数据
- [ ] 浏览器能打开登录页
- [ ] 登录后工作台统计数据正常显示（**证明反代配对了**）
- [ ] 学员列表能加载
- [ ] 搜索功能正常
- [ ] 能新增一个学员并在列表看到
- [ ] 两个 Excel 导出都能下载且文件能正常打开
- [ ] 中文无乱码（页面、导出文件都要检查）
- [ ] `nginx -t` 通过
- [ ] 服务器重启后服务能自动恢复（`restart: unless-stopped` 已配置）
