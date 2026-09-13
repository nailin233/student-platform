/**
 * 本地报名记录
 * ---------------------------------------------------------------------------
 * Demo 阶段没有真实登录，用本地 storage 记住「我报过哪些班」，
 * 供「我的」页面展示。刻意不引入用户体系，避免超出 Demo 范围。
 */

const STORAGE_KEY = 'my_enrollments'

/** 读取全部报名记录（最新的在前） */
function getEnrollments() {
  try {
    const list = wx.getStorageSync(STORAGE_KEY)
    return Array.isArray(list) ? list : []
  } catch (e) {
    return []
  }
}

/**
 * 追加一条报名记录
 * @param {{name:string, phone:string, courseName:string}} record
 */
function addEnrollment(record) {
  const list = getEnrollments()
  list.unshift({
    name: record.name || '',
    phone: record.phone || '',
    courseName: record.courseName || '未指定课程',
    time: formatNow()
  })
  try {
    // 只保留最近 20 条，避免 Demo 数据无限增长
    wx.setStorageSync(STORAGE_KEY, list.slice(0, 20))
  } catch (e) {
    // storage 写入失败不应影响报名主流程，静默处理
  }
}

/** 清空报名记录 */
function clearEnrollments() {
  try {
    wx.removeStorageSync(STORAGE_KEY)
  } catch (e) {
    // 忽略
  }
}

/** 返回 YYYY-MM-DD HH:mm，避免用 toISOString 出现 T 与 Z */
function formatNow() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return (
    d.getFullYear() +
    '-' +
    p(d.getMonth() + 1) +
    '-' +
    p(d.getDate()) +
    ' ' +
    p(d.getHours()) +
    ':' +
    p(d.getMinutes())
  )
}

module.exports = { getEnrollments, addEnrollment, clearEnrollments }
