# 学员管理平台 前端设计方案（Naive UI）

## 一、技术选型

- 组件库：**Naive UI 2.45**（已替换 Element Plus）
- 框架：Vue 3 `<script setup>` + Vite
- 路由：hash 路由（`#/dashboard` 等），未引入 vue-router 实例

选 Naive UI 的原因：组件 API 更贴近 Vue 3 组合式写法，主题通过 `themeOverrides` 用 JS 对象配置，不需要写 `--el-*` 之类的全局 CSS 变量覆盖，样式冲突面小。

## 二、迁移后修复的问题（2026-09-13）

原 Element Plus → Naive UI 迁移只改了一半，留下了若干会导致白屏或静默失败的问题：

1. **组件未导入** —— `Students.vue`、`Courses.vue`、`Teachers.vue` 模板里用了 `n-card`、`n-data-table`、`n-modal` 等，但 `<script setup>` 中一个都没 import。注意 `vite build` 不做模板组件解析检查，所以构建能过、运行时白屏。
2. **`useMessage()` 脱离 provider** —— `n-message-provider` 只包住了 `n-layout`，`Login` 在外部，导致所有成功/失败提示无法显示。
3. **全局样式污染布局** —— `style.css` 直接写 `aside` / `nav` / `main` / `h1` / `p`，而 Naive UI 的 `n-layout` 内部渲染出的标签恰好同名，造成侧边栏与内容区错位。
4. **Element Plus 残留** —— `--el-*` 令牌与 `.el-*` 微调全部失效，已删除。
5. **后端输入校验缺失** —— 课程/老师接口用裸 `dict` 接收 payload，缺字段时抛 500；已改为 Pydantic 模型。

## 三、设计令牌

### 3.1 色彩

色彩统一在 `App.vue` 的 `themeOverrides` 中配置，不再依赖全局 CSS 覆盖。

| 语义 | 色值 | 用途 |
|---|---|---|
| 品牌主色 | `#0052d9` | 主按钮、选中态、链接 |
| 品牌悬浮 | `#366ef4` | hover |
| 品牌按下 | `#003cab` | active |
| 品牌浅底 | `#f2f3ff` | 选中行、标签底 |
| 成功 | `#2ba471` | 已连接、在读 |
| 告警 | `#e37318` | 待缴费提醒 |
| 错误 | `#d54941` | 删除、校验失败 |
| 页面底色 | `#f3f3f4` | body 背景 |
| 侧边栏底 | `#242424` | 左导航 |

`style.css` 的 `:root` 仍保留同名 CSS 变量，供页面级自定义样式引用（如 `.page-head h1`）。**组件内不要写死颜色。**

### 3.2 字号（中老年友好）

Naive UI 桌面端默认正文为 14px。本项目面向机构管理员，多为中老年用户，**正文上调到 16px**。

| 层级 | 字号 | 用途 |
|---|---|---|
| 页面主标题 | 28px | `.page-head h1` |
| 卡片标题 | 20px | `themeOverrides.Card.titleFontSize` |
| 正文/表格 | 16px | 表格内容、表单 |
| 次要说明 | 15px | 辅助文字 |

### 3.3 尺寸

| 项 | 值 | 说明 |
|---|---|---|
| 圆角 | 6px | `themeOverrides.common.borderRadius` |
| 卡片圆角 | 12px | `.data-card` |
| 按钮高度 | 42px | `themeOverrides.Button.heightMedium` |
| 表格行高 | ≥52px | `.n-data-table .n-data-table-td` |

## 四、交互原则（中老年友好）

1. **一屏主操作不超过 3 个**：页面头部只留一个主按钮（新增），导出类为次要按钮。
2. **错误提示写人话**：不出现「字段校验失败」，改为「请填写联系电话」。
3. **危险操作二次确认**：用 `n-popconfirm`，确认文案含对象名称与后果（如「确认删除学员「张三」？该操作不可撤销。」）。
4. **表格横向滚动**：`scroll-x` 兜底，不压缩列宽导致文字折行。
5. **所有异步操作有反馈**：加载态用 `loading`，失败用 `message.error`，不静默失败。

## 五、样式约定

- **禁止**在 `style.css` 中使用 `aside` / `nav` / `main` 等裸标签选择器 —— Naive UI 布局内部会用到这些标签名。页面级样式统一挂到 `.business-page` 下。
- 组件内自定义样式一律加 `<style scoped>`。
- 主题色改动只改 `App.vue` 的 `themeOverrides` 一处。

## 六、验证清单

- [x] `npm run build` 通过
- [x] 登录页为未登录时的默认入口，未登录访问业务页会被挡回
- [x] 工作台 / 学员 / 课程 / 老师 四个页面均正常渲染数据
- [x] 学员表格含「任课老师」列，课程与老师显示名称而非 ID
- [x] 新增/编辑弹窗中性别、课程、老师、缴费方式、状态为下拉框
- [x] 删除有带姓名的二次确认
- [x] 课程/老师接口缺字段返回 422 而非 500
