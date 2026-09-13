<script setup>
import { ref, computed, onMounted, h } from 'vue'
import {
  useMessage, useDialog,
  NButton, NSpace, NCard, NInput, NInputNumber, NSelect, NAlert,
  NDataTable, NPagination, NModal, NForm, NFormItem, NDescriptions,
  NDescriptionsItem, NPopconfirm, NTag
} from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const rows = ref([])
const total = ref(0)
const page = ref(1)
const keyword = ref('')
const busy = ref(false)
const saving = ref(false)
const exporting = ref('')
const formDialog = ref(false)
const detailDialog = ref(false)
const detail = ref(null)
const editing = ref(null)
const options = ref({ courses: [], teachers: [] })
const error = ref('')

// 字段定义：[标签, 字段名, 控件类型]
// 控件类型 text=文本框  number=数字框  select=下拉框
const fields = [
  ['姓名', 'name', 'text'],
  ['性别', 'gender', 'select'],
  ['年龄', 'age', 'number'],
  ['联系电话', 'phone', 'text'],
  ['所选课程', 'course_id', 'select'],
  ['任课老师', 'teacher_id', 'select'],
  ['上课时间', 'class_time', 'text'],
  ['紧急联系人', 'emergency_contact', 'text'],
  ['紧急联系电话', 'emergency_phone', 'text'],
  ['缴费时间', 'payment_time', 'text'],
  ['缴费方式', 'payment_method', 'select'],
  ['应缴金额', 'tuition_fee', 'number'],
  ['已缴金额', 'paid_amount', 'number'],
  ['学制', 'duration', 'text'],
  ['状态', 'status', 'select'],
  ['备注', 'remark', 'text']
]

// 表格展示列（第三项为列宽）
// 目标：在 1024px 内容区内容纳全部列，避免中老年用户需要横向滚动
const tableFields = [
  ['姓名', 'name', 88],
  ['性别', 'gender', 64],
  ['年龄', 'age', 60],
  ['联系电话', 'phone', 124],
  ['所选课程', 'course_name', 100],
  ['任课老师', 'teacher_name', 92],
  ['上课时间', 'class_time', 132],
  ['应缴金额', 'tuition_fee', 96],
  ['状态', 'status', 76]
]

const genderOptions = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
  { label: '其他', value: '其他' }
]
const paymentMethodOptions = [
  { label: '微信', value: '微信' },
  { label: '支付宝', value: '支付宝' },
  { label: '现金', value: '现金' },
  { label: '银行转账', value: '银行转账' }
]
const statusOptions = [
  { label: '在读', value: '在读' },
  { label: '已结业', value: '已结业' },
  { label: '退学', value: '退学' }
]

const courseOptions = computed(() =>
  options.value.courses.map(c => ({ label: c.name, value: c.id }))
)
const teacherOptions = computed(() =>
  options.value.teachers.map(t => ({ label: t.name, value: t.id }))
)

function selectOptions(key) {
  if (key === 'gender') return genderOptions
  if (key === 'payment_method') return paymentMethodOptions
  if (key === 'status') return statusOptions
  if (key === 'course_id') return courseOptions.value
  if (key === 'teacher_id') return teacherOptions.value
  return []
}

// 空表单：数字字段给 0，其余给空串，避免后端参数缺失
function emptyForm() {
  return Object.fromEntries(
    fields.map(([, key, type]) => [key, type === 'number' ? 0 : ''])
  )
}
const form = ref(emptyForm())

// 详情展示用：把 ID 转成名称，金额加符号
function formatDetail(key) {
  const v = detail.value?.[key]
  if (v === null || v === undefined || v === '') return '—'
  if (key === 'course_id') return detail.value?.course_name || `课程 #${v}`
  if (key === 'teacher_id') return detail.value?.teacher_name || `老师 #${v}`
  if (key === 'tuition_fee' || key === 'paid_amount') return '¥' + Number(v).toFixed(2)
  if (key === 'payment_time') return String(v).replace('T', ' ').slice(0, 19)
  return v
}

async function req(url, opt = {}) {
  const res = await fetch(url, opt)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw Error(body?.detail || `请求失败（${res.status}）`)
  return body
}

