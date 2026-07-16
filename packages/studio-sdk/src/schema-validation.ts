import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import commonSchema from "../../../specs/common.schema.json";
import operationEnvelopeSchema from "../../../specs/operation-envelope.schema.json";
import operationResultSchema from "../../../specs/operation-result.schema.json";
import jobSchema from "../../../specs/job.schema.json";
import artifactSchema from "../../../specs/artifact.schema.json";
import type {
  ContractArtifactDocument,
  ContractJobDocument,
  ContractOperationEnvelope,
  ContractOperationResult,
} from "./contract-types";

export class ContractSchemaError extends TypeError {
  constructor(readonly errors: ErrorObject[]) {
    super(`Shared contract schema validation failed: ${errors.map((error) => `${error.instancePath || "/"} ${error.message ?? "is invalid"}`).join("; ")}`);
    this.name = "ContractSchemaError";
  }
}

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addSchema(commonSchema);

const envelopeValidator = ajv.compile(operationEnvelopeSchema);
const resultValidator = ajv.compile(operationResultSchema);
const jobValidator = ajv.compile(jobSchema);
const artifactValidator = ajv.compile(artifactSchema);

function assertValid<T>(validator: ValidateFunction, value: unknown): T {
  if (!validator(value)) throw new ContractSchemaError(validator.errors ?? []);
  return value as T;
}

export function validateOperationEnvelopeDocument(value: unknown): ContractOperationEnvelope {
  return assertValid<ContractOperationEnvelope>(envelopeValidator, value);
}

export function validateOperationResultDocument(value: unknown): ContractOperationResult {
  return assertValid<ContractOperationResult>(resultValidator, value);
}

export function validateJobDocument(value: unknown): ContractJobDocument {
  return assertValid<ContractJobDocument>(jobValidator, value);
}

export function validateArtifactDocument(value: unknown): ContractArtifactDocument {
  return assertValid<ContractArtifactDocument>(artifactValidator, value);
}
