# 服务器环境检查（部署前第一步）

把下面每条命令**复制到服务器终端**执行，把输出结果发给我。
一共 5 条，1 分钟能跑完；或者每步做完贴出来也行。

> **本环境禁止我用 wsl.exe 或远程连接工具**，所以这些命令需要你手动执行。
> 直接在云服务商控制台的「远程连接」网页终端里跑最方便。

---

## 命令 1 · 看系统和配置

```bash
cat /etc/os-release | head -3 && echo "---" && nproc && free -h && df -h /
```

**我要看**：系统版本（Ubuntu/Debian/CentOS）、CPU 核数、内存大小、磁盘剩余。
重点确认内存是不是 2G，以及磁盘至少要有 10G 空闲。

---

## 命令 2 · 看宝塔装了哪些服务

```bash
bt default 2>/dev/null | head -20
```

如果提示 `bt: command not found`，试：

```bash
ls /www/server/ 2>/dev/null
```

**我要看**：宝塔里装了哪些软件（Nginx？MySQL？PHP？）、各自的版本。
**这决定了我们是用宝塔的 MySQL 还是 Docker 的 MySQL**——两者同时跑会端口冲突。

---

## 命令 3 · 看端口占用

```bash
ss -tlnp 2>/dev/null | grep -E ':(80|443|3306|3307|8000|888)\b' || netstat -tlnp 2>/dev/null | grep -E ':(80|443|3306|3307|8000|888)\b'
```

**我要看**：80、3306、8000 这些端口被谁占了。
- 80 被 Nginx 占了 → 正常，宝塔的 Nginx
- 3306 被 MySQL 占了 → **关键**，说明宝塔装了 MySQL
- 8000 被占 → 要换端口

---

## 命令 4 · 看 Docker 状态

```bash
docker --version 2>/dev/null; docker compose version 2>/dev/null; docker-compose --version 2>/dev/null; echo "---"; systemctl is-active docker 2>/dev/null
```

**我要看**：Docker 装没装、是哪种 compose 命令（`docker compose` 还是 `docker-compose`）、服务是否在跑。

---

## 命令 5 · 看能不能连外网（拉镜像用）

```bash
curl -s -m 10 -o /dev/null -w "docker hub: %{http_code}\n" https://registry-1.docker.io/v2/ ; curl -s -m 10 -o /dev/null -w "github: %{http_code}\n" https://github.com
```

**我要看**：能否访问 Docker Hub 和 GitHub。
国内服务器访问 Docker Hub 经常超时，可能需要配镜像加速器。这一步能提前发现问题，避免部署到一半卡住。

---

## 顺便：告诉我这些

1. **云服务商**是哪家？（阿里云 / 腾讯云 / 华为云 / 其他）—— 不同厂商的安全组配置入口不同
2. **服务器的公网 IP** 是多少？（我会用它拼访问地址）
3. **宝塔面板的登录地址**你能打开吗？（说明 8888 端口是通的）

---

## 接下来的路线

基于「2核2G + 宝塔 + 无域名 + 练手」，推荐走：

```
方案 B · Docker 跑后端+MySQL，宝塔的 Nginx 做前端和反向代理

  ├── Docker: MySQL 8.4（用 docker-compose.lowmem.yml 限制内存）
  ├── Docker: FastAPI 后端（只监听 127.0.0.1:8000）
  ├── 宝塔 Nginx: 托管前端 dist + 反向代理 /api → 127.0.0.1:8000
  └── 宝塔面板: 负责网站管理、SSL、日志
```

**详细步骤见 [docs/DEPLOY-BAOTA.md](DEPLOY-BAOTA.md)** —— 已按你的环境写好，
并且我在本地真实跑通了整套流程（含内存占用、中文编码、容器内灌数据）。

> 为什么不用全 Docker：2核2G 下，MySQL 8.4 默认配置实测占用 485MB，
> 用 `docker-compose.lowmem.yml` 调参后降到 **135MB**，省了 350MB。
> 这 350MB 对 2G 服务器是决定性的。
