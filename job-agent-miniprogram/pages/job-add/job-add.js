const api = require("../../utils/api");
const storage = require("../../utils/storage");

Page({
  data: {
    text: "",
    parsing: false,
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  pasteFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ text: res.data });
          wx.showToast({ title: "已粘贴", icon: "success" });
        }
      },
    });
  },

  submit() {
    const text = this.data.text.trim();
    if (!text) {
      wx.showToast({ title: "请先粘贴 JD", icon: "none" });
      return;
    }

    this.setData({ parsing: true });
    api
      .parseJobText(text)
      .then((res) => {
        const draft = res.draft;
        const app = getApp();
        const data = app.getData();
        data.jobs.unshift({
          id: storage.uid("j"),
          title: draft.title || "未命名岗位",
          company: draft.company || "未知公司",
          location: draft.location,
          salary: draft.salary,
          description: draft.description || text.slice(0, 500),
          requirements: draft.requirements || [],
          preferredSkills: draft.preferredSkills || [],
          responsibilities: draft.responsibilities || [],
          status: "saved",
          source: draft.source || "manual",
          createdAt: new Date().toISOString(),
        });
        app.updateData(data);
        wx.showToast({ title: "添加成功", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "解析失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ parsing: false });
      });
  },
});
