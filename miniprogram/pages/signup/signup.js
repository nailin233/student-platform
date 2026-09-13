const app = getApp()
Page({
  data: { courseId: '', name: '', gender: '', age: '', phone: '', submitting: false },
  onLoad(options) { this.setData({ courseId: options.courseId || '' }) },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }) },
  submit() {
    const d = this.data
    if (!d.name || !d.phone) return wx.showToast({ title: '请填写姓名和电话', icon: 'none' })
    this.setData({ submitting: true })
    wx.request({ url: app.globalData.apiBase + '/api/students', method: 'POST', data: { name: d.name, gender: d.gender || null, age: d.age ? Number(d.age) : null, phone: d.phone, course_id: d.courseId ? Number(d.courseId) : null }, success: res => { if (res.statusCode === 201) wx.redirectTo({ url: '/pages/success/success' }); else wx.showToast({ title: '提交失败，请检查信息', icon: 'none' }) }, fail: () => wx.showToast({ title: '提交失败，请稍后重试', icon: 'none' }), complete: () => this.setData({ submitting: false }) })
  }
})
