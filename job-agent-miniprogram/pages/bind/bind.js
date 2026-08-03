const api = require("../../utils/api");

Page({
  data: {
    bindCode: "",
    linked: false,
    submitting: false,
    error: "",
  },

  onShow() {
    this.refreshStatus();
  },

  refreshStatus() {
    api
      .getLinkStatus()
      .then((res) => {
        this.setData({ linked: Boolean(res.linked), error: "" });
        const app = getApp();
        if (app.globalData) {
          app.globalData.linked = Boolean(res.linked);
        }
      })
      .catch((err) => {
        this.setData({ error: err.message || "查询失败" });
      });
  },

  onInput(e) {
    this.setData({ bindCode: (e.detail.value || "").replace(/\D/g, "").slice(0, 6) });
  },

  submitBind() {
    const code = this.data.bindCode.trim();
    if (code.length !== 6) {
      this.setData({ error: "请输入 6 位绑定码" });
      return;
    }

    this.setData({ submitting: true, error: "" });
    api
      .bindAccount(code)
      .then((res) => {
        const app = getApp();
        if (res.data) {
          app.updateData(res.data);
        }
        app.globalData.linked = true;
        this.setData({ linked: true, bindCode: "", submitting: false });
        wx.showToast({ title: "绑定成功", icon: "success" });
      })
      .catch((err) => {
        this.setData({
          submitting: false,
          error: err.message || "绑定失败",
        });
      });
  },
});
