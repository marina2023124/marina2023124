const STORAGE_KEY = "app-data";

function defaultAppData() {
  return {
    profile: {
      name: "",
      email: "",
      summary: "",
      targetRoles: [],
      targetIndustries: [],
      preferredLocations: [],
      workExperiences: [],
      educations: [],
      projects: [],
      skills: [],
    },
    jobs: [],
    chatHistory: [],
  };
}

function getAppData() {
  return wx.getStorageSync(STORAGE_KEY) || defaultAppData();
}

function setAppData(data) {
  wx.setStorageSync(STORAGE_KEY, data);
  const app = getApp();
  if (app) {
    app.globalData.appData = data;
  }
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function calcCompleteness(profile, jobs) {
  let score = 0;
  if (profile.name) score += 25;
  if (profile.workExperiences.length > 0) score += 25;
  if (profile.skills.length > 0) score += 25;
  if (jobs.length > 0) score += 25;
  return score;
}

module.exports = {
  defaultAppData,
  getAppData,
  setAppData,
  uid,
  calcCompleteness,
};
