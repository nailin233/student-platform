/**
 * 统一的接口请求封装
 * ---------------------------------------------------------------------------
 * 存在的意义：FastAPI 校验失败时返回的 detail 是数组（[{loc,msg,type}]），
 * 直接丢进 Error 或模板字符串会显示成 [object Object]，用户完全看不懂。
 * 这里统一把 detail 翻译成「请填写联系电话」这类人话。
 */

/**
 * 把后端返回的 detail 转成可读文案。
 * @param {*} detail  body.detail，可能是 string / 数组 / 对象 / undefined
 * @param {number} status HTTP 状态码，用于兜底文案
 * @param {Record<string,string>} labelMap 字段名 → 中文标签，用于把 phone 说成「联系电话」
 */
export function humanizeDetail(detail, status, labelMap = {}) {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map(d => {
        const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null
        const label = labelMap[key] || key
        if (d.type === 'missing') return `请填写${label || '必填项'}`
        if (d.type === 'string_type' || d.type === 'int_type' || d.type === 'float_type') {
          return `${label || '字段'}格式不正确`
        }
        if (d.type === 'greater_than_equal') return `${label || '字段'}不能小于 0`
        if (d.type === 'less_than_equal') return `${label || '字段'}超出允许范围`
        return label ? `${label}：${d.msg}` : d.msg
      })
      .join('；')
  }

  if (detail && typeof detail === 'object') return detail.msg || JSON.stringify(detail)

  // 常见状态码兜底，避免出现「请求失败（500）」之外的空白提示
  if (status === 404) return '记录不存在，可能已被其他人删除'
  if (status === 405) return '该操作不被支持'
  if (status >= 500) return '服务器出错了，请稍后重试'
  return `请求失败（${status}）`
}

/**
 * 发起请求并解析 JSON，失败时抛出带可读信息的 Error。
 * @param {string} url
 * @param {RequestInit} opt
 * @param {Record<string,string>} labelMap 字段标签映射
 */
export async function request(url, opt = {}, labelMap = {}) {
  const res = await fetch(url, opt)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Error(humanizeDetail(body?.detail, res.status, labelMap))
  return body
}
