// 部署后改成你的线上地址；开发阶段可在微信开发者工具勾选「不校验合法域名」
const API_BASE = "https://marina2023124.vercel.app";
const REQUEST_TIMEOUT_MS = 20000;

function parseErrorBody(data, statusCode) {
  if (data && typeof data === "object" && data.error) {
    return String(data.error);
  }
  if (statusCode === 404) {
    return "后端 API 未部署（404）。请在 Vercel 将最新 main 部署 Promote 到 Production";
  }
  return `请求失败 (${statusCode})`;
}

function request(path, options = {}) {
  const header = {
    "Content-Type": "application/json",
    ...(options.header || {}),
  };
  if (!options.skipAuth) {
    const token = wx.getStorageSync("token");
    if (token) {
      header.Authorization = `Bearer ${token}`;
    }
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE}${path}`,
      method: options.method || "GET",
      data: options.data,
      header,
      timeout: REQUEST_TIMEOUT_MS,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          if (res.statusCode === 401 && !options.skipAuth) {
            wx.removeStorageSync("token");
          }
          reject(new Error(parseErrorBody(res.data, res.statusCode)));
        }
      },
      fail(err) {
        const msg = err.errMsg || "网络错误";
        if (msg.indexOf("url not in domain list") >= 0) {
          reject(new Error("域名未配置：请在微信公众平台添加 request 合法域名"));
        } else if (msg.indexOf("timeout") >= 0) {
          reject(new Error("请求超时，请检查网络或稍后重试"));
        } else {
          reject(new Error(msg));
        }
      },
    });
  });
}

function checkBackend() {
  return request("/api/health").then((body) => {
    if (!body || !body.ok) {
      throw new Error("后端健康检查失败");
    }
    return body;
  });
}

function login(useDemo) {
  return new Promise((resolve, reject) => {
    const loginTimer = setTimeout(() => {
      reject(new Error("微信登录超时，请关闭小程序后重试"));
    }, REQUEST_TIMEOUT_MS);

    wx.login({
      success(loginRes) {
        clearTimeout(loginTimer);
        if (!loginRes.code) {
          reject(new Error("wx.login 未返回 code"));
          return;
        }
        request("/api/auth/wechat", {
          method: "POST",
          data: { code: loginRes.code, useDemo },
          skipAuth: true,
        })
          .then(resolve)
          .catch(reject);
      },
      fail(err) {
        clearTimeout(loginTimer);
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

function getLinkStatus() {
  return request("/api/auth/wechat/bind");
}

function bindAccount(bindCode) {
  return request("/api/auth/wechat/bind", {
    method: "POST",
    data: { bindCode },
  });
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
  checkBackend,
  login,
  loadData,
  saveData,
  getLinkStatus,
  bindAccount,
  parseJobText,
  matchJobs,
};
