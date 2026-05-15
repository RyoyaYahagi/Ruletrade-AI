export function getRateLimitPeriod(window: "hour" | "day" | "month") {
  const now = new Date();

  const start = new Date(now);
  const end = new Date(now);

  if (window === "hour") {
    start.setMinutes(0, 0, 0);
    end.setMinutes(0, 0, 0);
    end.setHours(end.getHours() + 1);
  }

  if (window === "day") {
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
  }

  if (window === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    end.setDate(1);
    end.setHours(0, 0, 0, 0);
    end.setMonth(end.getMonth() + 1);
  }

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
