export async function registerNodeInstrumentation() {
  const { ensureServerRuntimeStarted } = await import("@/lib/runtime/startup.js");
  await ensureServerRuntimeStarted();
}
