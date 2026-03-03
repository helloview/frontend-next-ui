import { Activity, KeyRound, ShieldCheck, Users } from "lucide-react";

import type { DashboardData } from "@/components/dashboard/types";
import { primaryRoleLabel } from "@/lib/role-labels";

type OverviewPanelProps = {
  data: DashboardData;
};

export function OverviewPanel({ data }: OverviewPanelProps) {
  const cards = [
    {
      label: "当前角色",
      value: primaryRoleLabel(data.me.roles) || "无",
      icon: ShieldCheck,
    },
    {
      label: "权限数量",
      value: String(data.me.scopes.length),
      icon: KeyRound,
    },
    {
      label: "系统用户数",
      value: String(data.users.length),
      icon: Users,
    },
    {
      label: "账号状态",
      value: data.me.status,
      icon: Activity,
    },
  ];

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold text-ink-900">概览</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <article key={card.label} className="glass p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-ink-500">{card.label}</span>
              <card.icon className="h-4 w-4 text-ink-500" />
            </div>
            <p className="text-lg font-semibold text-ink-900">{card.value}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
