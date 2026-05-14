declare namespace NodeJS {
  interface ProcessEnv {
    readonly OPENAI_API_KEY?: string;
    readonly ANTHROPIC_API_KEY?: string;
  }
}
