# 上线操作清单 · 49.233.204.148

> 这份是**给你这一台服务器**写的，IP 已经填好，照着从上往下做即可。
> 通用原理和排错见 `DEPLOY-BAOTA.md`。

服务器信息（已知）：

| 项 | 值 |
|---|---|
| 公网 IPv4 | `49.233.204.148` |
| 配置 | 2核2G |
| 域名 | 无（用 IP 访问） |
| 面板 | 宝塔已安装并打开 |
| 用途 | 练手 |

目标：浏览器打开 `http://49.233.204.148` 能看到学员管理平台并正常加载数据。

---

## 第 0 步 · 在腾讯云控制台放行端口（浏览器操作）

**这一步不做，后面全白搭。** 腾讯云的安全组和宝塔的防火墙是两层，都要开。

腾讯云控制台 → 你的服务器 → **安全组** → 配置规则 → **入方向** → 添加规则：

| 端口 | 协议 | 来源 | 说明 |
|---|---|---|---|
| 22 | TCP | 0.0.0.0/0 | SSH 登录 |
| 8888 | TCP | 0.0.0.0/0 | 宝塔面板（如果已经能打开面板，说明已放行） |
| 80 | TCP | 0.0.0.0/0 | **网站访问，必须有** |
| 443 | TCP | 0.0.0.0/0 | 备用，可先不加 |

> `8000` **不要放行**。后端只监听 `127.0.0.1`，外部访问不到是设计如此。

**宝塔侧**：宝塔面板 → 安全 → 确认 80 端口在放行列表里。

---

## 第 1 步 · 登录服务器，检查环境

用 SSH 登录（宝塔面板里也有「终端」可以直接用）：

```bash
# 看内存和 swap
free -h

# 看磁盘
df -h /

# 看 Docker 是否已装
docker --version

# 看 compose 是哪种形式
docker compose version || docker-compose --version
```

**判断标准：**

| 检查项 | 期望 | 不满足怎么办 |
|---|---|---|
| 内存 | ≥ 1800 MB | 见下方"加 swap" |
| swap | 不为 0 | 见下方"加 swap" |
| 磁盘可用 | ≥ 5 GB | 清理或换盘 |
| Docker | 已安装 | 执行 `curl -fsSL https://get.docker.com \| sh` 然后 `sudo systemctl enable --now docker` |
| compose | 有一种可用 | `sudo apt install -y docker-compose-plugin` |

**加 swap（2G 内存强烈建议）：**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # 确认 Swap 一行不是 0
```

**配置 Docker 镜像加速（国内服务器必须，否则拉镜像会卡死）：**

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
docker info | grep -A 5 "Registry Mirrors"
```

---

## 第 2 步 · 上传代码

推荐用宝塔文件管理器（比命令行直观）。

**在本机（你的 Windows）打包**，先排除大目录：

```bash
cd /j/student-platform-demo
tar czf app.tar.gz \
  --exclude=node_modules \
  --exclude=.venv \
  --exclude=.venv-linux \
  --exclude=frontend/dist \
  --exclude=.git \
  --exclude=.workbuddy \
  --exclude=_deploytest \
  .
```

> 如果你不想在服务器上装 Node 构建前端，也可以**在本地先构建好**，
> 然后把 `frontend/dist` 一起打包（去掉上面 `--exclude=frontend/dist` 那行）。
> 这样服务器上就跳过第 4 步，省内存也省时间。
> 本地构建命令：`cd frontend && npm install && npm run build`

**上传：**

1. 宝塔面板 → **文件** → 进入 `/www/wwwroot`
2. 上传 `app.tar.gz`
3. 右键 → 解压 → 得到一个目录（如果解压出来是散落的文件，手动新建
   `/www/wwwroot/student-platform` 再把文件移进去）

**最终目录应该是：**

```
/www/wwwroot/student-platform/
├── backend/
├── database/
├── frontend/
├── docker-compose.lowmem.yml
└── deploy.sh
```

---

## 第 3 步 · 一键部署

宝塔面板 → 终端（或 SSH）：

```bash
cd /www/wwwroot/student-platform
chmod +x deploy.sh
./deploy.sh
```

脚本会自动做完：环境检查 → 生成数据库密码 → 启动 MySQL 和后端 → 构建前端 →
打印后续宝塔操作步骤。

**首次运行时间**：2核2G 上大约 3-8 分钟（拉镜像 + 装 Python 依赖）。

**成功的样子**（关键几行）：

```
[完成] 后端已启动
[信息] 统计数据：{"students":0,"courses":3,"teachers":3,"unpaid_amount":0.0}
[完成] 中文编码正常
[完成] 前端构建完成：frontend/dist
```

> `students: 0` 是正常的——全新数据库还没有学员。课程和老师各有 3 条
> 种子数据。想灌演示数据见第 5 步。

**如果脚本中途报错**：把报错整段复制给我，别自己猜着改。

---

## 第 4 步 · 宝塔添加站点 + 反向代理

