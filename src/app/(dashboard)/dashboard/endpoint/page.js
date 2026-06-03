import { getMachineId } from "@/shared/utils/machine";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import EndpointPageClient from "./EndpointPageClient";

export default async function EndpointPage() {
  const machineId = await getMachineId();
  const cliToken = await getConsistentMachineId("9r-cli-auth");
  return <EndpointPageClient machineId={machineId} cliToken={cliToken} />;
}
