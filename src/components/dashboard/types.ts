import type { AuthUserProfile } from "@/types/auth";

export type DashboardData = {
  me: AuthUserProfile;
  users: AuthUserProfile[];
  canManageUsers: boolean;
};
