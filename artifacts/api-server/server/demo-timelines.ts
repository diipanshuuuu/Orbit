// Minutes are local to the stored timezone. These schedules repeat every 24 hours.
export const demoCrowdTimeline = {
  timezone: "Asia/Kolkata",
  crowd: [
    { minute: 0, people: 0 }, { minute: 360, people: 2 },
    { minute: 450, people: 18 }, { minute: 570, people: 4 },
    { minute: 720, people: 22 }, { minute: 840, people: 8 },
    { minute: 960, people: 3 }, { minute: 1140, people: 24 },
    { minute: 1260, people: 7 }, { minute: 1380, people: 1 },
  ],
  machines: [],
};

export const demoMachinesTimeline = {
  timezone: "Asia/Kolkata",
  crowd: [],
  machines: ["W1", "W2", "W3"].map((label, index) => ({
    label,
    cycles: [420, 540, 720, 960, 1140, 1260].map((start) => ({
      start: start + index * 15,
      end: start + index * 15 + 45,
    })),
  })),
};
