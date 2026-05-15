export function apiSuccess<T>(data: T, init?: ResponseInit) {
  return Response.json(
    {
      ok: true,
      data,
    },
    init,
  );
}

export function apiCreated<T>(data: T) {
  return apiSuccess(data, {
    status: 201,
  });
}
