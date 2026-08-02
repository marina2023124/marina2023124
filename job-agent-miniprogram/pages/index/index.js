const storage = require("../../utils/storage");

Page({
  data: {
    name: "",
    completeness: 0,
    workCount: 0,
    skillCount: 0,
    jobCount: 0,
    topMatch: null,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.refresh();
  },

  refresh() {
    const app = getApp();
    const data = app.getData();
    const { profile, jobs } = data;
    const completeness = storage.calcCompleteness(profile, jobs);

    this.setData({
      name: profile.name || "欢迎使用 JobAgent",
      completeness,
      workCount: profile.workExperiences.length,
      skillCount: profile.skills.length,
      jobCount: jobs.length,
    });

    if (jobs.length > 0 && profile.skills.length + profile.workExperiences.length > 0) {
      const api = require("../../utils/api");
      api.matchJobs(profile, jobs).then((res) => {
        const top = res.matches && res.matches[0];
        if (!top) return;
        const job = jobs.find((j) => j.id === top.jobId);
        this.setData({
          topMatch: job
            ? { score: top.score, title: job.title, company: job.company }
            : null,
        });
      }).catch(() => {});
    } else {
      this.setData({ topMatch: null });
    }
  },

  goExperience() {
    wx.switchTab({ url: "/pages/experience/experience" });
  },

  goJobs() {
    wx.switchTab({ url: "/pages/jobs/jobs" });
  },

  goMatch() {
    wx.switchTab({ url: "/pages/match/match" });
  },
});
