import type { StudioKernel } from "@toolshape/studio-kernel";
import type { ContractOperationEnvelope, ContractOperationResult } from "./contract-types";
import { contractEnvelopeToKernel, projectOperationResult } from "./projection";
import { validateOperationEnvelopeDocument, validateOperationResultDocument } from "./schema-validation";

export * from "./contract-types";
export * from "./projection";
export * from "./schema-validation";

export interface StudioInvoker {
  invoke(envelope: ContractOperationEnvelope): ContractOperationResult;
}

export class StudioSdk implements StudioInvoker {
  constructor(private readonly kernel: StudioKernel) {}

  invoke(envelope: ContractOperationEnvelope): ContractOperationResult {
    const validated = validateOperationEnvelopeDocument(envelope);
    const internal = this.kernel.invoke(contractEnvelopeToKernel(validated));
    return validateOperationResultDocument(projectOperationResult(internal));
  }
}

export interface JsonCliCommand {
  command: "invoke";
  envelope: ContractOperationEnvelope;
}

export function dispatchJsonCli(invoker: StudioInvoker, value: unknown): string {
  if (!value || typeof value !== "object" || (value as Partial<JsonCliCommand>).command !== "invoke") {
    throw new TypeError("CLI command must be an invoke request.");
  }
  const command = value as JsonCliCommand;
  return `${JSON.stringify(invoker.invoke(command.envelope))}\n`;
}
