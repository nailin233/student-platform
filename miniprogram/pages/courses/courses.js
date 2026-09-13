const app = getApp()

Page({
  data: {
    courses: [],
    teacherNames: '',
    loading: true,
    error: ''
  },

  onLoad() {
    this.loadCourses()
    this.loadTeachers()
  },

  onPullDownRefresh() {
    Promise.all([this.loadCourses(), this.loadTeachers()]).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  loadCourses() {
    this.setData({ loading: true, error: '' })
    return new Promise(resolve => {
      wx.request({
        url: app.globalData.apiBase + '/api/courses',
        success: res => {
          if (res.statusCode === 200) {
            // 后端 price 为 float，会返回 1680.0 这类值，统一格式化为两位小数
            const courses = (res.data || []).map(c => ({
              ...c,
              priceText: Number(c.price || 0).toFixed(2)
            }))
            this.setData({ courses, error: '' })
          } else {
            this.setData({ error: '课程加载失败，请稍后重试' })
          }
        },
        fail: () => this.setData({ error: '无法连接报名服务，请检查后端是否启动' }),
        complete: () => {
          this.setData({ loading: false })
          resolve()
        }
      })
    })
  },

  loadTeachers() {
    return new Promise(resolve => {
      wx.request({
        url: app.globalData.apiBase + '/api/options',
        success: res => {
          if (res.statusCode === 200) {
            const teachers = res.data.teachers || []
            this.setData({ teacherNames: teachers.map(t => t.name).join('、') })
          }
        },
        complete: resolve
      })
    })
  },

  chooseCourse(e) {
    wx.navigateTo({
      url: '/pages/signup/signup?courseId=' + e.currentTarget.dataset.id
    })
  }
})
