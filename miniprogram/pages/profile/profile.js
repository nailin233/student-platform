const { getEnrollments, clearEnrollments } = require('../../utils/enrollment')

Page({
  data: {
    enrollments: [],
    // Demo 不做真实登录，头像与昵称取最近一次报名的信息
    nickname: '未报名学员',
    avatarText: '访',
    phoneText: ''
  },

  onShow() {
    // 报名成功后会回到首页再切过来，用 onShow 保证记录是新的
    this.refresh()
  },

  refresh() {
    const list = getEnrollments()
    const latest = list[0]

    this.setData({
      enrollments: list,
      nickname: latest ? latest.name : '未报名学员',
      avatarText: latest ? String(latest.name).charAt(0) : '访',
      phoneText: latest ? maskPhone(latest.phone) : ''
    })
  },

  goCourses() {
    wx.switchTab({ url: '/pages/courses/courses' })
  },

  // 拨打机构电话
  callSchool() {
    wx.makePhoneCall({
      phoneNumber: '4000000000',
      fail: () => {}
    })
  },

  clearHistory() {
    wx.showModal({
      title: '清空报名记录',
      content: '将删除本机保存的全部报名记录，不影响机构后台的学员数据。确定继续吗？',
      confirmText: '清空',
      confirmColor: '#d54941',
      success: res => {
        if (!res.confirm) return
        clearEnrollments()
        this.refresh()
        wx.showToast({ title: '已清空', icon: 'none' })
      }
    })
  }
})

/** 手机号中间四位打码，Demo 展示用 */
function maskPhone(phone) {
  const p = String(phone || '')
  if (p.length !== 11) return p
  return p.slice(0, 3) + '****' + p.slice(7)
}