async function load() {
  busy.value = true
  error.value = ''
  try {
    const params = new URLSearchParams({
      page: page.value,
      page_size: 10,
      keyword: keyword.value
    })
    const data = await req('/api/students?' + params)
    rows.value = data.items
    total.value = data.total
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function ensureOptions() {
  if (options.value.courses.length && options.value.teachers.length) return
  try {
    options.value = await req('/api/options')
  } catch (e) {
    message.error('加载课程/老师选项失败：' + e.message)
  }
}

// ro=true 查看详情；否则打开编辑表单
async function open(row = null, readOnly = false) {
  try {
    if (readOnly) {
      detail.value = await req('/api/students/' + row.id)
      detailDialog.value = true
      return
    }
    await ensureOptions()
    if (row) {
      const full = await req('/api/students/' + row.id)
      // 只回填表单字段，忽略 id/created_at 等后端字段
      form.value = { ...emptyForm(), ...Object.fromEntries(fields.map(([, key]) => [key, full[key] ?? emptyForm()[key]])) }
      editing.value = row.id
    } else {
      form.value = emptyForm()
      editing.value = null
    }
    formDialog.value = true
  } catch (e) {
    message.error(e.message)
  }
}

async function save() {
  // 前端基本校验，错误提示写人话
  if (!String(form.value.name || '').trim()) return message.error('请填写学员姓名')
  if (!String(form.value.phone || '').trim()) return message.error('请填写联系电话')

  // 空串转 null，避免后端写入空字符串
  const payload = Object.fromEntries(
    Object.entries(form.value).map(([k, v]) => [k, v === '' ? null : v])
  )

  saving.value = true
  try {
    await req('/api/students' + (editing.value ? '/' + editing.value : ''), {
      method: editing.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    formDialog.value = false
    message.success(editing.value ? '学员信息已更新' : '学员已添加')
    await load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await req('/api/students/' + row.id, { method: 'DELETE' })
    message.success(`已删除学员「${row.name}」`)
    // 删掉当前页最后一条时回退一页
    if (rows.value.length === 1 && page.value > 1) page.value -= 1
    await load()
  } catch (e) {
    message.error(e.message)
  }
}

async function exportFile(kind, label) {
  exporting.value = kind
  try {
    const res = await fetch('/api/export/' + kind)
    if (!res.ok) throw Error(`导出失败（${res.status}）`)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = label + '.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    message.success(label + ' 导出成功')
  } catch (e) {
    message.error(e.message)
  } finally {
    exporting.value = ''
  }
}

function search() {
  page.value = 1
  load()
}

const columns = [
  ...tableFields.map(([title, key, width]) => ({
    title,
    key,
    width,
    ellipsis: { tooltip: true },
    render: key === 'status'
      ? r => h(NTag, { type: r.status === '在读' ? 'success' : 'default', size: 'small', bordered: false }, { default: () => r[key] || '—' })
      : key === 'tuition_fee' || key === 'paid_amount'
        ? r => (r[key] == null ? '—' : '¥' + Number(r[key]).toFixed(2))
        : r => r[key] ?? '—'
  })),
  {
    title: '操作',
    key: 'op',
    width: 168,
    fixed: 'right',
    render: row => h(NSpace, { size: 12, align: 'center' }, () => [
      h(NButton, { text: true, type: 'primary', onClick: () => open(row, true) }, { default: () => '详情' }),
      h(NButton, { text: true, type: 'primary', onClick: () => open(row) }, { default: () => '编辑' }),
      h(NPopconfirm, {
        onPositiveClick: () => remove(row),
        positiveText: '确认删除',
        negativeText: '再想想'
      }, {
        trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '删除' }),
        default: () => `确认删除学员「${row.name}」？该操作不可撤销。`
      })
    ])
  }
]

onMounted(load)
</script>

<template>
  <section class="business-page">
    <header class="page-head">
      <div>
        <h1>学员管理</h1>
        <p>维护学员报名资料、课程与缴费信息。</p>
      </div>
      <n-button type="primary" size="large" @click="open()">新增学员</n-button>
    </header>

    <n-alert v-if="error" type="error" closable style="margin-bottom:16px" @close="error=''">
      {{ error }}
    </n-alert>

    <n-card :bordered="false" class="data-card" style="margin-bottom:16px">
      <n-space align="center">
        <n-input
          v-model:value="keyword"
          placeholder="搜索姓名或联系电话"
          clearable
          style="width:260px"
          @keyup.enter="search"
        />
        <n-button type="primary" @click="search">搜索</n-button>
        <n-button :loading="exporting === 'students'" @click="exportFile('students','学员信息')">导出学员</n-button>
        <n-button :loading="exporting === 'payments'" @click="exportFile('payments','缴费信息')">导出缴费</n-button>
      </n-space>
    </n-card>

    <n-card :bordered="false" class="data-card">
      <n-data-table
        :columns="columns"
        :data="rows"
        :loading="busy"
        :bordered="false"
        :row-key="r => r.id"
      />
      <div style="display:flex;justify-content:flex-end;margin-top:20px">
        <n-pagination
          v-model:page="page"
          :page-size="10"
          :item-count="total"
          @update:page="load"
        />
      </div>
    </n-card>

    <!-- 新增 / 编辑 -->
    <n-modal
      v-model:show="formDialog"
      preset="card"
      :title="editing ? '编辑学员' : '新增学员'"
      style="max-width:820px"
    >
      <n-form label-placement="top" :show-require-mark="false">
        <div class="form-grid">
          <n-form-item v-for="[label, key, type] in fields" :key="key" :label="label">
            <n-select
              v-if="type === 'select'"
              v-model:value="form[key]"
              :options="selectOptions(key)"
              :placeholder="'请选择' + label"
              clearable
            />
            <n-input-number
              v-else-if="type === 'number'"
              v-model:value="form[key]"
              :min="0"
              style="width:100%"
            />
            <n-input
              v-else
              v-model:value="form[key]"
              :placeholder="'请输入' + label"
            />
          </n-form-item>
        </div>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="formDialog = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>

    <!-- 详情 -->
    <n-modal
      v-model:show="detailDialog"
      preset="card"
      title="学员详情"
      style="max-width:760px"
    >
      <n-descriptions bordered :column="2" label-placement="left">
        <n-descriptions-item v-for="[label, key] in fields" :key="key" :label="label">
          {{ formatDetail(key) }}
        </n-descriptions-item>
      </n-descriptions>
    </n-modal>
  </section>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 20px;
}
@media (max-width: 700px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
