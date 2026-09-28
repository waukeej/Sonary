(() => {
  const startOfDay = (date) =>
    new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const keyFor = (date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const data = JSON.parse(
    document.getElementById("diaryActivityData")?.textContent ||
      '{"entries":[]}',
  );
  const entriesByDate = new Map();
  data.entries.forEach((entry) => {
    const group = entriesByDate.get(entry.date) || [];
    group.push(entry);
    entriesByDate.set(entry.date, group);
  });
  const getEntries = (date) => entriesByDate.get(keyFor(date)) || [];
  const getCount = (date) => getEntries(date).length;
  const accountCreatedAt = data.start
    ? new Date(data.start + "T00:00:00")
    : startOfDay(new Date());
  window.SonaryActivity = {
    getCount,
    getEntries,
    keyFor,
    startOfDay,
    accountCreatedAt,
  };
})();