### 4.1 添加网站

宝塔面板 → **网站** → **添加站点**：

| 字段 | 填什么 |
|---|---|
| 域名 | `49.233.204.148` |
| 根目录 | `/www/wwwroot/student-platform/frontend/dist` |
| PHP 版本 | **纯静态** |
| 数据库 | 不创建 |

> 如果填 IP 提示格式错误，先随便填个域名（如 `demo.local`），
> 创建后到「网站设置 → 域名管理」改成 IP。

### 4.2 配置反向代理（**最关键，漏了就没数据**）

点该站点 → **设置** → **反向代理** → **添加反向代理**：

| 字段 | 填什么 |
|---|---|
| 代理名称 | `api` |
| 目标 URL | `http://127.0.0.1:8000` |
| 发送域名 | `$host` |

**为什么必须做**：前端打包后是纯静态文件，没有转发能力。前端请求
`/api/students` 会打到 Nginx 自己身上，没人转发就 404，页面打开但一片空白。

前端代码**不用改**——所有请求都是相对路径 `/api/...`，代理一配就通。

### 4.3 如果宝塔反向代理配不上（兜底）

站点 → 设置 → **配置文件**，在 `server { }` 里加上：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}

location / {
    try_files $uri $uri/ /index.html;
}
```

保存后重载：

```bash
/www/server/nginx/sbin/nginx -t && /www/server/nginx/sbin/nginx -s reload
```

---

## 第 5 步 · 灌入演示数据（可选）

想让页面看起来有内容（而不是空表），执行：

```bash
cd /www/wwwroot/student-platform

docker cp database/seed_demo.py sp-backend:/app/seed_demo.py
docker exec sp-backend python /app/seed_demo.py
docker exec sp-backend rm -f /app/seed_demo.py
```

期望输出：

```
演示数据已就绪：学员 6 名，缴费流水 6 条，待收金额 ¥2120.00
```

验证：

```bash
curl http://127.0.0.1:8000/api/dashboard/stats
# 期望：{"students":6,"courses":3,"teachers":3,"unpaid_amount":2120.0}
```

---

## 第 6 步 · 访问验证

浏览器打开 **`http://49.233.204.148`**，逐项确认：

- [ ] 页面正常显示，不白屏
- [ ] 能进工作台
- [ ] **工作台统计数字正常显示**（过了这关说明反代配对了）
- [ ] 学员列表能加载
- [ ] 中文无乱码（课程显示"书法班/摄影班/声乐班"，不是 `å£°ä¹ç`）
- [ ] 能新增一个学员，并在列表里看到
- [ ] 两个 Excel 导出能下载且能打开

### 出问题看这里

| 现象 | 原因 | 处理 |
|---|---|---|
| 浏览器打不开，转圈或超时 | 80 端口没放行 | 回第 0 步检查云安全组 + 宝塔防火墙 |
| 页面能开但数据全空 | 反代没配 | 回第 4.2 步 |
| 502 Bad Gateway | 后端没起来 | `docker logs sp-backend --tail 50` |
| 中文显示乱码 | 数据卷是旧编码 | `docker-compose -f docker-compose.lowmem.yml down -v` 后重跑 `./deploy.sh`（会清数据） |
| 用一会儿就连不上库 | 内存不足 MySQL 被杀 | `free -h` 看 swap；`docker stats` 看占用；确认用的是 lowmem 编排 |

---

## 部署完成后常用命令

```bash
cd /www/wwwroot/student-platform

# 看容器状态
docker-compose -f docker-compose.lowmem.yml ps

# 看内存占用
docker stats --no-stream

# 看后端日志（Ctrl+C 退出）
docker logs sp-backend --tail 50 -f

# 重启后端
docker-compose -f docker-compose.lowmem.yml restart backend

# 停止服务（数据保留）
docker-compose -f docker-compose.lowmem.yml down

# 改代码后重新部署
docker-compose -f docker-compose.lowmem.yml up -d --build backend
cd frontend && npm run build && cd ..
```

---

## 关于 IPv6 的说明

你之前给过服务器 IPv6：`2402:4e00:c050:e00:ae20:33de:38b8:0`

**建议直接用 IPv4 `49.233.204.148`**，原因：

- 很多家庭宽带和手机 4G/5G 访问 IPv6 需要特定条件，不一定通
- 浏览器访问 IPv6 地址必须写成 `http://[2402:4e00:...]` 带方括号，容易出错
- 宝塔添加站点填 IPv6 可能不被识别

IPv4 直连，简单可靠。

---

## 练手阶段的已知限制

这个 Demo 目前**不要给客户正式使用**，因为：

| 项目 | 现状 | 影响 |
|---|---|---|
| 登录鉴权 | 任意账号密码都能进 | 无访问控制 |
| HTTPS | 无 | 密码明文传输 |
| 数据备份 | 无 | 数据丢失无法恢复 |

自己练手完全够用。等要给客户用时，对照 `DEPLOY-BAOTA.md` 第八节升级。
