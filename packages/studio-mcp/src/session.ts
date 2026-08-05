import { timingSafeEqual } from "node:crypto";

/**
 * Session authentication for the network transport.
 *
 * ADR 0006 refused to introduce an unauthenticated loopback server, and
 * `docs/11-security-secrets-privacy.md` treats loopback as untrusted. Any local
 * process — including a malicious one — can reach a bound port, so the port
 * itself is not an authorization boundary.
 *
 * A session maps a bearer token to an identity. That identity becomes the
 * envelope's actor. The transport cannot mint authority: it only asserts who is
 * calling, and the kernel independently authorizes every operation against that
 * identity's grants, exactly as it does for the UI and CLI.
 */
export interface StudioSession {
  /** The human on whose behalf the harness acts. */
  principalId: string;
  /** The agent identity, distinct from the principal. */
  agentId: string;
  /** Which harness runtime is connected (e.g. "hermes", "openclaw", "claude-code"). */
  harnessId: string;
  /**
   * What this session represents. Defaults to an agent, which is what an MCP
   * session usually is — but the editor connects over the same transport, and
   * its edits are a person's. Attribution in the activity history is only
   * truthful if the credential says which.
   */
  actorType?: "human" | "agent" | "service";
  /**
   * Capability grants this session may exercise. Each entry is either a
   * capability ID (`studio.project.inspect`) or the wildcard `studio.*`.
   *
   * This is how a session is scoped: a read-only harness is issued a token
   * granting only the inspect/validate/job.get capabilities, and the kernel
   * refuses anything else. The grant is asserted here and enforced there —
   * this module makes no authorization decision of its own.
   */
  grantIds: string[];
}

export interface SessionCredential extends StudioSession {
  token: string;
}

export class UnauthorizedError extends Error {
  readonly name = "UnauthorizedError";
  constructor(message = "A valid bearer token is required.") {
    super(message);
  }
}

/**
 * Constant-time comparison. A plain `===` on secrets leaks length and content
 * through timing; this is cheap insurance on an authentication path.
 */
function tokensMatch(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.byteLength !== b.byteLength) return false;
  return timingSafeEqual(a, b);
}

export class SessionRegistry {
  private readonly credentials: SessionCredential[];

  constructor(credentials: readonly SessionCredential[]) {
    if (credentials.length === 0) {
      // Fail closed. A registry with no credentials would otherwise authorize
      // nothing while appearing to start normally, or — worse, if we defaulted
      // to an open session — expose the kernel to any local process.
      throw new TypeError("At least one session credential is required; the server refuses to start unauthenticated.");
    }
    for (const credential of credentials) {
      if (credential.token.length < 32) {
        throw new TypeError("Session tokens must be at least 32 characters.");
      }
    }
    this.credentials = [...credentials];
  }

  /**
   * Resolve an `Authorization: Bearer <token>` header to a session.
   * Throws rather than returning null so a caller cannot forget to check.
   */
  authenticate(authorizationHeader: string | undefined): StudioSession {
    if (!authorizationHeader) throw new UnauthorizedError();
    const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
    if (!match) throw new UnauthorizedError("Authorization header must use the Bearer scheme.");
    const supplied = match[1].trim();
    for (const credential of this.credentials) {
      if (tokensMatch(supplied, credential.token)) {
        return {
          principalId: credential.principalId,
          agentId: credential.agentId,
          harnessId: credential.harnessId,
          actorType: credential.actorType ?? "agent",
          grantIds: [...credential.grantIds],
        };
      }
    }
    throw new UnauthorizedError("Bearer token was not recognised.");
  }
}
