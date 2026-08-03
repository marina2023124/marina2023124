const storage = require("../../utils/storage");

Page({
  data: {
    name: "",
    summary: "",
    targetRole: "",
    skills: "",
    workList: [],
  },

  onShow() {
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.refresh();
  },

  refresh() {
    const { profile } = getApp().getData();
    this.setData({
      name: profile.name || "",
      summary: profile.summary || "",
      targetRole: (profile.targetRoles && profile.targetRoles[0]) || "",
      skills: (profile.skills || []).map((s) => s.name).join("、"),
      workList: profile.workExperiences || [],
    });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onSummaryInput(e) {
    this.setData({ summary: e.detail.value });
  },

  onTargetInput(e) {
    this.setData({ targetRole: e.detail.value });
  },

  onSkillsInput(e) {
    this.setData({ skills: e.detail.value });
  },

  saveProfile() {
    const app = getApp();
    const data = app.getData();
    const skills = this.data.skills
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name, i) => {
        const existing = data.profile.skills[i];
        return {
          id: (existing && existing.id) || storage.uid("s"),
          name,
          level: (existing && existing.level) || "intermediate",
        };
      });

    data.profile.name = this.data.name.trim();
    data.profile.summary = this.data.summary.trim();
    data.profile.targetRoles = this.data.targetRole.trim()
      ? [this.data.targetRole.trim()]
      : [];

    data.profile.skills = skills;
    app.updateData(data);
    wx.showToast({ title: "已保存", icon: "success" });
  },

  addWork() {
    wx.showModal({
      title: "添加工作经历",
      editable: true,
      placeholderText: "格式：公司 | 职位 | 2021-03",
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const parts = res.content.split("|").map((p) => p.trim());
        const app = getApp();
        const data = app.getData();
        data.profile.workExperiences.unshift({
          id: storage.uid("w"),
          company: parts[0] || "未命名公司",
          title: parts[1] || "职位",
          startDate: parts[2] || "2021-01",
          description: "",
          achievements: [],
          skills: [],
        });
        app.updateData(data);
        this.refresh();
      },
    });
  },
});
