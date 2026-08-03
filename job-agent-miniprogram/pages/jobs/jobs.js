Page({
  data: {
    jobs: [],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.refresh();
  },

  refresh() {
    const { jobs } = getApp().getData();
    this.setData({ jobs });
  },

  addJob() {
    wx.navigateTo({ url: "/pages/job-add/job-add" });
  },

  deleteJob(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "删除岗位",
      content: "确定删除这个岗位吗？",
      success: (res) => {
        if (!res.confirm) return;
        const app = getApp();
        const data = app.getData();
        data.jobs = data.jobs.filter((j) => j.id !== id);
        app.updateData(data);
        this.refresh();
      },
    });
  },
});
