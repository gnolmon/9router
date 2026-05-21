import { ensureServerRuntimeStarted } from "@/lib/runtime/startup.js";

// This API route is called automatically to initialize app
export async function GET() {
  await ensureServerRuntimeStarted();
  return new Response("Initialized", { status: 200 });
}
