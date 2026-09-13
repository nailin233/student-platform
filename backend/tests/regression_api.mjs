/**
 * Day 13 回归 A · 接口层主闭环
 * ---------------------------------------------------------------------------
 * 完整走一遍 PRD 核心闭环：
 *   管理员维护课程和老师 → 学员查看课程 → 学员提交报名 →
 *   后台出现学员记录 → 管理员查询、修改、导出
 * 每个断言打印实际结果，失败不中断，最后汇总。
 *
 * 运行方式（后端需已启动在 127.0.0.1:8000）：
 *   node backend/tests/regression_api.mjs
 *
 * 脚本会自建课程/老师和学员数据，并在结束时清理，
 * 不会污染演示数据基线（学员 3 / 课程 3 / 老师 3）。
 */

const B = 'http://127.0.0.1:8000'

let pass = 0
let fail = 0
const failures = []

function ok(name, cond, actual) {
  if (cond) {
    pass++
    console.log('  \u2713 ' + name)
  } else {
    fail++
    failures.push(name + (actual !== undefined ? `  → 实际: ${JSON.stringify(actual)}` : ''))
    console.log('  \u2717 ' + name + (actual !== undefined ? `  → 实际: ${JSON.stringify(actual)}` : ''))
  }
}

async function req(path, opt = {}) {
  const res = await fetch(B + path, {
    ...opt,
    headers: { 'Content-Type': 'application/json', ...(opt.headers || {}) }
  })
  let body = null
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('json')) body = await res.json().catch(() => null)
  return { status: res.status, body, ct }
}

