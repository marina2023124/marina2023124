const JOB_URL_RE =
  /https?:\/\/(?:www\.)?(?:zhipin\.com\/job_detail\/[^\s]+|liepin\.com\/job\/[^\s]+|job\.xiaohongshu\.com\/[^\s]+)/i;

const BOSS_TEXT_RE = /(?:zhipin\.com|BOSS直聘|boss直聘)/i;

function cleanUrl(raw) {
  return (raw || "")
    .trim()
    .replace(/[)\]】》'"，。；]+$/g, "");
}

function extractFirstJobUrl(text) {
  if (!text) return "";
  const match = text.match(JOB_URL_RE);
  return match ? cleanUrl(match[0]) : "";
}

function isJobUrl(url) {
  return JOB_URL_RE.test(url || "");
}

function isBossContent(text) {
  return BOSS_TEXT_RE.test(text || "") && (text || "").length >= 40;
}

function looksLikeJobText(text) {
  const value = (text || "").trim();
  if (value.length < 80) return false;
  return /岗位|职位|职责|要求|JD|招聘|研究员|工程师|分析师/.test(value);
}

function detectClipboardImport(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const url = extractFirstJobUrl(trimmed);
  if (url) {
    return { type: "url", value: url, label: url.indexOf("zhipin.com") >= 0 ? "BOSS 岗位链接" : "岗位链接" };
  }

  if (isBossContent(trimmed) || looksLikeJobText(trimmed)) {
    return { type: "text", value: trimmed, label: isBossContent(trimmed) ? "BOSS JD 文字" : "JD 文字" };
  }

  return null;
}

function getClipboardData() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      wx.getClipboardData({
        success(res) {
          resolve(res.data || "");
        },
        fail(err) {
          reject(err);
        },
      });
    }, 150);
  });
}

module.exports = {
  extractFirstJobUrl,
  isJobUrl,
  isBossContent,
  looksLikeJobText,
  detectClipboardImport,
  getClipboardData,
};
