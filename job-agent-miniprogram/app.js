const api = require("../../utils/api");
const storage = require("../../utils/storage");

App({
  globalData: {
    appData: storage.defaultAppData(),
    ready: false,
    syncing: false,
  },

  onLaunch() {
    this.bootstrap(false);
  },

  bootstrap(useDemo) {
    wx.showLoading({ title: "登录中..." });
    return api
      .login(useDemo)
      .then((res) => {
        wx.setStorageSync("token", res.token);
        storage.setAppData(res.data);
        this.globalData.appData = res.data;
        this.globalData.ready = true;
        if (res.isNew && !useDemo) {
          wx.showModal({
            title: "欢迎使用 JobAgent",
            content: "是否加载示例数据快速体验？",
            confirmText: "加载示例",
            cancelText: "空白开始",
            success: (modal) => {
              if (modal.confirm) {
                this.bootstrap(true).then(() => {
                  wx.reLaunch({ url: "/pages/index/index" });
                });
              }
            },
          });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "登录失败", icon: "none" });
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  getData() {
    return this.globalData.appData || storage.getAppData();
  },

  updateData(next) {
    this.globalData.appData = next;
    storage.setAppData(next);
    this.scheduleSave();
    return next;
  },

  scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      this.syncToCloud();
    }, 800);
  },

  syncToCloud() {
    const token = wx.getStorageSync("token");
    if (!token) return Promise.resolve();
    this.globalData.syncing = true;
    return api
      .saveData(this.getData())
      .catch((err) => {
        wx.showToast({ title: err.message || "同步失败", icon: "none" });
      })
      .finally(() => {
        this.globalData.syncing = false;
      });
  },
});
