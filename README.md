# 培训机构学员管理平台 · Demo V1.0

一个面向中小型培训机构的学员管理演示系统。覆盖**管理员维护课程/老师 → 学员报名 → 后台出现记录 → 管理员查询、修改、导出**的完整闭环。

> **本项目是用于客户演示的 MVP，不是正式商业版本。**
> 部分能力（在线支付、真实鉴权、权限体系）为演示效率做了简化，详见文末「Demo 边界」。

---

## 目录

- [功能一览](#功能一览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [目录结构](#目录结构)
- [演示数据](#演示数据)
- [微信小程序](#微信小程序)
- [Docker 部署](#docker-部署)
- [相关文档](#相关文档)
- [Demo 边界](#demo-边界)
- [常见问题](#常见问题)

---

## 功能一览

### 管理端（Web）

| 模块 | 能力 |
|---|---|
| 登录 | 入口校验（演示版不做真实鉴权） |
| 工作台 | 学员数 / 课程数 / 老师数 / 待收金额 四项统计 |
| 学员管理 | 新增、修改、删除、详情、按姓名/手机号搜索、分页 |
| 课程管理 | 新增、修改、删除 |
| 老师管理 | 新增、修改、删除 |
| Excel 导出 | 学员信息（15 列）、缴费信息（6 列） |

### 学员端（微信小程序）

| 页面 | 能力 |
|---|---|
| 课程 | 课程列表、下拉刷新、课程详情 |
| 报名 | 填写资料、表单校验、防重复提交 |
| 老师 | 师资团队、点击拨号 |
| 我的 | 个人信息、报名记录、清空记录 |

**学员字段**覆盖完整 PRD 要求：

- 核心字段：姓名、性别、年龄、联系电话、所选课程、任课老师、上课时间
- 扩展字段：紧急联系人、紧急联系电话、缴费时间、缴费金额、学制、备注

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3（`<script setup>`）+ Naive UI 2.45 + Vite |
| 后端 | FastAPI + Pydantic + SQLAlchemy |
| 数据库 | MySQL 8.4（utf8mb4） |
| 小程序 | 微信小程序原生开发 |
| 部署 | Docker Compose + Nginx |
| Excel | openpyxl |

---

## 快速开始

### 前置要求

- Docker Desktop（用于 MySQL）
- Python 3.11+
- Node.js 18+

### 步骤 1 · 启动数据库

```bash
# 在项目根目录
docker-compose up -d mysql
```

MySQL 会监听宿主的 **3307** 端口（不是默认的 3306，避免与本机已有 MySQL 冲突）。
首次启动会自动执行 `database/schema.sql` 建表并写入课程/老师种子数据。

### 步骤 2 · 启动后端

```bash
cd backend

# 创建虚拟环境
python -m venv .venv

# Windows
.\.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

验证：访问 http://127.0.0.1:8000/api/health

- 接口文档（Swagger）：http://127.0.0.1:8000/docs

### 步骤 3 · 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 **http://localhost:5173**

**登录**：工作邮箱与密码随意填写非空值即可（演示版不做真实鉴权）。

### 步骤 4 · 灌入演示数据

```bash
cd backend
./.venv/Scripts/python.exe ../database/seed_demo.py     # Windows
# python ../database/seed_demo.py                       # macOS / Linux
```

输出「学员 6 名，缴费流水 6 条，待收金额 ¥2120.00」即为成功。

---

## 目录结构

```
student-platform-demo/
├── backend/                    后端服务
│   ├── main.py                 全部 API 路由与 Pydantic 模型
│   ├── database.py             数据库连接（读 .env 的 DATABASE_URL）
│   ├── student_repository.py   学员数据访问层
│   ├── export_service.py       Excel 导出（学员 / 缴费）
│   ├── requirements.txt        依赖清单
│   ├── Dockerfile              后端镜像
│   ├── .dockerignore           排除虚拟环境（重要）
│   └── tests/
│       └── regression_api.mjs  接口层回归脚本（63 项断言）
│
├── frontend/                   管理端 Web
│   ├── src/
│   │   ├── App.vue             布局、菜单、工作台
│   │   ├── api.js              统一请求封装（含错误提示翻译）
│   │   ├── main.js             应用入口
│   │   ├── style.css           全局设计令牌
│   │   └── components/
│   │       ├── Login.vue       登录页
│   │       ├── Students.vue    学员管理
│   │       ├── Courses.vue     课程管理
│   │       └── Teachers.vue    老师管理
│   ├── vite.config.js          开发服务器 + /api 代理
│   └── DESIGN-TOKENS.md        设计规范
│
├── miniprogram/                学员端小程序
│   ├── app.js / app.json       应用配置 + TabBar
│   ├── app.wxss                设计令牌（与 Web 端同源）
│   ├── config.js               API 地址配置（开发 / 真机切换）
│   ├── gen-icons.js            TabBar 图标生成脚本
│   ├── images/tabbar/          TabBar 图标（81×81 PNG）
│   ├── pages/
│   │   ├── courses/            课程列表
│   │   ├── signup/             报名表单
│   │   ├── success/            报名成功
│   │   ├── teachers/           师资团队
│   │   └── profile/            我的
│   └── utils/enrollment.js     本地报名记录存储
│
├── database/
│   ├── schema.sql              建表 + 课程/老师种子数据
│   └── seed_demo.py            演示数据种子脚本（可重复执行）
│
├── docs/
│   ├── DEMO-SCRIPT.md          客户演示流程手册
│   └── DEPLOYMENT.md           Linux / Docker 部署说明
│
├── docker-compose.yml          MySQL + 后端服务编排
├── AGENTS.md                   项目开发约束（改动前必读）
└── README.md                   本文件
```

---

## 演示数据

执行 `database/seed_demo.py` 会重置为一套完整的演示数据：

| 姓名 | 性别 | 年龄 | 课程 | 老师 | 应缴 | 已缴 | 状态 |
|---|---|---|---|---|---|---|---|
| 谭贵锋 | 男 | 22 | 书法班 | 王老师 | ¥1280 | ¥1280 | 在读 |
| 李思颖 | 女 | 28 | 摄影班 | 李老师 | ¥980 | ¥980 | 在读 |
| 陈美玲 | 女 | 35 | 声乐班 | 陈老师 | ¥1680 | ¥840 | 在读 |
| 韦建国 | 男 | 46 | 书法班 | 王老师 | ¥1280 | ¥0 | 待缴费 |
| 黄晓婷 | 女 | 19 | 摄影班 | 李老师 | ¥980 | ¥980 | 在读 |
| 刘志强 | 男 | 52 | 声乐班 | 陈老师 | ¥1680 | ¥1680 | 结业 |

**设计意图**：

- 覆盖全部 PRD 字段（含紧急联系人、缴费方式、学制、备注），演示时点开详情不空白
- 覆盖三种缴费状态（已缴清 / 部分缴纳 / 未缴），便于演示筛选与待收金额计算
- 陈美玲的缴费分两期（¥500 + ¥340），让「缴费信息导出」有多条流水可看
- 待收金额合计 **¥2120**

> 脚本可重复执行，每次运行结果一致，适合演示前重置。

---

## 微信小程序

### 在微信开发者工具中运行

1. 打开微信开发者工具 → 导入项目
2. 目录选择 `miniprogram/`
3. AppID 选择「测试号」即可

### 配置后端地址

编辑 `miniprogram/config.js`：

```javascript
const ENV = 'dev'   // 'dev' 开发者工具 | 'lan' 真机局域网

const API_BASE = {
  dev: 'http://localhost:8000',
  lan: 'http://192.168.1.8:8000',   // 改成你电脑的局域网 IP
}
```

- **开发者工具**：用 `dev`。需在工具中勾选「不校验合法域名」
- **真机预览**：改 `lan`，填入电脑的局域网 IP（`ipconfig` 查看），确保手机与电脑同一 WiFi

### TabBar 图标

图标由 `gen-icons.js` 用内联 SVG + sharp 生成到 `images/tabbar/`。

**改图标要改脚本重新生成，不要手工改 PNG**：

```bash
node miniprogram/gen-icons.js
```

依赖 `sharp`，若未安装：`npm i sharp`。

---

## Docker 部署

完整的 Linux 服务器部署说明见 **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**。

快速版：

```bash
# 启动 MySQL + 后端
docker-compose up -d --build

# 构建前端静态文件
cd frontend && npm install && npm run build
```

然后用 Nginx 托管 `frontend/dist`，并把 `/api/` 反向代理到 `127.0.0.1:8000`。

> ⚠️ **关键提醒**：`npm run build` 产出的静态文件**没有代理能力**。
> 必须配 Nginx 的 `location /api/` 反代，否则页面能打开但数据全部加载不出来。
> 详见部署文档「零、先理解部署架构」。

---

## 相关文档

| 文档 | 用途 |
|---|---|
| [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) | 客户演示流程手册（含话术、客户提问预案、应急处理） |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Linux / Docker 部署说明（含 Nginx 配置、备份、安全加固） |
| [AGENTS.md](AGENTS.md) | 项目开发约束（改动代码前必读） |
| [frontend/DESIGN-TOKENS.md](frontend/DESIGN-TOKENS.md) | 前端设计规范 |
| [backend/tests/regression_api.mjs](backend/tests/regression_api.mjs) | 接口回归脚本 |

### 运行接口回归

```bash
# 后端需已启动在 127.0.0.1:8000
node backend/tests/regression_api.mjs
```

63 项断言覆盖完整 PRD 闭环，脚本自建数据并自动清理，不污染演示数据。

---

## Demo 边界

以下是**有意简化**的部分，非缺陷：

### 登录与权限

- 登录只做前端入口校验，**不做真实鉴权**
- 无角色区分、无权限控制
- 正式版需要：后端会话管理、密码哈希、角色权限体系（RBAC）

### 支付

- **不接真实支付**。学员小程序报名只提交资料，不涉及收款
- 缴费信息为手工录入
- 正式版接入微信支付需要企业资质与商户号

### 微信小程序

- 未部署到正式环境，**无 HTTPS、无域名备案**
- 需在开发者工具中勾选「不校验合法域名」运行
- 「我的」页的报名记录存在**本机 storage**，非服务端数据

### 数据安全

- MySQL root 密码为 `root`，端口对宿主暴露
- 无数据备份策略
- 正式上线前必须按部署文档「七、安全加固」逐项处理

### 其他

- 未做分页以外的复杂查询（如按班级分组、时间范围筛选）
- 无操作日志与审计
- 无短信/邮件通知

---

## 常见问题

| 问题 | 处理 |
|---|---|
| 前端页面打开但数据加载不出来 | 开发模式检查后端是否启动；生产环境检查 Nginx `/api/` 反代配置 |
| 后端报连不上数据库 | 确认 `docker ps` 里 MySQL 是 Up；MySQL 首次启动需 10-15 秒初始化 |
| 中文显示乱码 | 确认数据库字符集为 `utf8mb4`；`schema.sql` 已指定，旧数据卷需重建 |
| 新增学员提示「请填写XX」 | 这是字段校验提示，按提示补齐必填项 |
| 导出没反应 | 检查浏览器是否拦截下载；换 Chrome / Edge |
| 改了 `main.py` 但行为没变 | 后端需重启。若用 `--reload`，确认进程启动时间晚于文件修改时间 |
| 小程序连不上后端 | 检查 `miniprogram/config.js` 的 `ENV` 是否与实际运行环境匹配 |
| 端口 3306 冲突 | 本项目 MySQL 用的是 **3307**，不会冲突。若 3307 也被占用，改 `docker-compose.yml` 的映射 |

---

## 开发约束

修改代码前请先阅读 [AGENTS.md](AGENTS.md)，其中定义了：

- 14 天阶段边界与「当前阶段不做」清单
- 前端样式约定（禁止裸标签选择器、主题色只改 `themeOverrides`）
- 后端约定（必须用 Pydantic 校验、错误提示统一走 `api.js`）
- 改动前检查清单（备份 / 小步验证 / 完成后报告实际结果）
