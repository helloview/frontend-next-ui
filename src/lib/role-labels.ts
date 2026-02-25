const ROLE_LABELS: Record<string, string> = {
  admin: "admin",
  user: "注册用户(user)",
  basic: "注册用户(user)",
};

const ROLE_PRIORITY = ["admin", "user", "basic"];

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
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
  return Array.from(new Set(roles.map(roleLabel)));
}

export function normalizeRoleValue(role: string): string {
  if (role === "basic") {
    return "user";
  }
  return role;
}
