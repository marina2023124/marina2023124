const api = require("../../utils/api");
const storage = require("../../utils/storage");

function draftToJob(draft, rawText) {
  return {
    title: draft.title || "未命名岗位",
    company: draft.company || "未知公司",
    location: draft.location || "",
    salary: draft.salary || "",
    description: draft.description || rawText || "",
    requirements: draft.requirements || [],
    preferredSkills: draft.preferredSkills || [],
    responsibilities: draft.responsibilities || [],
    source: draft.source || "manual",
    url: draft.url || "",
  };
}

Page({
  data: {
    mode: "text",
    text: "",
    importUrl: "",
    parsing: false,
    preview: null,
    requirementsText: "",
  },

  setMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, preview: null });
  },

  onTextInput(e) {
    this.setData({ text: e.detail.value });
  },

  onUrlInput(e) {
    this.setData({ importUrl: e.detail.value });
  },

  onPreviewInput(e) {
    const field = e.currentTarget.dataset.field;
    const preview = { ...this.data.preview, [field]: e.detail.value };
    this.setData({ preview });
  },

  onRequirementsInput(e) {
    this.setData({ requirementsText: e.detail.value });
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

  pasteUrl() {
    wx.getClipboardData({
      success: (res) => {
        if (res.data) {
          this.setData({ importUrl: res.data.trim() });
          wx.showToast({ title: "已粘贴链接", icon: "success" });
        }
      },
    });
  },

  parseText() {
    const text = this.data.text.trim();
    if (!text) {
      wx.showToast({ title: "请先粘贴 JD", icon: "none" });
      return;
    }
    this.setData({ parsing: true });
    api
      .parseJobText(text)
      .then((res) => this.showPreview(draftToJob(res.draft, text)))
      .catch((err) => wx.showToast({ title: err.message || "解析失败", icon: "none" }))
      .then(() => this.setData({ parsing: false }));
  },

  importUrl() {
    const url = this.data.importUrl.trim();
    if (!url) {
      wx.showToast({ title: "请输入岗位链接", icon: "none" });
      return;
    }
    this.setData({ parsing: true });
    api
      .importJobUrl(url)
      .then((res) => {
        if (!res.draft) throw new Error("链接导入失败");
        this.showPreview(draftToJob(res.draft, res.draft.description || ""));
      })
      .catch((err) => wx.showToast({ title: err.message || "导入失败", icon: "none" }))
      .then(() => this.setData({ parsing: false }));
  },

  showPreview(job) {
    this.setData({
      preview: job,
      requirementsText: (job.requirements || []).join("\n"),
    });
  },

  backToEdit() {
    this.setData({ preview: null });
  },

  saveJob() {
    const preview = this.data.preview;
    if (!preview || !preview.title.trim()) {
      wx.showToast({ title: "请填写岗位名称", icon: "none" });
      return;
    }

    const requirements = this.data.requirementsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const app = getApp();
    const data = app.getData();
    data.jobs.unshift({
      id: storage.uid("j"),
      title: preview.title.trim(),
      company: (preview.company || "").trim() || "未知公司",
      location: preview.location || undefined,
      salary: preview.salary || undefined,
      description: preview.description || "",
      requirements,
      preferredSkills: preview.preferredSkills || [],
      responsibilities: preview.responsibilities || [],
      status: "saved",
      source: preview.source || "manual",
      url: preview.url || undefined,
      createdAt: new Date().toISOString(),
    });
    app.updateData(data);
    wx.showToast({ title: "添加成功", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  },
});
