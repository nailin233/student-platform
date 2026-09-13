const app = getApp()
const { addEnrollment } = require('../../utils/enrollment')

const GENDER_OPTIONS = ['男', '女']

Page({
  data: {
    courseId: '',
    courseName: '',
    genderOptions: GENDER_OPTIONS,
    genderIndex: -1,
    name: '',
    age: '',
    phone: '',
    submitting: false
  },

  onLoad(options) {
    const courseId = options.courseId || ''
    this.setData({ courseId })
    if (courseId) this.loadCourseName(courseId)
  },

  // 回显所选课程名称，避免用户不知道自己报的是哪个班
  loadCourseName(courseId) {
    wx.request({
      url: app.globalData.apiBase + '/api/courses',
      success: res => {
        if (res.statusCode !== 200) return
        const hit = (res.data || []).find(c => String(c.id) === String(courseId))
        if (hit) this.setData({ courseName: hit.name })
      }
    })
  },

  // 通用输入绑定
  input(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value })
  },

  // 性别选择
  onGenderChange(e) {
    this.setData({ genderIndex: Number(e.detail.value) })
  },

  submit() {
    if (this.data.submitting) return
    const d = this.data

    // 校验：提示写人话，不出现「字段校验失败」
    if (!d.name.trim()) {
      return wx.showToast({ title: '请填写姓名', icon: 'none' })
    }
    if (!/^1[3-9]\d{9}$/.test(d.phone.trim())) {
      return wx.showToast({ title: '请填写正确的手机号', icon: 'none' })
    }
    if (d.age && (Number(d.age) < 1 || Number(d.age) > 120)) {
      return wx.showToast({ title: '年龄请填 1-120 之间', icon: 'none' })
    }

    this.setData({ submitting: true })

    wx.request({
      url: app.globalData.apiBase + '/api/students',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {
        name: d.name.trim(),
        gender: d.genderIndex >= 0 ? GENDER_OPTIONS[d.genderIndex] : null,
        age: d.age ? Number(d.age) : null,
        phone: d.phone.trim(),
        course_id: d.courseId ? Number(d.courseId) : null
      },
      success: res => {
        if (res.statusCode === 201) {
          // 记到本地，供「我的」页面展示报名历史
          addEnrollment({
            name: d.name.trim(),
            phone: d.phone.trim(),
            courseName: d.courseName
          })
          wx.redirectTo({
            url: '/pages/success/success?name=' + encodeURIComponent(d.name.trim())
          })
        } else {
          wx.showToast({ title: '提交失败，请检查信息', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '无法连接服务，请稍后重试', icon: 'none' })
      },
      complete: () => this.setData({ submitting: false })
    })
  }
})
