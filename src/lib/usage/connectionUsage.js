import { getProviderConnectionById, updateProviderConnection } from "@/lib/localDb";
import { resolveConnectionProxyConfig } from "@/lib/network/connectionProxy";
import { USAGE_APIKEY_PROVIDERS, USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";
import { getUsageForProvider } from "open-sse/services/usage.js";
import { getExecutor } from "open-sse/executors/index.js";

const AUTH_EXPIRED_PATTERNS = ["expired", "authentication", "unauthorized", "401", "re-authorize"];

function isAuthExpiredMessage(usage) {
  if (!usage?.message) return false;
  const msg = usage.message.toLowerCase();
  return AUTH_EXPIRED_PATTERNS.some((pattern) => msg.includes(pattern));
}

export function isUsageEligibleConnection(connection) {
  if (!connection) return false;
  return USAGE_SUPPORTED_PROVIDERS.includes(connection.provider) && (
    connection.authType === "oauth" || USAGE_APIKEY_PROVIDERS.includes(connection.provider)
  );
}

export async function getConnectionUsageProxyOptions(connection) {
  const proxyConfig = await resolveConnectionProxyConfig(connection.providerSpecificData);
  return {
    connectionProxyEnabled: proxyConfig.connectionProxyEnabled === true,
    connectionProxyUrl: proxyConfig.connectionProxyUrl || "",
    connectionNoProxy: proxyConfig.connectionNoProxy || "",
    vercelRelayUrl: proxyConfig.vercelRelayUrl || "",
    strictProxy: false,
  };
}

async function refreshAndUpdateCredentials(connection, force = false, proxyOptions = null) {
  const executor = getExecutor(connection.provider);
  const credentials = {
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    expiresAt: connection.expiresAt || connection.tokenExpiresAt,
    providerSpecificData: connection.providerSpecificData,
    copilotToken: connection.providerSpecificData?.copilotToken,
    copilotTokenExpiresAt: connection.providerSpecificData?.copilotTokenExpiresAt,
  };

  const needsRefresh = force || executor.needsRefresh(credentials);
  if (!needsRefresh) {
    return { connection, refreshed: false };
  }

  const refreshResult = await executor.refreshCredentials(credentials, console, proxyOptions);
  if (!refreshResult) {
    if (connection.accessToken) {
      return { connection, refreshed: false };
    }
    throw new Error("Failed to refresh credentials. Please re-authorize the connection.");
  }

  const now = new Date().toISOString();
  const updateData = { updatedAt: now };

  if (refreshResult.accessToken) updateData.accessToken = refreshResult.accessToken;
  if (refreshResult.refreshToken) updateData.refreshToken = refreshResult.refreshToken;
  if (refreshResult.expiresIn) {
    updateData.expiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000).toISOString();
  } else if (refreshResult.expiresAt) {
    updateData.expiresAt = refreshResult.expiresAt;
  }

  if (refreshResult.copilotToken || refreshResult.copilotTokenExpiresAt) {
    updateData.providerSpecificData = {
      ...connection.providerSpecificData,
      copilotToken: refreshResult.copilotToken,
      copilotTokenExpiresAt: refreshResult.copilotTokenExpiresAt,
    };
  }

  await updateProviderConnection(connection.id, updateData);
  return {
    connection: {
      ...connection,
      ...updateData,
    },
    refreshed: true,
  };
}

export async function fetchUsageForConnection(connectionInput) {
  let connection = connectionInput;
  if (typeof connectionInput === "string") {
    connection = await getProviderConnectionById(connectionInput);
  }

  if (!connection) {
    const error = new Error("Connection not found");
    error.status = 404;
    throw error;
  }

  if (!isUsageEligibleConnection(connection)) {
    return { message: "Usage not available for this connection" };
  }

  const isOAuth = connection.authType === "oauth";
  const proxyOptions = await getConnectionUsageProxyOptions(connection);

  if (isOAuth) {
    try {
      const result = await refreshAndUpdateCredentials(connection, false, proxyOptions);
      connection = result.connection;
    } catch (refreshError) {
      const error = new Error(`Credential refresh failed: ${refreshError.message}`);
      error.status = 401;
      throw error;
    }
  }

  let usage = await getUsageForProvider(connection, proxyOptions);
  if (isOAuth && isAuthExpiredMessage(usage) && connection.refreshToken) {
    try {
      const retryResult = await refreshAndUpdateCredentials(connection, true, proxyOptions);
      connection = retryResult.connection;
      usage = await getUsageForProvider(connection, proxyOptions);
    } catch (retryError) {
      console.warn(`[Usage] ${connection.provider}: force refresh failed: ${retryError.message}`);
    }
  }

  return usage;
}
