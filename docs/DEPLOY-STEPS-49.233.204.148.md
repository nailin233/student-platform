# 上线完成记录 · 49.233.204.148

> **状态：已部署完成并验证通过。** 访问地址 **http://49.233.204.148**
>
> 本文记录真实环境情况、实际采用的方案、以及日常运维命令。
> 原文档里关于「宝塔 8888 端口」「服务器上构建前端」的假设**与实际不符**，已按实况修正。

---

## 一、访问信息

| 项 | 值 |
|---|---|
| 网站地址 | **http://49.233.204.148** |
| 宝塔面板 | `http://49.233.204.148:10706` ← **注意端口是 10706，不是默认 8888** |
| SSH | `ssh ubuntu@49.233.204.148` |
| 项目目录 | `/www/wwwroot/student-platform` |

**⚠️ 宝塔面板 10706 目前外网访问不了** —— 腾讯云安全组没放行这个端口。
需要在腾讯云控制台「安全组 → 入方向」加一条 `10706` 的 TCP 放行规则才能打开面板。

---

## 二、真实环境（实测）

| 项 | 实际情况 | 与原假设的差异 |
|---|---|---|
| 系统 | Ubuntu 24.04.4 LTS，内核 6.8.0 | — |
| 配置 | 2 核 / 1.9G 内存 / 50G 磁盘（用 7.9G） | — |
| swap | **1.9G，已启用** | 原以为要手动加，实际腾讯云已配好 |
| Docker | 29.1.3，服务运行中 | — |
| compose | **`docker compose`（子命令）v5.5.1** | ⚠️ **没有 `docker-compose`**（连字符版不存在） |
| 镜像加速 | **已配好且实测可用** | 原以为要手动配 |
| 宝塔 | 13.0.0，端口 **10706**，进程在跑 | ⚠️ 不是 8888 |
| 宝塔的 nginx | **未安装**（`/www/server/nginx` 不存在） | ⚠️ 原方案要"用宝塔 nginx 托管前端"，不可行 |
| 80 端口 | **Ubuntu 原生 nginx 1.24.0**（`/usr/sbin/nginx`） | ⚠️ 不是宝塔的 nginx |
| Node.js | **未安装** | ⚠️ 原方案要"服务器上 npm run build"，不可行 |
| Python | 3.12.3（系统自带，无 pip3） | — |
| git | 2.43.0 | — |
| ufw | 已启用，放行 20/21/22/80/443/888/8888/10706/39000-40000 | — |
| 公网出口 | 可通（npm registry / GitHub / 腾讯云镜像均可达） | — |
| Docker Hub 直连 | **不通**，但**走镜像加速器可以拉镜像** | 已实测 `docker pull` 成功 |

---

## 三、实际采用的架构

因为「宝塔没装 nginx」+「服务器没有 Node」，方案调整为：

```
公网用户
   │  http://49.233.204.148
   ↓
┌──────────────────────────────────────────────┐
│  Ubuntu 原生 nginx（/usr/sbin/nginx，占 80）  │
│  站点配置 /etc/nginx/sites-available/         │
│           student-platform                    │
│  ├── /            → /www/wwwroot/student-platform/frontend/dist  │
│  └── /api/        → 反代 127.0.0.1:8000       │
└───────────────────┬──────────────────────────┘
                    ↓
         Docker 容器（127.0.0.1:8000）
         ├── sp-backend   后端 FastAPI
         └── sp-mysql     数据库（不暴露端口，仅内网）
```

**关键改动（相对原计划）**：

1. **前端不在服务器构建** —— 服务器没有 Node。改为**本机 `npm run build` 后上传 `frontend/dist`**。
2. **用 Ubuntu 原生 nginx**，不装宝塔的 nginx —— 装了会抢 80 端口。
3. **默认站点已停用** —— 移除了 `/etc/nginx/sites-enabled/default` 软链
   （原文件仍在 `sites-available/`，要恢复执行
   `sudo ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default`）。

---

## 四、⚠️ 重要：不要在宝塔里点「添加站点」

