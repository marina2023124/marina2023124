Component({
  data: {
    selected: 0,
    list: [
      { pagePath: "/pages/index/index", text: "首页", icon: "🏠" },
      { pagePath: "/pages/experience/experience", text: "经历", icon: "👤" },
      { pagePath: "/pages/jobs/jobs", text: "岗位", icon: "💼" },
      { pagePath: "/pages/match/match", text: "匹配", icon: "🎯" },
    ],
  },

  methods: {
    switchTab(e) {
      const index = e.currentTarget.dataset.index;
      const item = this.data.list[index];
      wx.switchTab({ url: item.pagePath });
    },
  },
});
