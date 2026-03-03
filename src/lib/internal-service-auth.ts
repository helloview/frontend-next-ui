import { createHmac } from "node:crypto";

type InternalServiceRole = "admin" | "editor";

type InternalServiceTokenInput = {
  subject: string;
  role: InternalServiceRole;
};

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function base64UrlJson(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function signHs256(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

function getJwtSecrets(): string[] {
  const candidates = [
    getString(process.env.INTERNAL_JWT_SECRET),
    getString(process.env.JWT_SIGNING_SECRET),
    getString(process.env.AUTH_SECRET),
    "helloview-local-dev-shared-secret",
  ].filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of candidates) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function getJwtIssuer(): string {
  return getString(process.env.INTERNAL_JWT_ISSUER) || "local_helloview";
}

function getJwtAudience(): string {
  return getString(process.env.INTERNAL_JWT_AUDIENCE) || "internal-services";
}

export function inferInternalServiceRole(roles: string[] | undefined): InternalServiceRole {
  if (Array.isArray(roles) && roles.includes("admin")) {
    return "admin";
  }
  return "editor";
}

function createInternalServiceTokenWithSecret(input: InternalServiceTokenInput, secret: string): string {
  const issuer = getJwtIssuer();
  const audience = getJwtAudience();

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "HS256", typ: "JWT" });
  const claims = base64UrlJson({
    sub: input.subject,
    role: input.role,
    iss: issuer,
    aud: audience,
    iat: now,
    exp: now + 5 * 60,
  });
  const signature = signHs256(`${header}.${claims}`, secret);
  return `${header}.${claims}.${signature}`;
}

export function createInternalServiceTokenCandidates(input: InternalServiceTokenInput): string[] {
  return getJwtSecrets().map((secret) => createInternalServiceTokenWithSecret(input, secret));
}

export function createInternalServiceToken(input: InternalServiceTokenInput): string {
  const [first] = createInternalServiceTokenCandidates(input);
  return first;
}
