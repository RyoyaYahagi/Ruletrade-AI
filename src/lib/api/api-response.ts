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

export function apiError(
  code: string,
  message: string,
  requestId: string,
  status: number = 500,
) {
  return Response.json(
    {
      ok: false,
      error: { code, message, requestId },
    },
    { status },
  );
}
