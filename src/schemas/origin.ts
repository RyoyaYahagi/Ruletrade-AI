import { z } from "zod";

export const OriginSchema = z.enum(["web", "muse"]);

export type Origin = z.infer<typeof OriginSchema>;
