// 部署后改成你的线上地址；开发阶段可在微信开发者工具勾选「不校验合法域名」
const API_BASE = "https://marina2023124.vercel.app";

function request(path, options = {}) {
  const token = wx.getStorageSync("token");
  const header = {
    "Content-Type": "application/json",
    ...(options.header || {}),
  };
  if (token) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || "GET",
      data: options.data,
      header,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error((res.data && res.data.error) || `请求失败 (${res.statusCode})`));
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || "网络错误"));
      },
    });
  });
}

function login(useDemo) {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error("wx.login 未返回 code"));
          return;
        }
        request("/api/auth/wechat", {
          method: "POST",
          data: { code: loginRes.code, useDemo },
        })
          .then(resolve)
          .catch(reject);
      },
      fail(err) {
        reject(new Error(err.errMsg || "微信登录失败"));
      },
    });
  });
}

function loadData() {
  return request("/api/wechat/data");
}

function saveData(data) {
  return request("/api/wechat/data", { method: "PUT", data });
}

function parseJobText(text) {
  return request("/api/jobs/parse-text", { method: "POST", data: { text } });
}

function matchJobs(profile, jobs) {
  return request("/api/match", { method: "POST", data: { profile, jobs } });
}

module.exports = {
  API_BASE,
  request,
  login,
  loadData,
  saveData,
  parseJobText,
  matchJobs,
};
