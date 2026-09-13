const app = getApp()

Page({
  data: {
    teachers: [],
    loading: true,
    error: ''
  },

  onLoad() {
    this.loadTeachers()
  },

  onPullDownRefresh() {
    this.loadTeachers().finally(() => wx.stopPullDownRefresh())
  },

  loadTeachers() {
    this.setData({ loading: true, error: '' })
    return new Promise(resolve => {
      wx.request({
        url: app.globalData.apiBase + '/api/teachers',
        success: res => {
          if (res.statusCode === 200) {
            const teachers = (res.data || []).map(t => ({
              ...t,
              // 无专业时给一个占位，避免卡片出现空白行
              specialtyText: t.specialty || '暂无专业信息',
              // 头像只取姓氏首字，「陈老师」→「陈」，否则圆形容器装不下
              avatarText: String(t.name || '').charAt(0) || '师'
            }))
            this.setData({ teachers, error: '' })
          } else {
            this.setData({ error: '老师信息加载失败，请稍后重试' })
          }
        },
        fail: () => this.setData({ error: '无法连接服务，请检查后端是否启动' }),
        complete: () => {
          this.setData({ loading: false })
          resolve()
        }
      })
    })
  },

  // 点击电话拨打（真机可用，开发者工具会提示不支持）
  callTeacher(e) {
    const phone = e.currentTarget.dataset.phone
    if (!phone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' })
      return
    }
    wx.makePhoneCall({
      phoneNumber: String(phone),
      fail: () => {}
    })
  }
})