宝塔面板 → 网站 → 添加站点，会触发**安装宝塔自己的 nginx/MySQL/PHP**，
而宝塔的 nginx 会尝试占用 80 端口，**与现在跑着的 Ubuntu nginx 直接冲突**。

**当前架构下，宝塔只当「文件管理器 + 终端」用**，不参与网站服务。

改站点配置请直接改 `/etc/nginx/sites-available/student-platform`，然后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 五、部署结果验证（实测）

### 5.1 接口层（curl）

| 检查项 | 结果 |
|---|---|
| 公网首页 | HTTP 200，`<title>学员管理平台 · 工作台</title>` ✅ |
| 静态资源 | `/assets/index-DxDm05li.js` 686676 字节，HTTP 200 ✅ |
| `/api/health` | `{"status":"ok","message":"student platform backend is running"}` ✅ |
| `/api/dashboard/stats` | `{"students":6,"courses":3,"teachers":3,"unpaid_amount":2120.0}` ✅ |
| 中文编码 | 课程名 `声乐班 / 摄影班 / 书法班`、学员姓名全部正常 ✅ |
| 容器状态 | sp-backend、sp-mysql 均 Up ✅ |
| 内存占用 | sp-backend **55.6MB**、sp-mysql **189.4MB**，合计约 **245MB** ✅ |

**中文编码这个坑在真实全新环境验证通过了** —— `schema.sql` 开头的
`SET NAMES utf8mb4;` 确实解决了双重编码问题（读和写都正常）。

### 5.2 浏览器层（真实 Chromium 渲染 + 交互）

跑了一遍完整演示流程，逐页目视确认：

| 步骤 | 结果 |
|---|---|
| 登录页 | 渲染正常，左蓝右白双栏、品牌区、登录卡片齐全 ✅ |
| 登录（任意账号密码可进） | 跳转 `#dashboard` ✅ |
| 管理员工作台 | 6 / 3 / 3 / ¥2120.00 四个数字正确 ✅ |
| 学员管理表格 | 6 行数据、状态标签、`详情 编辑 删除` 按钮全部渲染 ✅ |
| 学员详情弹窗 | 16 个 PRD 字段全部显示（含紧急联系人、缴费方式、备注）✅ |
| 课程管理 / 老师管理 | 表格与操作列正常 ✅ |
| 搜索 | 按姓名「刘」→ 1 条；按电话「1877」→ 1 条；清空 → 恢复 6 条 ✅ |
| 编辑弹窗回填 | 11 个输入框 + 5 个下拉框全部正确回填，未泄漏 `id`/`created_at` ✅ |
| Excel 导出（两个） | HTTP 200，xlsx 内容正确，**缴费时间已格式化为日期** ✅ |
| 视口 1366 / 1440 | 表格 10 列全部可见，无截断、无横向滚动 ✅ |
| 视口 1152 | 出现横向滚动条（兜底），列仍可全部看到 ✅ |

浏览器验证过程中发现并修复了 3 个问题，见下一节。

---

## 五之二、本轮浏览器验证发现并修复的问题

这三个都是**只有真的用浏览器打开才会暴露**的问题，接口层完全测不出来。

### 问题 1 · 导出 Excel 的「缴费时间」显示成一串数字（严重）

**现象**：导出的 xlsx 里，`缴费时间` 列存的是 Excel 序列号 `46272.41666666666`，
不是 `2026-09-07 10:00:00`。

**根因**：`backend/export_service.py` 直接把 `datetime` 塞进单元格，
**从未设置单元格的 `number_format`**。openpyxl 把它存成数字，单元格格式是
默认的 General，Excel 就按数字显示。

> 排查关键：`numFmt 164 = yyyy-mm-dd h:mm:ss` 是 openpyxl 默认模板自带的，
> 看到它别以为格式已经生效。要看**单元格引用的样式 `s=` 指向哪个 xf** ——
> 当时是 `s="1"`（General），不是 `s="2"`（日期）。

**修复**：新增 `_format_datetime_column(ws, col)`，给指定列的 datetime
单元格显式设 `number_format = 'yyyy-mm-dd hh:mm:ss'`。
顺手加了 `_polish()`：表头加粗、冻结首行、按内容自适应列宽（中文按 2 字符宽计）。

