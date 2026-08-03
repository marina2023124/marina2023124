const api = require("../../utils/api");

Page({
  data: {
    matches: [],
    jobs: [],
    loading: false,
    llmReady: false,
    aiAnalyzing: null,
    aiResult: null,
    showAiModal: false,
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    const app = getApp();
    app.whenReady().then(() => {
      this.runMatch();
      this.checkLlm();
    });
  },

  checkLlm() {
    api
      .getLlmStatus()
      .then((res) => {
        this.setData({ llmReady: Boolean(res.configured && res.liveValid !== false) });
      })
      .catch(() => this.setData({ llmReady: false }));
  },

  runMatch() {
    const app = getApp();
    const { profile, jobs } = app.getData();
    this.setData({ jobs });

    if (jobs.length === 0) {
      this.setData({ matches: [] });
      return;
    }

    if (!wx.getStorageSync("token")) {
      const msg = app.globalData.loginError || "请先完成登录";
      wx.showToast({ title: msg, icon: "none" });
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
      .then(() => {
        this.setData({ loading: false });
      });
  },

  runAiAnalysis(e) {
    if (!this.data.llmReady) {
      wx.showToast({ title: "DeepSeek 未配置", icon: "none" });
      return;
    }

    const jobId = e.currentTarget.dataset.id;
    const app = getApp();
    const { profile, jobs } = app.getData();
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;

    this.setData({ aiAnalyzing: jobId, showAiModal: true, aiResult: null });

    api
      .llmMatch(profile, job)
      .then((res) => {
        if (!res.ok || !res.analysis) {
          throw new Error(res.error || "分析失败");
        }
        const analysis = res.analysis;
        const mappings = (res.requirementMappings || [])
          .slice(0, 6)
          .map((m) => `${m.requirement} → ${m.matchedExperience || m.matchedProject || "待补充"}`);
        this.setData({
          aiResult: {
            title: job.title,
            company: job.company,
            score: res.ruleScore,
            summary: analysis.overall || "分析完成",
            advice: analysis.resumeAdvice || "",
            mappings,
          },
        });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "AI 分析失败", icon: "none" });
        this.setData({ showAiModal: false });
      })
      .then(() => {
        this.setData({ aiAnalyzing: null });
      });
  },

  closeAiModal() {
    this.setData({ showAiModal: false, aiResult: null });
  },

  goAgent() {
    wx.navigateTo({ url: "/pages/agent/agent" });
  },
});
