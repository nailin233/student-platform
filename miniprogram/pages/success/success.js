Page({
  data: {
    name: ''
  },

  onLoad(options) {
    // 回显报名人姓名，让用户确认提交成功的是本人
    if (options.name) {
      this.setData({ name: decodeURIComponent(options.name) })
    }
  },

  back() {
    wx.reLaunch({ url: '/pages/courses/courses' })
  }
})
