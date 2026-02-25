import { redirect } from "next/navigation";
import type { Session } from "next-auth";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getCurrentUser, listUsers } from "@/lib/user-api";
import type { AuthUserProfile } from "@/types/auth";

function fallbackUserFromSession(session: Session): AuthUserProfile {
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    nickname: session.user.name?.trim() || session.user.email || "未知用户",
    avatar_seed: `${session.user.id}-core`,
    avatar_background: "f4f4f5",
    roles: session.user.roles,
    scopes: session.user.scopes,
    status: "active",
  };
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user || !session.accessToken) {
    redirect("/login");
  }

  let me = fallbackUserFromSession(session);
  try {
    me = await getCurrentUser(session.accessToken);
  } catch {
    // fallback keeps dashboard usable when backend temporarily fails
  }

  const canManageUsers = me.scopes.includes("rbac:manage");
  let users: AuthUserProfile[] = [me];

  if (canManageUsers) {
    try {
      const payload = await listUsers(session.accessToken);
      users = payload.items;
    } catch {
      users = [me];
    }
  }

  return <DashboardShell data={{ me, users, canManageUsers }} />;
}
