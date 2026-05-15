export function getRateLimitPeriod(window: "hour" | "day" | "month") {
  const now = new Date();
  const utcNow = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours(),
      now.getUTCMinutes(),
      now.getUTCSeconds(),
      now.getUTCMilliseconds(),
    ),
  );

  const start = new Date(utcNow);
  const end = new Date(utcNow);

  if (window === "hour") {
    start.setUTCMinutes(0, 0, 0);
    end.setUTCMinutes(0, 0, 0);
    end.setUTCHours(end.getUTCHours() + 1);
  }

  if (window === "day") {
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCDate(end.getUTCDate() + 1);
  }

  if (window === "month") {
    start.setUTCDate(1);
    start.setUTCHours(0, 0, 0, 0);

    end.setUTCDate(1);
    end.setUTCHours(0, 0, 0, 0);
    end.setUTCMonth(end.getUTCMonth() + 1);
  }

  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