**影响范围**：`导出学员`（第 10 列）与 `导出缴费`（第 5 列）**两个都要改**。

### 问题 2 · 学员表格「上课时间」被截断（中）

**现象**：显示成 `周三 19:00-21...`。对中老年用户就是看不全时间。

**根因**：列宽给 132px，实测 `周三 19:00-21:00` 文字宽 126px，
扣除单元格左右各 12px 内边距后内容区只剩 120px → 差 6px。

**修复**：列宽改 160px（留 10px 余量，防不同机器字体渲染差异），
空间从「性别/所选课程」匀出（这两列只需容纳表头宽度）。

### 问题 3 · 窄屏下「应缴金额」「状态」被操作列永久遮住（严重）

**现象**：视口窄于约 1348px 时，表格里看不到 `应缴金额` 和 `状态` 两列，
而且**没有滚动条可以划出来** —— 数据等于永久不可见。

**根因**：`操作` 列是 `fixed: 'right'`（吸右），它渲染在中间列**之上**。
表格需要 996px，容器只有 800px 时，被吸右列盖住的部分既看不到也滚不出来。

> 这个坑的排查要点：不能只量 `table` 元素的 `scrollWidth > clientWidth`
> —— 表格自己不是滚动容器，要沿 `parentElement` 往上找真正的滚动父级。

**修复**：给 `n-data-table` 加 `:scroll-x="996"`（值 = 列宽合计）。
宽屏下外观完全不变，窄屏出现横向滚动条，数据永远可达。
**课程/老师两个表格同配置，但列少、窄屏能自然收缩，实测不需要改。**

---

## 六、日常运维

```bash
cd /www/wwwroot/student-platform

# 容器状态
sudo docker compose -f docker-compose.lowmem.yml ps

# 实时资源占用
sudo docker stats --no-stream

# 后端日志（Ctrl+C 退出）
sudo docker logs sp-backend --tail 50 -f

# MySQL 日志
sudo docker logs sp-mysql --tail 50

# 重启后端
sudo docker compose -f docker-compose.lowmem.yml restart backend

# 停止全部（数据保留）
sudo docker compose -f docker-compose.lowmem.yml down

# ⚠️ 停止并删除数据（数据全丢）
sudo docker compose -f docker-compose.lowmem.yml down -v
```

> **注意**：这台机器上必须用 `docker compose`（中间是空格），
> 不能写 `docker-compose` —— 连字符版本没装。

### 重启服务器后会自动恢复吗？

容器默认随 Docker 服务自启，nginx 是 systemd 服务（已 enabled）。
如果不放心，服务器重启后执行一次：

```bash
cd /www/wwwroot/student-platform && sudo docker compose -f docker-compose.lowmem.yml up -d
```

---

## 七、更新代码的流程

因为前端要在本机构建，更新流程是：

```bash
# ── 1. 本机构建前端 ──
cd frontend && npm run build

# ── 2. 本机打包（注意必须排除 venv，否则包会从 400KB 涨到 31MB）──
cd ..
tar czf _sp_pkg.tar.gz \
  --exclude='./node_modules' --exclude='*/node_modules' \
  --exclude='*/.venv' --exclude='*/.venv/*' \
  --exclude='*/.venv-linux' --exclude='*/.venv-linux/*' \
  --exclude='*/__pycache__' --exclude='*.pyc' \
  --exclude='./.git' --exclude='./.workbuddy' --exclude='./_*' \
  --exclude='*.docx' .

# ── 3. 上传 ──
scp -i ~/.ssh/sp_deploy _sp_pkg.tar.gz ubuntu@49.233.204.148:/tmp/

# ── 4. 服务器解压并重启 ──
ssh -i ~/.ssh/sp_deploy ubuntu@49.233.204.148
sudo tar xzf /tmp/_sp_pkg.tar.gz -C /www/wwwroot/student-platform
sudo chown -R ubuntu:ubuntu /www/wwwroot/student-platform
cd /www/wwwroot/student-platform
sudo docker compose -f docker-compose.lowmem.yml up -d --build backend   # 后端改了才需要
# nginx 无需重载（静态文件直接生效）
```

