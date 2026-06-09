export const DEVICE_TOKEN_HEADER = "x-device-token";
export const DEVICE_TOKENS_ENV_KEY = "SMART_HOME_DEVICE_TOKENS";

type DeviceTokenAuthResult =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 503;
      error: string;
    };

export function authenticateDeviceIngest(
  deviceId: string,
  providedToken: string | null,
  env: NodeJS.ProcessEnv = process.env
): DeviceTokenAuthResult {
  const configuredTokens = parseDeviceTokenConfig(env[DEVICE_TOKENS_ENV_KEY]);

  if (configuredTokens.size === 0) {
    if (env.NODE_ENV === "production") {
      return {
        ok: false,
        status: 503,
        error: "Device token authentication is not configured"
      };
    }

    return { ok: true };
  }

  const expectedToken = configuredTokens.get(deviceId) ?? configuredTokens.get("*");

  if (!expectedToken || !providedToken || !constantTimeEqual(providedToken, expectedToken)) {
    return {
      ok: false,
      status: 401,
      error: "Invalid device token"
    };
  }

  return { ok: true };
}

function parseDeviceTokenConfig(raw: string | undefined): Map<string, string> {
  const tokens = new Map<string, string>();

  for (const entry of (raw ?? "").split(/[\n,]/)) {
    const separatorIndex = entry.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const deviceId = entry.slice(0, separatorIndex).trim();
    const token = entry.slice(separatorIndex + 1).trim();

    if (deviceId && token) {
      tokens.set(deviceId, token);
    }
  }

  return tokens;
}

function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}
