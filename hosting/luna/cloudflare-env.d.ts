declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    OPENAI_API_KEY?: string;
    VISIORA_DAILY_USD?: string;
    VISIORA_LUNA_ENABLED?: string;
    VISIORA_PRICING_CONFIRMED?: string;
    VISIORA_PROVIDER?: string;
  }
}