> ⚠️ **打包时 `.venv` 的排除规则必须写 `*/.venv`**。
> 只写 `./.venv` 排不掉 `backend/.venv`（本地虚拟环境，166MB），
> 包会变成 31MB 而不是 400KB。

### 只改了少量文件时：走增量更新（快得多）

全量打包再解压没必要。只传动过的那几个文件即可：

```bash
# ── 只改前端 ──
cd frontend && npm run build && cd ..
tar czf _fe.tar.gz frontend/dist
scp -i ~/.ssh/sp_deploy _fe.tar.gz ubuntu@49.233.204.148:/tmp/
ssh -i ~/.ssh/sp_deploy ubuntu@49.233.204.148 \
  'sudo bash -c "rm -rf /www/wwwroot/student-platform/frontend/dist/assets && \
   mkdir -p /www/wwwroot/student-platform/frontend/dist/assets && \
   tar xzf /tmp/_fe.tar.gz -C /www/wwwroot/student-platform"'
# nginx 无需重载，静态文件直接生效
```

```bash
# ── 只改后端某个 .py ──
tar czf _upd.tar.gz backend/export_service.py
scp -i ~/.ssh/sp_deploy _upd.tar.gz ubuntu@49.233.204.148:/tmp/
ssh -i ~/.ssh/sp_deploy ubuntu@49.233.204.148 \
  'sudo tar xzf /tmp/_upd.tar.gz -C /www/wwwroot/student-platform && \
   cd /www/wwwroot/student-platform && \
   sudo docker compose -f docker-compose.lowmem.yml up -d --build backend'
```

> **后端重建很快（实测 10 秒）**：`Dockerfile` 是
> `COPY requirements.txt` → `pip install` → `COPY . .` 的分层写法，
> 只要 `requirements.txt` 没变，`pip install` 那一层就命中缓存，
> 只有最后的 `COPY . .` 重跑。**所以不要因为"重建慢"而用 `docker cp`
> 偷偷替换容器里的文件** —— 那样镜像和容器会不一致，容器一重建修复就丢了。

> ⚠️ **上传后要在解压前后用 md5 校验**。中途断流会产生一个看起来正常
> 但内容残缺的包。

---

## 八、重置演示数据

```bash
cd /www/wwwroot/student-platform
sudo docker cp database/seed_demo.py sp-backend:/app/seed_demo.py
sudo docker exec sp-backend python /app/seed_demo.py
sudo docker exec sp-backend rm -f /app/seed_demo.py
```

脚本可重复执行，结果稳定为：学员 6 / 课程 3 / 老师 3 / 待收 ¥2120.00。

---

## 九、练手阶段的已知限制

**不要给客户正式使用**，以下问题必须处理：

| 项目 | 现状 | 风险 |
|---|---|---|
| 登录鉴权 | 任意账号密码都能进 | 无访问控制 |
| HTTPS | 无（IP 没法申请证书） | 密码明文传输 |
| 数据备份 | 无 | 数据丢失不可恢复 |
| MySQL 密码 | 已随机生成，存在 `.env`（权限 600） | 注意别泄露 |

有域名并备案后可以上 HTTPS；备份脚本见 `DEPLOY-BAOTA.md` 第八节。

---

## 十、出问题排查

| 现象 | 原因 | 处理 |
|---|---|---|
| 浏览器打不开 | 80 端口被拦 | 检查腾讯云安全组 + `sudo ufw status` |
| 502 Bad Gateway | 后端容器挂了 | `sudo docker logs sp-backend --tail 50` |
| 页面能开但数据全空 | nginx 反代丢了 | 检查站点配置里有 `location /api/` |
| 中文乱码 | 数据卷是旧编码 | `down -v` 后重新 `up -d`（会清数据） |
| 用一会儿连不上库 | 内存不足 MySQL 被杀 | `free -h` 看 swap；`docker stats` 看占用 |
| 宝塔面板打不开 | 安全组没放行 10706 | 腾讯云控制台加放行规则 |
