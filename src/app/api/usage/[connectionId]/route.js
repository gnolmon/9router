// Ensure proxyFetch is loaded to patch globalThis.fetch
import "open-sse/index.js";

import {
  fetchUsageForConnection,
  refreshAndUpdateCredentials,
} from "@/lib/usage/connectionUsage";

export { refreshAndUpdateCredentials };

export async function GET(request, { params }) {
  let connectionId = "unknown";

  try {
    ({ connectionId } = await params);
    const usage = await fetchUsageForConnection(connectionId);
    return Response.json(usage);
  } catch (error) {
    const status = error?.status || 500;
    console.warn(`[Usage] ${connectionId}: ${error.message}`);
    return Response.json({ error: error.message }, { status });
  }
}
