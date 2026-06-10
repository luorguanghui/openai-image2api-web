import type { GeneratedImage } from "../types/image.js";

interface ReferenceModelCapability {
  supportsBase64ImageUrls?: boolean;
  maxReferenceImages?: number;
}

export function createFollowUpReferenceUrls(
  images: GeneratedImage[] | undefined,
  capability: ReferenceModelCapability
): string[] {
  if (!capability.supportsBase64ImageUrls) {
    return [];
  }

  const max = capability.maxReferenceImages ?? 16;
  return (images || [])
    .filter(image => Boolean(image.b64_json && image.mimeType))
    .slice(0, max)
    .map(image => `data:${image.mimeType};base64,${image.b64_json}`);
}
