import { createHash } from "node:crypto";

const CLOUDINARY_API_BASE = "https://api.cloudinary.com/v1_1";

interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface CloudinaryUploadInput {
  data: Uint8Array;
  mimeType: string;
  fileName?: string;
  folder?: string;
  publicId?: string;
  overwrite?: boolean;
}

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  secureUrl: string;
  width?: number;
  height?: number;
  format?: string;
  resourceType?: string;
}

interface CloudinaryUploadResponse {
  public_id: string;
  url: string;
  secure_url: string;
  width?: number;
  height?: number;
  format?: string;
  resource_type?: string;
}

interface CloudinaryDestroyResponse {
  result?: string;
}

/** True when all server-side Cloudinary credentials are present. */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  );
}

function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }

  return { cloudName, apiKey, apiSecret };
}

/**
 * Cloudinary signs every parameter except `file`, `api_key` and `signature`.
 * Parameters must be sorted alphabetically and joined with `&` before the API
 * secret is appended.
 */
export function signCloudinaryParams(
  params: Record<string, string | number>,
  apiSecret: string,
): string {
  const paramsToSign = Object.keys(params)
    .sort()
    .map((paramName) => `${paramName}=${params[paramName]}`)
    .join("&");

  return createHash("sha1").update(`${paramsToSign}${apiSecret}`).digest("hex");
}

export async function uploadCloudinaryImage(
  input: CloudinaryUploadInput,
): Promise<CloudinaryUploadResult> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const uploadParams: Record<string, string | number> = { timestamp };
  if (input.folder) uploadParams.folder = input.folder;
  if (input.publicId) uploadParams.public_id = input.publicId;
  if (input.overwrite) uploadParams.overwrite = "true";

  const signature = signCloudinaryParams(uploadParams, apiSecret);
  const formData = new FormData();
  const fileBuffer = new ArrayBuffer(input.data.byteLength);
  new Uint8Array(fileBuffer).set(input.data);
  const fileBlob = new Blob([fileBuffer], { type: input.mimeType });

  formData.append("file", fileBlob, input.fileName ?? "upload");
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);

  for (const [paramName, paramValue] of Object.entries(uploadParams)) {
    if (paramName === "timestamp") continue;
    formData.append(paramName, String(paramValue));
  }

  const response = await fetch(
    `${CLOUDINARY_API_BASE}/${encodeURIComponent(cloudName)}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Cloudinary upload failed (${response.status}): ${responseBody.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as CloudinaryUploadResponse;
  return {
    publicId: result.public_id,
    url: result.url,
    secureUrl: result.secure_url,
    width: result.width,
    height: result.height,
    format: result.format,
    resourceType: result.resource_type,
  };
}

export async function deleteCloudinaryImage(
  publicId: string,
  options?: { invalidate?: boolean },
): Promise<void> {
  const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);

  const destroyParams: Record<string, string | number> = {
    public_id: publicId,
    timestamp,
  };
  if (options?.invalidate) destroyParams.invalidate = "true";

  const signature = signCloudinaryParams(destroyParams, apiSecret);
  const formData = new FormData();
  formData.append("public_id", publicId);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  if (options?.invalidate) formData.append("invalidate", "true");
  formData.append("signature", signature);

  const response = await fetch(
    `${CLOUDINARY_API_BASE}/${encodeURIComponent(cloudName)}/image/destroy`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Cloudinary delete failed (${response.status}): ${responseBody.slice(0, 500)}`,
    );
  }

  const result = (await response.json()) as CloudinaryDestroyResponse;
  if (result.result === "not found") {
    throw new Error(`Cloudinary asset not found: ${publicId}`);
  }
}
