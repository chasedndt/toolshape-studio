import type { OperationEnvelope, OperationResult, StudioKernel } from "@toolshape/studio-kernel";

export interface StudioInvoker {
  invoke(envelope: OperationEnvelope): OperationResult;
}

export class StudioSdk implements StudioInvoker {
  constructor(private readonly kernel: StudioKernel) {}

  invoke(envelope: OperationEnvelope): OperationResult {
    return this.kernel.invoke(envelope);
  }
}

export interface JsonCliCommand {
  command: "invoke";
  envelope: OperationEnvelope;
}

export function dispatchJsonCli(invoker: StudioInvoker, value: unknown): string {
  if (!value || typeof value !== "object" || (value as Partial<JsonCliCommand>).command !== "invoke") {
    throw new TypeError("CLI command must be an invoke request.");
  }
  const command = value as JsonCliCommand;
  return `${JSON.stringify(invoker.invoke(command.envelope))}\n`;
}
