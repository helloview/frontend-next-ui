const ROLE_LABELS: Record<string, string> = {
  admin: "管理员",
  user: "成员",
};

const ROLE_PRIORITY = ["admin", "user"] as const;

export function roleLabel(role: string): string {
  const normalized = normalizeRoleValue(role);
  return ROLE_LABELS[normalized] ?? role;
}

export function primaryRoleLabel(roles: string[]): string {
  if (roles.length === 0) {
    return "";
  }

  const normalized = roles.map(normalizeRoleValue);
  for (const role of ROLE_PRIORITY) {
    if (normalized.includes(role)) {
      return roleLabel(role);
    }
  }

  return roleLabel(normalized[0] ?? roles[0] ?? "");
}

export function roleLabels(roles: string[]): string[] {
  const normalized = roles.map(normalizeRoleValue).filter((role): role is "admin" | "user" => role === "admin" || role === "user");
  if (normalized.length === 0) {
    return [];
  }
  return Array.from(new Set(normalized)).map((role) => ROLE_LABELS[role]);
}

export function normalizeRoleValue(role: string): string {
  const value = role.trim().toLowerCase();
  if (value === "basic" || value === "user" || value === "成员") {
    return "user";
  }
  if (value === "admin" || value === "管理员") {
    return "admin";
  }
  return value;
}

export function systemRoleValues(roles: string[]): string[] {
  const normalized = roles
    .map(normalizeRoleValue)
    .filter((role): role is "admin" | "user" => role === "admin" || role === "user");
  return Array.from(new Set(normalized));
}
