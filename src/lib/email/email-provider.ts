export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string; status: string }>;
}

export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "mock";
  if (provider === "resend") {
    return createResendProvider();
  }
  return createMockProvider();
}

function createMockProvider(): EmailProvider {
  return {
    async send(message: EmailMessage) {
      console.log("[MOCK EMAIL]", message.to, message.subject);
      return { id: `mock-${crypto.randomUUID()}`, status: "sent" };
    },
  };
}

function createResendProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }
  return {
    async send(message: EmailMessage) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "noreply@ruletrade-ai.vercel.app",
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend error: ${response.status} ${body}`);
      }
      const data = await response.json();
      return { id: data.id, status: "sent" };
    },
  };
}
