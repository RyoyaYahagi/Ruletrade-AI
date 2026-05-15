export function getMonthlyCostPeriod() {
  const now = new Date();

  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
