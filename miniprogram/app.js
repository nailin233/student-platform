const { apiBase, env } = require('./config')

// 开发者工具通过 Windows 本机转发访问后端；真机需要改成局域网 IP（见 config.js）。
App({
  globalData: { apiBase, env }
})
