import { getMachineId } from "@/shared/utils/machine";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import EndpointPageClient from "./endpoint/EndpointPageClient";

export default async function DashboardPage() {
  const machineId = await getMachineId();
  const cliToken = await getConsistentMachineId("9r-cli-auth");
  return <EndpointPageClient machineId={machineId} cliToken={cliToken} />;
}
