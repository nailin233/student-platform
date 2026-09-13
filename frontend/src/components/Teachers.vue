<script setup>
import { ref, h, onMounted } from 'vue'
import {
  useMessage,
  NButton, NSpace, NCard, NInput, NAlert,
  NDataTable, NModal, NForm, NFormItem, NTag, NPopconfirm
} from 'naive-ui'
import { request } from '../api.js'

const message = useMessage()

const rows = ref([])
const loading = ref(false)
const saving = ref(false)
const show = ref(false)
const editing = ref(null)
const error = ref('')

// 白名单字段：只回填/只提交这些，避免把 id、status 一起发给后端
const fields = [
  ['姓名', 'name', 'text'],
  ['联系电话', 'phone', 'text'],
  ['专业方向', 'specialty', 'text'],
  ['简介', 'introduction', 'textarea']
]

function emptyForm() {
  return Object.fromEntries(fields.map(([, key]) => [key, '']))
}
const form = ref(emptyForm())

const labelMap = Object.fromEntries(fields.map(([label, key]) => [key, label]))

async function req(url, opt = {}) {
  return request(url, opt, labelMap)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    rows.value = await req('/api/teachers')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function open(row = null) {
  editing.value = row?.id ?? null
  form.value = row
    ? { ...emptyForm(), ...Object.fromEntries(fields.map(([, key]) => [key, row[key] ?? ''])) }
    : emptyForm()
  show.value = true
}

async function save() {
  if (!String(form.value.name || '').trim()) return message.error('请填写老师姓名')

  const payload = Object.fromEntries(
    Object.entries(form.value).map(([k, v]) => [k, v === '' ? null : v])
  )

  saving.value = true
  try {
    await req('/api/teachers' + (editing.value ? '/' + editing.value : ''), {
      method: editing.value ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    show.value = false
    message.success(editing.value ? '老师信息已更新' : '老师已添加')
    await load()
  } catch (e) {
    message.error(e.message)
  } finally {
    saving.value = false
  }
}

async function remove(row) {
  try {
    await req('/api/teachers/' + row.id, { method: 'DELETE' })
    message.success(`已删除老师「${row.name}」`)
    await load()
  } catch (e) {
    message.error(e.message)
  }
}

const columns = [
  { title: '老师姓名', key: 'name', ellipsis: { tooltip: true } },
  { title: '联系电话', key: 'phone', width: 160, render: r => r.phone ?? '—' },
  { title: '专业方向', key: 'specialty', render: r => r.specialty ?? '—' },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: r => h(
      NTag,
      { type: r.status ? 'success' : 'default', size: 'small', bordered: false },
      { default: () => (r.status ? '在职' : '停用') }
    )
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    fixed: 'right',
    render: r => h(NSpace, { size: 12, align: 'center' }, () => [
      h(NButton, { text: true, type: 'primary', onClick: () => open(r) }, { default: () => '编辑' }),
      h(NPopconfirm, {
        onPositiveClick: () => remove(r),
        positiveText: '确认删除',
        negativeText: '再想想'
      }, {
        trigger: () => h(NButton, { text: true, type: 'error' }, { default: () => '删除' }),
        default: () => `确认删除老师「${r.name}」？该操作不可撤销，其名下学员将解除老师关联。`
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
        <h1>老师管理</h1>
        <p>维护任课老师信息。</p>
      </div>
      <n-button type="primary" size="large" @click="open()">新增老师</n-button>
    </header>

    <n-alert v-if="error" type="error" closable style="margin-bottom:16px" @close="error=''">
      {{ error }}
    </n-alert>

    <n-card :bordered="false" class="data-card">
      <n-data-table
        :columns="columns"
        :data="rows"
        :loading="loading"
        :bordered="false"
        :row-key="r => r.id"
      />
    </n-card>

    <n-modal
      v-model:show="show"
      preset="card"
      :title="editing ? '编辑老师' : '新增老师'"
      style="width:min(620px,94vw)"
    >
      <n-form label-placement="top" :show-require-mark="false">
        <n-form-item v-for="[label, key, type] in fields" :key="key" :label="label">
          <n-input
            v-model:value="form[key]"
            :type="type === 'textarea' ? 'textarea' : 'text'"
            :placeholder="'请输入' + label"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <n-button @click="show = false">取消</n-button>
          <n-button type="primary" :loading="saving" @click="save">保存</n-button>
        </n-space>
      </template>
    </n-modal>
  </section>
</template>
