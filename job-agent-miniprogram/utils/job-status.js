/** 岗位状态中文标签（网页 + 小程序共用逻辑） */
const STATUS_LABELS = {
  saved: "已收藏",
  applied: "已投递",
  interview: "面试中",
  declined: "已拒绝",
  rejected: "已被拒",
  offer: "已获 Offer",
};

function getJobStatusLabel(status) {
  if (!status) return STATUS_LABELS.saved;
  return STATUS_LABELS[status] || status;
}

module.exports = { STATUS_LABELS, getJobStatusLabel };
