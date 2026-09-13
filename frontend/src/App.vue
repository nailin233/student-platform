<script setup>
import { ref, computed, onMounted, h } from 'vue'
import {
  NConfigProvider, NMessageProvider, NDialogProvider,
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent,
  NMenu, NBreadcrumb, NBreadcrumbItem,
  NCard, NButton, NSpace, NGrid, NGridItem, NStatistic, NAlert
} from 'naive-ui'
import Students from './components/Students.vue'
import Courses from './components/Courses.vue'
import Teachers from './components/Teachers.vue'
import Login from './components/Login.vue'

// 登录态：sessionStorage 保持刷新后不掉线
const authed = ref(sessionStorage.getItem('eduflow_auth') === '1')
const view = ref(location.hash.slice(1) || 'dashboard')

if (!location.hash) location.hash = authed.value ? 'dashboard' : 'login'

addEventListener('hashchange', () => {
  const next = location.hash.slice(1) || 'dashboard'
  view.value = next
  // 未登录时访问业务页，强制回登录页
  if (!authed.value && next !== 'login') location.hash = 'login'
})

function onLogin() {
  authed.value = true
  sessionStorage.setItem('eduflow_auth', '1')
  location.hash = 'dashboard'
  loadStats()
}

function logout() {
  authed.value = false
  sessionStorage.removeItem('eduflow_auth')
  location.hash = 'login'
}

const menu = [
  { label: '工作台', key: 'dashboard' },
  { label: '学员管理', key: 'students' },
  { label: '课程管理', key: 'courses' },
  { label: '老师管理', key: 'teachers' }
]

const title = computed(() => menu.find(x => x.key === view.value)?.label || '工作台')
const select = key => (location.hash = key)

const stats = ref({ students: 0, courses: 0, teachers: 0, unpaid_amount: 0 })
const statsError = ref('')
const statsLoading = ref(false)

async function loadStats() {
  statsLoading.value = true
  statsError.value = ''
  try {
    const res = await fetch('/api/dashboard/stats')
    if (!res.ok) throw Error(`统计接口返回 ${res.status}`)
    stats.value = await res.json()
  } catch (e) {
    statsError.value = '统计数据加载失败：' + e.message
  } finally {
    statsLoading.value = false
  }
}

onMounted(() => {
  if (authed.value) loadStats()
})

// Naive UI 主题：色彩集中在这里，不再靠全局 CSS 覆盖
const themeOverrides = {
  common: {
    primaryColor: '#0052d9',
    primaryColorHover: '#366ef4',
    primaryColorPressed: '#003cab',
    primaryColorSuppl: '#366ef4',
    borderRadius: '6px',
    fontSize: '16px',
    fontSizeMedium: '16px'
  },
  Button: { heightMedium: '42px', heightLarge: '46px', fontSizeMedium: '16px', fontSizeLarge: '17px' },
  DataTable: { thFontSize: '16px', tdFontSize: '16px', thFontWeight: '600' },
  Card: { titleFontSize: '20px' },
  Input: { heightMedium: '42px', fontSize: '16px' }
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <!-- provider 必须包住全部内容，含 Login，否则 useMessage/useDialog 失效 -->
    <n-message-provider>
      <n-dialog-provider>
        <Login v-if="!authed" @login="onLogin" />

        <n-layout v-else has-sider style="min-height:100vh">
          <n-layout-sider bordered width="240" content-style="padding:24px 12px;background:#242424">
            <div style="color:#fff;font-size:22px;font-weight:700;padding:8px 16px 28px">
              学员管理平台
            </div>
            <n-menu :value="view" :options="menu" inverted @update:value="select" />
          </n-layout-sider>

          <n-layout>
            <n-layout-header bordered style="height:72px;padding:0 32px;display:flex;align-items:center;justify-content:space-between">
              <n-breadcrumb>
                <n-breadcrumb-item>运营中心</n-breadcrumb-item>
                <n-breadcrumb-item>{{ title }}</n-breadcrumb-item>
              </n-breadcrumb>
              <n-button quaternary size="small" @click="logout">退出登录</n-button>
            </n-layout-header>

            <n-layout-content content-style="padding:32px;max-width:1400px;width:100%;margin:0 auto">
              <!-- 工作台 -->
              <section v-if="view === 'dashboard'" class="business-page">
                <header class="page-head">
                  <div>
                    <h1>管理员工作台</h1>
                    <p>欢迎回来，这里是机构运营概览。</p>
                  </div>
                  <n-button type="primary" size="large" @click="loadStats" :loading="statsLoading">
                    刷新数据
                  </n-button>
                </header>

                <n-alert v-if="statsError" type="error" closable style="margin-bottom:16px" @close="statsError=''">
                  {{ statsError }}
                </n-alert>

                <n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen" item-responsive>
                  <n-grid-item span="4 s:2 m:1">
                    <n-card :bordered="false" class="data-card">
                      <n-statistic label="学员总数" :value="stats.students" />
                    </n-card>
                  </n-grid-item>
                  <n-grid-item span="4 s:2 m:1">
                    <n-card :bordered="false" class="data-card">
                      <n-statistic label="在售课程" :value="stats.courses" />
                    </n-card>
                  </n-grid-item>
                  <n-grid-item span="4 s:2 m:1">
                    <n-card :bordered="false" class="data-card">
                      <n-statistic label="在职老师" :value="stats.teachers" />
                    </n-card>
                  </n-grid-item>
                  <n-grid-item span="4 s:2 m:1">
                    <n-card :bordered="false" class="data-card">
                      <n-statistic label="待收金额">
                        <template #default>
                          ¥{{ Number(stats.unpaid_amount || 0).toFixed(2) }}
                        </template>
                      </n-statistic>
                    </n-card>
                  </n-grid-item>
                </n-grid>

                <n-card :bordered="false" class="data-card" style="margin-top:16px" title="快捷入口">
                  <n-space>
                    <n-button type="primary" @click="select('students')">查看学员</n-button>
                    <n-button @click="select('courses')">管理课程</n-button>
                    <n-button @click="select('teachers')">管理老师</n-button>
                  </n-space>
                </n-card>
              </section>

              <Students v-else-if="view === 'students'" />
              <Courses v-else-if="view === 'courses'" />
              <Teachers v-else-if="view === 'teachers'" />
            </n-layout-content>
          </n-layout>
        </n-layout>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>
