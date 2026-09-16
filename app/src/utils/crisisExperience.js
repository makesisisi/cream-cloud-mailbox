export const crisisSteps = [
  {
    key: "humanReviewed",
    label: "已由倾听员人工复核",
    detail: "重新阅读原始表达，不把 AI 结论直接当成事实。",
  },
  {
    key: "safetyChecked",
    label: "已直接询问当前安全状况",
    detail: "确认是否存在立即危险，以及现实中是否有人能够陪伴。",
  },
  {
    key: "schoolSupportContacted",
    label: "已联系校内专业支持",
    detail: "按学校流程联系辅导员、心理中心或值班负责人。",
  },
  {
    key: "trustedPersonContacted",
    label: "已协助连接可信任的人",
    detail: "仅在合适且安全时，协助联系同学、室友或家人。",
    optional: true,
  },
  {
    key: "emergencyServicesContacted",
    label: "立即危险时已联系 110 / 120",
    detail: "只有存在紧迫危险时使用；同时不要让当事人独处。",
    optional: true,
  },
];

export const crisisStatusLabels = {
  unreviewed: "等待人工复核",
  reviewing: "人工复核中",
  escalated: "已连接支持",
  resolved: "已完成交接",
};

export function getCrisisCompletion(steps = {}) {
  const completed = crisisSteps.filter((step) => Boolean(steps[step.key])).length;
  return { completed, total: crisisSteps.length };
}

export function canCompleteCrisisHandoff(steps = {}) {
  return Boolean(steps.humanReviewed && steps.safetyChecked && steps.schoolSupportContacted);
}
