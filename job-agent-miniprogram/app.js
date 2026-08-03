const api = require("./utils/api");
const storage = require("./utils/storage");

App({
  globalData: {
    appData: storage.defaultAppData(),
    ready: false,
    syncing: false,
    linked: false,
    loginError: null,
  },

  onLaunch() {
    this._readyPromise = this.bootstrap(false);
  },

  whenReady() {
    return this._readyPromise || Promise.resolve();
  },

  bootstrap(useDemo) {
    wx.removeStorageSync("token");
    this.globalData.ready = false;
    wx.showLoading({ title: "登录中...", mask: true });
    return api
      .login(useDemo)
      .then((res) => {
        wx.setStorageSync("token", res.token);
        storage.setAppData(res.data);
        this.globalData.appData = res.data;
        this.globalData.ready = true;
        this.globalData.linked = Boolean(res.linked);
        this.globalData.loginError = null;
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
        const message = err.message || "登录失败";
        this.globalData.loginError = message;
        this.globalData.ready = true;
        this.globalData.appData = storage.getAppData();
        wx.showModal({
          title: "云端登录失败",
          content:
            message +
            "\n\n已使用本地缓存。若报 404，请在 Vercel 将最新 main 部署 Promote 到 Production。",
          showCancel: false,
        });
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
        wx.showToast({ title: err.message || "同步失败", icon: "none", duration: 3000 });
      })
      .finally(() => {
        this.globalData.syncing = false;
      });
  },
});
