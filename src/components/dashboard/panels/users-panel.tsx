"use client";

import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { normalizeRoleValue, roleLabel } from "@/lib/role-labels";
import type { AuthUserProfile } from "@/types/auth";

type UsersPanelProps = {
  users: AuthUserProfile[];
  canManageUsers: boolean;
};

const allowedRoles = ["user", "admin"];

export function UsersPanel({ users: initialUsers, canManageUsers }: UsersPanelProps) {
  const [users, setUsers] = useState(initialUsers);
  const [savingUserID, setSavingUserID] = useState<string | null>(null);

  const updateRoles = async (userID: string, roles: string[]) => {
    if (!canManageUsers) {
      return;
    }

    setSavingUserID(userID);

    try {
      const response = await fetch(`/api/ums/users/${userID}/roles`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roles }),
      });

      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "更新角色失败");
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === userID
            ? {
                ...item,
                roles,
              }
            : item,
        ),
      );

      toast.success(payload.message ?? "角色更新成功");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新失败");
    } finally {
      setSavingUserID(null);
    }
  };

  if (!canManageUsers) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-ink-900">用户管理</h2>
        <div className="glass p-6 text-sm text-ink-600">当前账号没有 `rbac:manage` 权限，无法访问用户管理 API。</div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">用户管理</h2>
      <div className="glass overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-ink-100 bg-ink-100/70 text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">角色</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {users.map((user) => (
              <UserRow key={user.id} user={user} onSave={updateRoles} isSaving={savingUserID === user.id} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UserRow({
  user,
  onSave,
  isSaving,
}: {
  user: AuthUserProfile;
  onSave: (userID: string, roles: string[]) => Promise<void>;
  isSaving: boolean;
}) {
  const [selectedRole, setSelectedRole] = useState(normalizeRoleValue(user.roles[0] ?? "user"));

  return (
    <tr>
      <td className="px-4 py-3">
        <p className="font-medium text-ink-900">{user.nickname}</p>
        <p className="font-mono text-xs text-ink-500">{user.email}</p>
      </td>
      <td className="px-4 py-3 text-ink-700">{user.status}</td>
      <td className="px-4 py-3">
        <select
          value={selectedRole}
          onChange={(event) => setSelectedRole(event.target.value)}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-ink-700"
        >
          {allowedRoles.map((role) => (
            <option key={role} value={role}>
              {roleLabel(role)}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={() => onSave(user.id, [selectedRole])}
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          保存
        </button>
      </td>
    </tr>
  );
}
