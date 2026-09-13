const app = getApp()
Page({
  data: { courses: [], teachers: [], teacherNames: '', loading: true, error: '' },
  onShow() {
    wx.request({ url: app.globalData.apiBase + '/api/courses', success: res => { if (res.statusCode === 200) this.setData({ courses: res.data || [] }); else this.setData({ error: '课程加载失败，请稍后重试' }) }, fail: () => this.setData({ error: '无法连接报名服务，请检查后端是否启动' }), complete: () => this.setData({ loading: false }) })
    wx.request({ url: app.globalData.apiBase + '/api/options', success: res => { if (res.statusCode === 200) { const teachers = res.data.teachers || []; this.setData({ teachers, teacherNames: teachers.map(t => t.name).join('、') }) } } })
  },
  chooseCourse(e) { wx.navigateTo({ url: '/pages/signup/signup?courseId=' + e.currentTarget.dataset.id }) }
})
