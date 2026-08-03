const api = require("../../utils/api");
const agent = require("../../utils/agent");

Page({
  data: {
    messages: [],
    input: "",
    thinking: false,
    llmReady: false,
    llmHint: "",
    quickPrompts: agent.QUICK_PROMPTS,
    scrollTo: "",
  },

  onLoad() {
    this.initChat();
    this.checkLlm();
  },

  onShow() {
    const app = getApp();
    app.whenReady().then(() => {
      this.syncFromApp();
    });
  },

  initChat() {
    const app = getApp();
    const history = (app.getData().chatHistory || []).slice();
    if (history.length === 0) {
      const welcome = agent.createChatMessage(
        "assistant",
        agent.generateAgentResponse("你好", app.getData())
      );
      history.push(welcome);
      this.persistHistory(history);
    }
    this.setData({ messages: history, scrollTo: "bottom" });
  },

  syncFromApp() {
    const history = getApp().getData().chatHistory || [];
    if (history.length) {
      this.setData({ messages: history, scrollTo: "bottom" });
    }
  },

  checkLlm() {
    api
      .getLlmStatus()
      .then((res) => {
        this.setData({
          llmReady: Boolean(res.configured && res.liveValid !== false),
          llmHint: res.hint || (res.configured ? "DeepSeek 已就绪" : "未配置 DeepSeek，使用本地回复"),
        });
      })
      .catch(() => {
        this.setData({ llmReady: false, llmHint: "无法检测 DeepSeek 状态" });
      });
  },

  persistHistory(history) {
    const app = getApp();
    const data = app.getData();
    data.chatHistory = history;
    app.updateData(data);
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  sendQuick(e) {
    this.sendMessage(e.currentTarget.dataset.text);
  },

  send() {
    this.sendMessage(this.data.input);
  },

  sendMessage(text) {
    const trimmed = (text || "").trim();
    if (!trimmed || this.data.thinking) return;

    const userMsg = agent.createChatMessage("user", trimmed);
    const history = this.data.messages.concat(userMsg);
    this.setData({ messages: history, input: "", thinking: true, scrollTo: "bottom" });
    this.persistHistory(history);

    const app = getApp();
    const appData = app.getData();

    const finish = (content) => {
      const assistantMsg = agent.createChatMessage("assistant", content);
      const next = history.concat(assistantMsg);
      this.setData({ messages: next, thinking: false, scrollTo: "bottom" });
      this.persistHistory(next);
    };

    if (this.data.llmReady) {
      api
        .llmChat(appData, trimmed)
        .then((res) => {
          if (res.ok && res.content) {
            finish(res.content);
          } else {
            finish(agent.generateAgentResponse(trimmed, appData));
          }
        })
        .catch(() => {
          finish(agent.generateAgentResponse(trimmed, appData));
        });
    } else {
      finish(agent.generateAgentResponse(trimmed, appData));
    }
  },

  clearChat() {
    wx.showModal({
      title: "清空对话",
      content: "确定清空所有聊天记录吗？",
      success: (res) => {
        if (!res.confirm) return;
        const welcome = agent.createChatMessage(
          "assistant",
          agent.generateAgentResponse("你好", getApp().getData())
        );
        this.setData({ messages: [welcome], scrollTo: "bottom" });
        this.persistHistory([welcome]);
      },
    });
  },
});
