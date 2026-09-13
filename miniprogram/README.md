# 微信小程序 Demo

使用微信开发者工具打开 `miniprogram` 目录。开发环境将 API 地址指向 `http://127.0.0.1:8000`；真机调试需要改为局域网地址，正式上线还需要 HTTPS 和合法域名。

页面流程：课程列表 → 选择课程 → 填写姓名、性别、年龄、电话 → 提交到后台学员接口。

## 视觉规范

与 Web 管理端统一（详见 `frontend/DESIGN-TOKENS.md`）：

- 主色 `#0052d9`，页面底色 `#f3f3f4`，导航栏为主色蓝
- 正文 32rpx（=16px），主按钮高度 96rpx，符合中老年友好标准
- 设计令牌集中定义在 `app.wxss` 的 `:root, page`，页面样式只引用 `var(--xxx)`，不写死颜色

## 页面结构

| 页面 | 路径 | 说明 |
|---|---|---|
| 课程列表 | `pages/courses/` | **Tab 页**。展示课程卡片（名称/学制/上课时间/价格/描述），支持下拉刷新与错误重试 |
| 师资团队 | `pages/teachers/` | **Tab 页**。展示老师卡片（姓氏头像/专业标签/简介/可拨打），支持下拉刷新 |
| 我的 | `pages/profile/` | **Tab 页**。个人信息 + 本地报名记录 + 联系机构 |
| 填写报名 | `pages/signup/` | 非 Tab 页，由课程页 `navigateTo` 进入。回显所选课程，姓名与手机号必填并做格式校验 |
| 报名成功 | `pages/success/` | 非 Tab 页，报名后 `redirectTo` 进入。回显报名人姓名 |

## 底部导航栏（TabBar）

三个标签：**课程 / 老师 / 我的**，配置在 `app.json` 的 `tabBar`。

- 图标 `images/tabbar/*.png`，81×81 PNG，每项两版（常态灰 `#8a8f99` / 选中态主色 `#0052d9`）
- 图标由 `gen-icons.js` 生成（SVG 内联绘制 → sharp 转 PNG）。**改了图标先改脚本再重新生成**，不要手工改 PNG：
  ```bash
  NODE_PATH=<node workspace>/node_modules node gen-icons.js images/tabbar
  ```
- 三个 Tab 页只能通过 `wx.switchTab` / `wx.reLaunch` 跳转，`navigateTo` 会失败
- 非 Tab 页（signup / success）不放进 `tabBar.list`，但仍需在 `pages` 数组里注册

## 本地报名记录

Demo 没有真实登录，「我的」页的报名记录存在本机 storage（key: `my_enrollments`），
工具方法见 `utils/enrollment.js`。报名成功时由 `signup.js` 写入，最多保留 20 条。

## 开发约定

- 禁止使用旧的墨绿主题色（`#236454` / `#f6f7f3` / `#213b36`），统一走 `app.wxss` 的变量
- **导航栏（顶部）由微信原生绘制，页面内不要再写同名主标题**：标题配在 `app.json` 或页面 `.json` 的 `navigationBarTitleText`，页面 wxml 里只需要副标题/引导语（`.page-head > .subtitle`）。两处都写会出现标题重复，看起来像"导航栏不见了"。
- **每个页面必须配同名 `.json`**（导航栏标题、下拉刷新等），新建页面时一并创建
- 错误提示写人话，不出现「字段校验失败」这类术语
- 价格字段后端返回 float（如 `1680.0`），展示前需 `toFixed(2)` 格式化
- 页面数据加载用 `onLoad` + `onPullDownRefresh`，不要用 `onShow`（每次切回都会重复请求）
- 头像类圆形元素只放 1 个汉字（取 `charAt(0)`），放全名会溢出
