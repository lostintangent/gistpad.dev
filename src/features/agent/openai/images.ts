import { createOpenAIClient } from "./client";

/** Generates an image (as PNG data) from a prompt. */
export async function generateImage(prompt: string) {
  const response = await createOpenAIClient().images.generate({
    model: "gpt-image-2",
    prompt,
    size: "1024x1024",
  });

  const base64 = response.data?.[0]?.b64_json;
  if (!base64) throw new Error("No image was generated");

  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0)).buffer;
}
