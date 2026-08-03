const api = require("../../utils/api");

Page({
  data: {
    matches: [],
    jobs: [],
    loading: false,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.runMatch();
  },

  runMatch() {
    const app = getApp();
    const { profile, jobs } = app.getData();
    this.setData({ jobs });

    if (jobs.length === 0) {
      this.setData({ matches: [] });
      return;
    }

    this.setData({ loading: true });
    api
      .matchJobs(profile, jobs)
      .then((res) => {
        const matches = (res.matches || []).map((m) => {
          const job = jobs.find((j) => j.id === m.jobId) || {};
          return {
            ...m,
            title: job.title,
            company: job.company,
            matchedPreview: (m.matchedSkills || []).slice(0, 4).join("、"),
            missingPreview: (m.missingSkills || []).slice(0, 4).join("、"),
          };
        });
        this.setData({ matches });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "匹配失败", icon: "none" });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },
});