async function main() {
  console.log('========================================')
  console.log(' Day 13 回归 A · 接口层主闭环')
  console.log('========================================')

  // ---------- 0. 前置健康 ----------
  console.log('\n【0】前置检查')
  const h = await req('/api/health')
  ok('后端健康检查返回 200', h.status === 200, h.status)
  const dh = await req('/api/database/health')
  ok('数据库健康检查返回 ok', dh.body?.status === 'ok', dh.body)

  // ---------- 1. 管理员建课程 ----------
  console.log('\n【1】管理员新建课程')
  const cRes = await req('/api/courses', {
    method: 'POST',
    body: JSON.stringify({
      name: '回归测试班',
      description: 'Day13 回归专用',
      duration: '4周',
      price: 888,
      class_time: '周一 10:00-12:00'
    })
  })
  ok('新建课程返回 201', cRes.status === 201, cRes.status)
  const courseId = cRes.body?.id
  ok('返回了课程 id', typeof courseId === 'number', cRes.body)

  const cList = await req('/api/courses')
  const created = (cList.body || []).find(c => c.id === courseId)
  ok('新建的课程出现在课程列表', !!created, created)
  ok('课程名正确', created?.name === '回归测试班', created?.name)
  ok('课程价格正确', Number(created?.price) === 888, created?.price)

  // ---------- 2. 管理员建老师 ----------
  console.log('\n【2】管理员新建老师')
  const tRes = await req('/api/teachers', {
    method: 'POST',
    body: JSON.stringify({
      name: '回归测试老师',
      phone: '13900008888',
      specialty: '测试',
      introduction: 'Day13 回归专用'
    })
  })
  ok('新建老师返回 201', tRes.status === 201, tRes.status)
  const teacherId = tRes.body?.id
  ok('返回了老师 id', typeof teacherId === 'number', tRes.body)

  const tList = await req('/api/teachers')
  const createdT = (tList.body || []).find(t => t.id === teacherId)
  ok('新建的老师出现在老师列表', !!createdT, createdT)
  ok('老师姓名正确', createdT?.name === '回归测试老师', createdT?.name)

  // ---------- 3. options 下拉（学员端看课程） ----------
  console.log('\n【3】下拉选项（学员端选课程/老师）')
  const opts = await req('/api/options')
  ok('options 返回 200', opts.status === 200, opts.status)
  ok('options 含课程数组', Array.isArray(opts.body?.courses), opts.body?.courses?.length)
  ok('options 含老师数组', Array.isArray(opts.body?.teachers), opts.body?.teachers?.length)
  ok('新建课程出现在下拉里', (opts.body?.courses || []).some(c => c.id === courseId), opts.body?.courses)
  ok('新建老师出现在下拉里', (opts.body?.teachers || []).some(t => t.id === teacherId), opts.body?.teachers)

  // ---------- 4. 学员提交报名 ----------
  console.log('\n【4】学员提交报名')
  const sRes = await req('/api/students', {
    method: 'POST',
    body: JSON.stringify({
      name: '回归学员',
      gender: '男',
      age: 28,
      phone: '13700007777',
      course_id: courseId,
      teacher_id: teacherId,
      class_time: '周一 10:00-12:00',
      tuition_fee: 888,
      paid_amount: 300,
      duration: '4周',
      status: '在读',
      remark: 'Day13 回归'
    })
  })
  ok('报名返回 201', sRes.status === 201, sRes.status)
  const studentId = sRes.body?.id
  ok('返回了学员 id', typeof studentId === 'number', sRes.body)

  // ---------- 5. 后台出现记录 ----------
  console.log('\n【5】报名后后台出现学员记录')
  const list = await req('/api/students?page=1&page_size=50')
  ok('学员列表返回 200', list.status === 200, list.status)
  const row = (list.body?.items || []).find(i => i.id === studentId)
  ok('新学员出现在列表', !!row, row)
  ok('学员姓名正确', row?.name === '回归学员', row?.name)
  ok('课程名已 JOIN 出来', row?.course_name === '回归测试班', row?.course_name)
  ok('老师名已 JOIN 出来', row?.teacher_name === '回归测试老师', row?.teacher_name)
  ok('应缴金额正确', Number(row?.tuition_fee) === 888, row?.tuition_fee)
  ok('已缴金额正确', Number(row?.paid_amount) === 300, row?.paid_amount)

  // ---------- 6. 查询（关键字搜索） ----------
  console.log('\n【6】按关键字查询')
  const byName = await req('/api/students?keyword=' + encodeURIComponent('回归学员'))
  ok('按姓名能搜到', (byName.body?.items || []).some(i => i.id === studentId), byName.body?.total)
  const byPhone = await req('/api/students?keyword=13700007777')
  ok('按手机号能搜到', (byPhone.body?.items || []).some(i => i.id === studentId), byPhone.body?.total)
  const noHit = await req('/api/students?keyword=' + encodeURIComponent('不存在的名字XYZ'))
  ok('搜不到时 total 为 0', noHit.body?.total === 0, noHit.body?.total)

  // ---------- 7. 分页 ----------
  console.log('\n【7】分页')
  const p1 = await req('/api/students?page=1&page_size=2')
  ok('第一页返回 2 条', (p1.body?.items || []).length === 2, p1.body?.items?.length)
  ok('page 字段回显 1', p1.body?.page === 1, p1.body?.page)
  const p2 = await req('/api/students?page=2&page_size=2')
  const ids1 = (p1.body?.items || []).map(i => i.id)
  const ids2 = (p2.body?.items || []).map(i => i.id)
  ok('第二页与第一页无重叠', !ids2.some(id => ids1.includes(id)), { ids1, ids2 })

  // ---------- 8. 学员详情 ----------
  console.log('\n【8】学员详情')
  const detail = await req('/api/students/' + studentId)
  ok('详情返回 200', detail.status === 200, detail.status)
  ok('详情含全部扩展字段', detail.body?.remark === 'Day13 回归', detail.body?.remark)
  ok('详情含 course_name', detail.body?.course_name === '回归测试班', detail.body?.course_name)
  const notFound = await req('/api/students/99999999')
  ok('不存在的学员返回 404', notFound.status === 404, notFound.status)

  // ---------- 9. 修改 ----------
  console.log('\n【9】管理员修改学员')
  const uRes = await req('/api/students/' + studentId, {
    method: 'PUT',
    body: JSON.stringify({
      name: '回归学员已改',
      gender: '男',
      age: 29,
      phone: '13700007777',
      course_id: courseId,
      teacher_id: teacherId,
      class_time: '周一 10:00-12:00',
      tuition_fee: 888,
      paid_amount: 888,
      duration: '4周',
      status: '已结业',
      remark: '已修改'
    })
  })
  ok('修改返回 200', uRes.status === 200, uRes.status)
  const after = await req('/api/students/' + studentId)
  ok('姓名已更新', after.body?.name === '回归学员已改', after.body?.name)
  ok('年龄已更新', after.body?.age === 29, after.body?.age)
  ok('已缴金额已更新', Number(after.body?.paid_amount) === 888, after.body?.paid_amount)
  ok('状态已更新', after.body?.status === '已结业', after.body?.status)

  // ---------- 10. 工作台统计 ----------
  console.log('\n【10】工作台统计')
  const stats = await req('/api/dashboard/stats')
  ok('统计返回 200', stats.status === 200, stats.status)
  ok('统计含学员数', typeof stats.body?.students === 'number', stats.body?.students)
  ok('统计含未缴金额', typeof stats.body?.unpaid_amount === 'number', stats.body?.unpaid_amount)
  ok('学员数与列表 total 一致', stats.body?.students === list.body?.total, {
    stats: stats.body?.students, list: list.body?.total
  })

  // ---------- 11. 导出 ----------
  console.log('\n【11】Excel 导出')
  const exS = await req('/api/export/students')
  ok('导出学员返回 200', exS.status === 200, exS.status)
  ok('导出学员 Content-Type 为 xlsx', (exS.ct || '').includes('spreadsheetml'), exS.ct)
  const exP = await req('/api/export/payments')
  ok('导出缴费返回 200', exP.status === 200, exP.status)
  ok('导出缴费 Content-Type 为 xlsx', (exP.ct || '').includes('spreadsheetml'), exP.ct)

  // ---------- 12. 参数校验 ----------
  console.log('\n【12】参数校验')
  const bad1 = await req('/api/students', { method: 'POST', body: JSON.stringify({}) })
  ok('学员缺必填返回 422', bad1.status === 422, bad1.status)
  const bad2 = await req('/api/students', {
    method: 'POST', body: JSON.stringify({ name: 'x', phone: '123', age: 999 })
  })
  ok('年龄超范围返回 422', bad2.status === 422, bad2.status)
  const bad3 = await req('/api/courses', { method: 'POST', body: JSON.stringify({ name: 'x', price: -5 }) })
  ok('课程负价格返回 422', bad3.status === 422, bad3.status)
  const bad4 = await req('/api/students', {
    method: 'POST',
    body: JSON.stringify({ name: '引用检查', phone: '13000000000', course_id: 99999999 })
  })
  ok('引用不存在的课程返回 400', bad4.status === 400, bad4.status)
  const bad5 = await req('/api/students?page=0')
  ok('page=0 返回 422', bad5.status === 422, bad5.status)
  const bad6 = await req('/api/students?page_size=999')
  ok('page_size=999 返回 422', bad6.status === 422, bad6.status)

  // ---------- 13. DELETE 接口（重点：之前误判为缺失） ----------
  console.log('\n【13】删除接口')
  const delS = await req('/api/students/' + studentId, { method: 'DELETE' })
  ok('删除学员返回 200', delS.status === 200, delS.status)
  const goneS = await req('/api/students/' + studentId)
  ok('删除后详情返回 404', goneS.status === 404, goneS.status)
  const delSAgain = await req('/api/students/' + studentId, { method: 'DELETE' })
  ok('重复删除返回 404', delSAgain.status === 404, delSAgain.status)

  const delC = await req('/api/courses/' + courseId, { method: 'DELETE' })
  ok('删除课程返回 200', delC.status === 200, delC.status)
  const delCAgain = await req('/api/courses/' + courseId, { method: 'DELETE' })
  ok('重复删除课程返回 404', delCAgain.status === 404, delCAgain.status)

  const delT = await req('/api/teachers/' + teacherId, { method: 'DELETE' })
  ok('删除老师返回 200', delT.status === 200, delT.status)
  const delTAgain = await req('/api/teachers/' + teacherId, { method: 'DELETE' })
  ok('重复删除老师返回 404', delTAgain.status === 404, delTAgain.status)

  // ---------- 14. 清理验证 ----------
  console.log('\n【14】清理验证（回归数据不应残留）')
  const finalCourses = await req('/api/courses')
  ok('回归课程已从列表移除', !(finalCourses.body || []).some(c => c.id === courseId), courseId)
  const finalTeachers = await req('/api/teachers')
  ok('回归老师已从列表移除', !(finalTeachers.body || []).some(t => t.id === teacherId), teacherId)

  // ---------- 汇总 ----------
  console.log('\n========================================')
  console.log(` 结果: ${pass} 通过, ${fail} 失败`)
  console.log('========================================')
  if (failures.length) {
    console.log('\n失败项:')
    failures.forEach(f => console.log('  · ' + f))
  }
  process.exit(fail > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('\n回归脚本异常中断:', e.message)
  process.exit(2)
})
