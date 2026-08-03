const api = require("../../utils/api");
const storage = require("../../utils/storage");
const clipboardImport = require("../../utils/clipboard-import");

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

function fingerprint(text) {
  return String(text || "").slice(0, 120);
}

function parseBossCardLine(line) {
  const trimmed = (line || "").trim();
  if (!trimmed) return { company: "", title: "" };
  const parts = trimmed.split(/[·•]/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { company: parts[0], title: parts.slice(1).join(" · ") };
  }
  return { company: "", title: trimmed };
}

Page({
  data: {
    mode: "wechat",
    text: "",
    importUrl: "",
    quickLine: "",
    quickSalary: "",
    quickNotes: "",
    parsing: false,
    preview: null,
    requirementsText: "",
  },

  onLoad(options) {
    if (options.url) {
      this.setData({ mode: "url", importUrl: decodeURIComponent(options.url) });
      return;
    }
    if (options.text) {
      this.setData({ mode: "text", text: decodeURIComponent(options.text) });
      return;
    }

    const pending = getApp().globalData.pendingImport;
    if (pending) {
      getApp().globalData.pendingImport = null;
      if (pending.url) {
        this.setData({ mode: "url", importUrl: pending.url });
      } else if (pending.text) {
        this.setData({ mode: "text", text: pending.text });
      }
    }
  },

  onShow() {
    if (this.data.mode !== "wechat") {
      this.tryClipboardImport(false);
    }
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

  onQuickLineInput(e) {
    this.setData({ quickLine: e.detail.value });
  },

  onQuickSalaryInput(e) {
    this.setData({ quickSalary: e.detail.value });
  },

  onQuickNotesInput(e) {
    this.setData({ quickNotes: e.detail.value });
  },

  saveQuick() {
    const { company, title } = parseBossCardLine(this.data.quickLine);
    if (!title) {
      wx.showToast({ title: "请填写公司 · 岗位", icon: "none" });
      return;
    }
    this.showPreview({
      title,
      company: company || "未知公司",
      salary: this.data.quickSalary.trim(),
      description: this.data.quickNotes.trim(),
      requirements: [],
      preferredSkills: [],
      responsibilities: [],
      source: "boss",
      url: "",
    });
  },

  pasteFromClipboard() {
    clipboardImport
      .getClipboardData()
      .then((data) => {
        if (!data) return;
        this.applyClipboardPayload(data, true);
      })
      .catch(() => {
        wx.showToast({ title: "读取剪贴板失败", icon: "none" });
      });
  },

  detectClipboard() {
    this.tryClipboardImport(true);
  },

  tryClipboardImport(force) {
    if (this.data.preview || this.data.parsing) return;

    clipboardImport
      .getClipboardData()
      .then((data) => {
        const detected = clipboardImport.detectClipboardImport(data);
        if (!detected) {
          if (force) wx.showToast({ title: "未检测到岗位链接或 JD", icon: "none" });
          return;
        }

        const key = fingerprint(detected.value);
        const lastKey = wx.getStorageSync("last-clipboard-import") || "";
        if (!force && key === lastKey) return;

        wx.showModal({
          title: `检测到${detected.label}`,
          content: force
            ? "是否立即导入？"
          : "是否导入刚复制的内容？（BOSS 卡片无链接，请先在 BOSS 详情页复制 JD 文字）",
          confirmText: "导入",
          success: (res) => {
            if (!res.confirm) return;
            wx.setStorageSync("last-clipboard-import", key);
            this.applyDetectedImport(detected);
          },
        });
      })
      .catch(() => {
        if (force) wx.showToast({ title: "读取剪贴板失败", icon: "none" });
      });
  },

  applyClipboardPayload(data, autoImport) {
    const detected = clipboardImport.detectClipboardImport(data);
    if (!detected) {
      this.setData({ text: data, mode: "text" });
      wx.showToast({ title: "已粘贴", icon: "success" });
      if (autoImport && clipboardImport.looksLikeJobText(data)) {
        this.parseText();
      }
      return;
    }
    this.applyDetectedImport(detected);
  },

  applyDetectedImport(detected) {
    if (detected.type === "url") {
      this.setData({ mode: "url", importUrl: detected.value });
      this.importUrl();
      return;
    }
    this.setData({ mode: "text", text: detected.value });
    this.parseText();
  },

  chooseScreenshot() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album"],
      sizeType: ["compressed"],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;
        this.setData({ parsing: true });
        api
          .ocrJobImage(file.tempFilePath)
          .then((body) => {
            const text = body.text || "";
            const draft = body.draft || {};
            const method = body.method === "vision" ? "DeepSeek 识图" : "OCR";
            this.showPreview(draftToJob(draft, text));
            wx.showToast({ title: `${method}完成`, icon: "success" });
          })
          .catch((err) => wx.showToast({ title: err.message || "识别失败", icon: "none" }))
          .then(() => this.setData({ parsing: false }));
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
    wx.showToast({ title: "收藏成功", icon: "success" });
    setTimeout(() => wx.navigateBack(), 500);
  },
});
