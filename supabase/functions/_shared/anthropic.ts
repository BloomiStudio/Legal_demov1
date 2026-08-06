const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

interface ContentBlock {
  type: "text" | "document";
  text?: string;
  source?: { type: "base64"; media_type: string; data: string };
}

export async function callClaude(params: {
  system?: string;
  content: ContentBlock[];
  maxTokens?: number;
}): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: params.maxTokens ?? 4096,
      system: params.system,
      messages: [{ role: "user", content: params.content }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  return data.content?.map((block: { type: string; text?: string }) => block.text ?? "").join("\n") ?? "";
}
