<script setup>
import { ref } from 'vue'
import { NButton, NInput, NForm, NFormItem, NCheckbox, useMessage } from 'naive-ui'

const emit = defineEmits(['login'])
const message = useMessage()

const email = ref('')
const password = ref('')
const remember = ref(false)
const loading = ref(false)

async function submit() {
  if (!email.value.trim()) return message.error('请输入工作邮箱')
  if (!password.value) return message.error('请输入密码')

  loading.value = true
  try {
    // Demo 阶段：不做真实鉴权，仅做入口校验
    await new Promise(r => setTimeout(r, 250))
    message.success('登录成功，正在进入工作台')
    emit('login')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-shell">
    <section class="login-visual">
      <div class="login-brand">EDU<span>FLOW</span></div>
      <div class="visual-copy">
        <p class="kicker">SMART TRAINING OPERATIONS</p>
        <h1>让每一次报名，<br /><em>都变成增长。</em></h1>
        <p>用清晰的数据和轻松的工作流，管理课程、老师与学员关系。</p>
      </div>
      <div class="chart-card">
        <div>
          <small>本月报名趋势</small>
          <strong>+28.4%</strong>
        </div>
        <div class="chart-bars">
          <i v-for="n in [32,48,40,62,55,78,68,92]" :key="n" :style="{ height: n + '%' }" />
        </div>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="card-head">
          <span class="mini-logo">EF</span>
          <span>管理后台</span>
        </div>
        <h2>欢迎回来</h2>
        <p class="muted">登录你的工作空间，继续管理机构业务</p>

        <n-form label-placement="top" :show-require-mark="false" @submit.prevent="submit">
          <n-form-item label="工作邮箱">
            <n-input
              v-model:value="email"
              size="large"
              placeholder="you@school.cn"
              @keyup.enter="submit"
            />
          </n-form-item>
          <n-form-item label="密码">
            <n-input
              v-model:value="password"
              type="password"
              size="large"
              show-password-on="click"
              placeholder="请输入密码"
              @keyup.enter="submit"
            />
          </n-form-item>
          <div class="form-row">
            <n-checkbox v-model:checked="remember">记住我</n-checkbox>
            <a href="#" @click.prevent>忘记密码？</a>
          </div>
          <n-button
            type="primary"
            size="large"
            block
            :loading="loading"
            style="margin-top:16px"
            @click="submit"
          >
            进入工作台 →
          </n-button>
        </n-form>

        <div class="trust">
          <span>● 数据安全加密</span>
          <span>● 7×24 服务支持</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-shell {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;
  background: #f3f3f4;
}

.login-visual {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 48px 56px;
  color: #fff;
  background: linear-gradient(140deg, #0052d9 0%, #003cab 60%, #00266e 100%);
}

.login-brand {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1px;
}

.login-brand span {
  color: #bcd4f5;
}

.visual-copy {
  margin: 48px 0;
}

.kicker {
  font-size: 13px;
  letter-spacing: 2px;
  color: rgba(255, 255, 255, 0.65);
  margin: 0;
}

.visual-copy h1 {
  margin: 16px 0;
  font-size: 34px;
  line-height: 1.45;
  font-weight: 600;
  color: #fff;
}

.visual-copy h1 em {
  font-style: normal;
  color: #ffd666;
}

.visual-copy p {
  max-width: 420px;
  font-size: 16px;
  line-height: 1.8;
  color: rgba(255, 255, 255, 0.78);
}

.chart-card {
  padding: 22px 24px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
}

.chart-card small {
  display: block;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.chart-card strong {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 72px;
  margin-top: 16px;
}

.chart-bars i {
  flex: 1;
  background: rgba(255, 255, 255, 0.55);
  border-radius: 4px 4px 0 0;
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.login-card {
  width: min(420px, 100%);
  padding: 36px 34px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.6);
}

.mini-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: #0052d9;
  border-radius: 8px;
}

.login-card h2 {
  margin: 22px 0 6px;
  font-size: 26px;
  font-weight: 600;
  color: rgba(0, 0, 0, 0.9);
}

.login-card .muted {
  margin: 0 0 26px;
  font-size: 15px;
  color: rgba(0, 0, 0, 0.6);
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.form-row a {
  font-size: 15px;
  color: #0052d9;
  text-decoration: none;
}

.trust {
  display: flex;
  justify-content: space-between;
  margin-top: 28px;
  padding-top: 20px;
  font-size: 14px;
  color: rgba(0, 0, 0, 0.45);
  border-top: 1px solid #e7e8eb;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-visual {
    display: none;
  }
}
</style>
