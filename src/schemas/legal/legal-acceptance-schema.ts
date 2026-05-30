import { z } from "zod";

export const LegalAcceptanceSchema = z.object({
  acceptedTermsAt: z.string().datetime().optional(),
  acceptedPrivacyAt: z.string().datetime().optional(),
  acceptedDisclaimerAt: z.string().datetime().optional(),
  termsVersion: z.string().optional(),
  privacyVersion: z.string().optional(),
  disclaimerVersion: z.string().optional(),
});

export type LegalAcceptance = z.infer<typeof LegalAcceptanceSchema>;
