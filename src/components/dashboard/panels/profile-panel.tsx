import type { DashboardData } from "@/components/dashboard/types";
import { primaryRoleLabel } from "@/lib/role-labels";

type ProfilePanelProps = {
  data: DashboardData;
};

export function ProfilePanel({ data }: ProfilePanelProps) {
  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">个人资料</h2>
      <div className="glass space-y-4 p-5">
        <Field label="账号编号" value={data.me.id} mono />
        <Field label="邮箱" value={data.me.email} />
        <Field label="昵称" value={data.me.nickname} />
        <Field label="账号状态" value={data.me.status} />
        <Field label="角色" value={primaryRoleLabel(data.me.roles) || "无"} />
        <Field label="Scopes" value={data.me.scopes.join(", ") || "无"} mono />
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 border-b border-ink-100 pb-3 last:border-none last:pb-0">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={`text-sm text-ink-900 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
