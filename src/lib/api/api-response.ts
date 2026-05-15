export function apiSuccess<T>(data: T) {
  return Response.json({
    ok: true,
    data,
  });
}
