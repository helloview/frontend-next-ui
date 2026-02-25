"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertCircle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { BrandLogo, BrandLogoAnimated } from "@/components/brand/brand-logo";
import { TodoWorkspace } from "@/components/dashboard/panels/todo-workspace";
import type { DashboardData } from "@/components/dashboard/types";

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-500/10"
      title="切换主题"
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

type DashboardShellProps = {
  data: DashboardData;
};

type AppUser = {
  id: string;
  email: string;
  name: string;
  avatar: string;
  roles: string[];
  scopes: string[];
};

type AvatarOption = {
  seed: string;
};

function buildNotionistsAvatar(seed: string, backgroundColor = "f4f4f5") {
  return `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${backgroundColor}`;
}

const Input = ({
  label,
  type = "text",
  error,
  icon: Icon,
  rightSlot,
  ...props
}: React.ComponentProps<"input"> & {
  label?: string;
  error?: string;
  icon?: React.ComponentType<{ className?: string }>;
  rightSlot?: React.ReactNode;
}) => (
  <div className="space-y-1.5">
    {label ? <label className="block text-[13px] font-medium text-zinc-700">{label}</label> : null}
    <div className="relative">
      {Icon ? <Icon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" /> : null}
      {rightSlot ? <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">{rightSlot}</div> : null}
      <input
        type={type}
        className={`block w-full rounded-lg border bg-white py-2 text-[13px] text-zinc-900 outline-none transition-all placeholder-zinc-400 shadow-sm ${
          Icon ? "pl-9" : "pl-3"
        } ${rightSlot ? "pr-10" : "pr-3"} ${error ? "border-rose-500 focus:ring-rose-500" : "border-zinc-200 focus:border-rose-400 focus:ring-rose-400"} focus:ring-1`}
        {...props}
      />
    </div>
    {error ? (
      <p className="mt-1 flex items-center text-[12px] text-rose-500">
        <AlertCircle className="mr-1 h-3 w-3" /> {error}
      </p>
    ) : null}
  </div>
);

const Button = ({
  children,
  variant = "primary",
  isLoading,
  className = "",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  isLoading?: boolean;
}) => {
  const baseStyle =
    "flex select-none items-center justify-center rounded-lg px-4 py-2 text-[13px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-200",
    secondary: "bg-rose-50 text-rose-700 hover:bg-rose-100",
    outline: "bg-white text-zinc-700 border border-zinc-200 hover:bg-rose-50 hover:text-rose-700 shadow-sm",
    ghost: "bg-transparent text-zinc-600 hover:bg-rose-50 hover:text-rose-700",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} disabled={isLoading} {...props}>
      {isLoading ? <Loader2 className="-ml-1 mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
};

function TodoView({ storageNamespace }: { storageNamespace: string }) {
  return <TodoWorkspace storageNamespace={storageNamespace} />;
}

function SettingsView({
  user,
  nickname,
  onNicknameChange,
  onSaveProfile,
  isSavingProfile,
  avatarSeed,
  avatarBackground,
  avatarOptions,
  backgroundOptions,
  onSaveAvatar,
  isSavingAvatar,
}: {
  user: AppUser;
  nickname: string;
  onNicknameChange: (value: string) => void;
  onSaveProfile: () => void;
  isSavingProfile: boolean;
  avatarSeed: string;
  avatarBackground: string;
  avatarOptions: AvatarOption[];
  backgroundOptions: string[];
  onSaveAvatar: (seed: string, background: string) => Promise<boolean>;
  isSavingAvatar: boolean;
}) {
  const [isAvatarModalOpen, setAvatarModalOpen] = useState(false);
  const [draftAvatarSeed, setDraftAvatarSeed] = useState(avatarSeed);
  const [draftAvatarBackground, setDraftAvatarBackground] = useState(avatarBackground);

  const openAvatarModal = () => {
    setDraftAvatarSeed(avatarSeed);
    setDraftAvatarBackground(avatarBackground);
    setAvatarModalOpen(true);
  };

  const closeAvatarModal = () => {
    if (isSavingAvatar) {
      return;
    }
    setAvatarModalOpen(false);
  };

  const confirmAvatar = async () => {
    const ok = await onSaveAvatar(draftAvatarSeed, draftAvatarBackground);
    if (ok) {
      setAvatarModalOpen(false);
    }
  };

  return (
    <div className="max-w-2xl animate-in fade-in space-y-8 pb-20 duration-500 md:pb-0">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">账号资料</h2>
        <p className="text-[13px] text-zinc-500">管理您的基础个人信息与系统偏好设置。</p>
      </div>

      <div className="flex flex-col items-start gap-6 border-y border-zinc-200 py-6 sm:flex-row">
        <div className="w-full sm:w-1/3">
          <h3 className="text-[14px] font-medium text-zinc-900">个人头像</h3>
        </div>
        <div className="w-full space-y-4 sm:w-2/3">
          <div className="flex items-center gap-3">
            <img src={user.avatar} className="h-14 w-14 rounded-full border border-zinc-200 shadow-sm" alt="Avatar" />
          </div>
          <Button variant="outline" className="h-9 w-auto px-3 text-[12px]" onClick={openAvatarModal}>
            更换头像
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-start gap-6 border-b border-zinc-200 pb-6 sm:flex-row">
        <div className="w-full sm:w-1/3">
          <h3 className="text-[14px] font-medium text-zinc-900">基础信息</h3>
        </div>
        <div className="w-full space-y-4 sm:w-2/3">
          <Input label="昵称" value={nickname} onChange={(event) => onNicknameChange(event.target.value)} />
          <Input label="登录邮箱（只读）" defaultValue={user.email} disabled />
          <Button className="w-auto" isLoading={isSavingProfile} onClick={onSaveProfile}>
            保存更改
          </Button>
        </div>
      </div>

      {isAvatarModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-semibold text-zinc-900">选择头像</h3>
                <p className="text-[12px] text-zinc-500">头像与背景可分别选择，保存后会写入数据库。</p>
              </div>
              <button
                type="button"
                onClick={closeAvatarModal}
                className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-50 hover:text-zinc-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 flex items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <img
                src={buildNotionistsAvatar(draftAvatarSeed, draftAvatarBackground)}
                className="h-16 w-16 rounded-full border border-zinc-200 bg-white"
                alt="Avatar Preview"
              />
              <div className="text-[12px] text-zinc-500">头像预览</div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-2 text-[12px] font-medium text-zinc-700">头像样式</p>
                <div className="grid grid-cols-6 gap-2">
                  {avatarOptions.map((option) => {
                    const isActive = option.seed === draftAvatarSeed;
                    return (
                      <button
                        key={option.seed}
                        type="button"
                        aria-label={`选择头像 ${option.seed}`}
                        onClick={() => setDraftAvatarSeed(option.seed)}
                        className={`inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full p-0 leading-none transition-all ${
                          isActive ? "ring-2 ring-rose-400 ring-offset-2" : "ring-1 ring-zinc-200 hover:ring-zinc-300"
                        }`}
                      >
                        <img
                          src={buildNotionistsAvatar(option.seed, draftAvatarBackground)}
                          className="block h-10 w-10 rounded-full"
                          alt=""
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-medium text-zinc-700">背景色</p>
                <div className="grid grid-cols-8 gap-2">
                  {backgroundOptions.map((color) => {
                    const isActive = color === draftAvatarBackground;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`选择背景 ${color}`}
                        onClick={() => setDraftAvatarBackground(color)}
                        className={`h-7 w-7 rounded-full border transition-all ${isActive ? "scale-110 border-rose-400 ring-2 ring-rose-200" : "border-zinc-200 hover:scale-105"}`}
                        style={{ backgroundColor: `#${color}` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button type="button" variant="outline" className="w-auto px-3" onClick={closeAvatarModal} disabled={isSavingAvatar}>
                取消
              </Button>
              <Button type="button" className="w-auto px-3" isLoading={isSavingAvatar} onClick={confirmAvatar}>
                保存头像
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ChangePasswordResult = { ok: true } | { ok: false; status: number; error: string };

function SecurityView({
  user,
  onChangePassword,
  isChangingPassword,
}: {
  user: AppUser;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<ChangePasswordResult>;
  isChangingPassword: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const newPasswordHasLength = newPassword.length >= 8;
  const newPasswordHasLetter = /[a-zA-Z]/.test(newPassword);
  const newPasswordHasNumber = /[0-9]/.test(newPassword);
  const newPasswordDiffers = currentPassword.length === 0 || newPassword !== currentPassword;
  const confirmMatches = confirmPassword.length > 0 && confirmPassword === newPassword;

  const strength = [newPasswordHasLength, newPasswordHasLetter, newPasswordHasNumber].filter(Boolean).length;
  const strengthLabel = strength <= 1 ? "弱" : strength === 2 ? "中等" : "合规";
  const policyReady = newPasswordHasLength && newPasswordHasLetter && newPasswordHasNumber;
  const canSubmit =
    currentPassword.trim() !== "" && policyReady && newPasswordDiffers && confirmMatches && !isChangingPassword;

  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const currentPasswordError = passwordError.toLowerCase().includes("current password") ? passwordError : "";
  const generalError = currentPasswordError ? "" : passwordError;

  const passwordRules = [
    { label: "至少 8 位字符", ok: newPasswordHasLength },
    { label: "包含英文字母", ok: newPasswordHasLetter },
    { label: "包含数字", ok: newPasswordHasNumber },
    { label: "不能与当前密码相同", ok: newPasswordDiffers && newPassword.length > 0 },
    { label: "确认密码一致", ok: confirmMatches },
  ];

  const toggleSlot = (shown: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
      aria-label={shown ? "隐藏密码" : "显示密码"}
    >
      {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );

  const submitPasswordChange = async () => {
    if (!canSubmit) {
      if (!currentPassword.trim() || !newPassword || !confirmPassword) {
        setPasswordError("请填写完整密码信息");
        return;
      }
      if (!policyReady) {
        setPasswordError("新密码不符合安全要求");
        return;
      }
      if (!newPasswordDiffers) {
        setPasswordError("新密码不能与当前密码相同");
        return;
      }
      if (!confirmMatches) {
        setPasswordError("两次输入的新密码不一致");
        return;
      }
    }

    setPasswordError("");
    const result = await onChangePassword(currentPassword, newPassword);
    if (!result.ok) {
      setPasswordError(result.error);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    toast.success("密码已更新，正在退出登录");
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="max-w-3xl animate-in fade-in space-y-8 pb-20 duration-500 md:pb-0">
      <div>
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">安全与权限访问</h2>
        <p className="text-[13px] text-zinc-500">按照零信任实践管理当前账号登录凭证与会话安全。</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-2">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 text-[11px] font-mono text-zinc-500">JWT 解析数据 (安全控制台只读展示)</span>
        </div>
        <div className="overflow-x-auto bg-zinc-950 p-4 font-mono text-[12px] leading-relaxed text-zinc-300">
          <div className="flex">
            <span className="w-16 text-pink-400">iss:</span>
            <span className="text-emerald-300">&quot;https://auth.studio.internal&quot;</span>
          </div>
          <div className="flex">
            <span className="w-16 text-pink-400">sub:</span>
            <span className="text-emerald-300">&quot;{user.id}&quot;</span>
          </div>
          <div className="flex">
            <span className="w-16 text-pink-400">roles:</span>
            <span className="text-blue-300">[{user.roles.map((role) => `"${role}"`).join(", ")}]</span>
          </div>
          <div className="flex">
            <span className="w-16 text-pink-400">scopes:</span>
            <span className="text-blue-300">[{user.scopes.map((scope) => `"${scope}"`).join(", ")}]</span>
          </div>
          <div className="flex">
            <span className="w-16 text-pink-400">exp:</span>
            <span className="text-amber-300">1739982000</span>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-[14px] font-semibold text-zinc-900">修改登录密码</h3>
          <p className="mt-1 text-[12px] text-zinc-500">
            更新后将立即使当前登录状态失效，请使用新密码重新登录。
          </p>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] text-amber-800">
            为保障账号安全，密码更新后会吊销历史刷新令牌并要求重新登录。
          </div>

          <div className="grid gap-4">
            <Input
              label="当前密码"
              type={showCurrentPassword ? "text" : "password"}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => {
                setPasswordError("");
                setCurrentPassword(event.target.value);
              }}
              rightSlot={toggleSlot(showCurrentPassword, () => setShowCurrentPassword((value) => !value))}
              error={currentPasswordError || undefined}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="新密码"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => {
                  setPasswordError("");
                  setNewPassword(event.target.value);
                }}
                rightSlot={toggleSlot(showNewPassword, () => setShowNewPassword((value) => !value))}
              />
              <Input
                label="确认新密码"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => {
                  setPasswordError("");
                  setConfirmPassword(event.target.value);
                }}
                rightSlot={toggleSlot(showConfirmPassword, () => setShowConfirmPassword((value) => !value))}
                error={confirmMismatch ? "两次输入的新密码不一致" : undefined}
              />
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-3">
            <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-zinc-700">
              <span>密码强度</span>
              <span>{strengthLabel}</span>
            </div>
            <div className="mb-3 flex h-1.5 gap-1">
              <div className={`flex-1 rounded-full ${strength >= 1 ? "bg-rose-500" : "bg-zinc-200"}`} />
              <div className={`flex-1 rounded-full ${strength >= 2 ? "bg-rose-300" : "bg-zinc-200"}`} />
              <div className={`flex-1 rounded-full ${strength >= 3 ? "bg-emerald-500" : "bg-zinc-200"}`} />
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {passwordRules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2 text-[12px] text-zinc-600">
                  <span
                    className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                      rule.ok ? "border-emerald-300 bg-emerald-50 text-emerald-600" : "border-zinc-200 bg-white text-zinc-300"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>

          {generalError ? (
            <p className="flex items-center text-[12px] text-rose-600">
              <AlertCircle className="mr-1 h-3.5 w-3.5" /> {generalError}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button className="w-auto px-4" isLoading={isChangingPassword} onClick={submitPasswordChange} disabled={!canSubmit}>
              更新密码并重新登录
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ data }: DashboardShellProps) {
  const [activeNav, setActiveNav] = useState<"todos" | "profile" | "security">("todos");
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [nickname, setNickname] = useState(data.me.nickname || data.me.email || "未知用户");
  const [avatarSeed, setAvatarSeed] = useState(data.me.avatar_seed || `${data.me.id}-core`);
  const [avatarBackground, setAvatarBackground] = useState(data.me.avatar_background || "f4f4f5");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const avatarOptions = useMemo<AvatarOption[]>(
    () => [
      { seed: `${data.me.id}-core` },
      { seed: `${data.me.id}-studio` },
      { seed: `${data.me.id}-creator` },
      { seed: `${data.me.id}-editor` },
      { seed: `${data.me.id}-motion` },
      { seed: `${data.me.id}-visual` },
      { seed: `${data.me.id}-audio` },
      { seed: `${data.me.id}-ops` },
      { seed: `${data.me.id}-review` },
      { seed: `${data.me.id}-growth` },
      { seed: `${data.me.id}-lead` },
      { seed: `${data.me.id}-north` },
    ],
    [data.me.id],
  );

  const backgroundOptions = [
    "f4f4f5",
    "e4e4e7",
    "d4d4d8",
    "e5e7eb",
    "f3f4f6",
    "ede9fe",
    "dbeafe",
    "dcfce7",
    "fef3c7",
    "ffedd5",
    "fce7f3",
    "d1fae5",
    "fae8ff",
    "fffbeb",
    "ecfccb",
    "e0f2fe",
  ];

  const patchMe = async (payload: { nickname?: string; avatar_seed?: string; avatar_background?: string }) => {
    const response = await fetch("/api/ums/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = (await response.json().catch(() => null)) as
      | { error?: string; nickname?: string; avatar_seed?: string; avatar_background?: string }
      | null;

    if (!response.ok) {
      throw new Error(body?.error || "更新失败");
    }

    if (body?.nickname) {
      setNickname(body.nickname);
    }
    if (body?.avatar_seed) {
      setAvatarSeed(body.avatar_seed);
    }
    if (body?.avatar_background) {
      setAvatarBackground(body.avatar_background);
    }
  };

  const handleSaveProfile = async () => {
    const nextNickname = nickname.trim();
    if (!nextNickname) {
      toast.error("昵称不能为空");
      return;
    }

    setIsSavingProfile(true);
    try {
      await patchMe({ nickname: nextNickname });
      toast.success("个人资料已更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveAvatar = async (seed: string, background: string) => {
    setIsSavingAvatar(true);
    try {
      await patchMe({ avatar_seed: seed, avatar_background: background });
      toast.success("头像已更新");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "头像更新失败");
      return false;
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleChangePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<ChangePasswordResult> => {
    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/ums/me/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: body?.error || "密码修改失败",
        };
      }

      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : "密码修改失败",
      };
    } finally {
      setIsChangingPassword(false);
    }
  };

  const user: AppUser = useMemo(
    () => ({
      id: data.me.id,
      email: data.me.email,
      name: nickname,
      avatar: buildNotionistsAvatar(avatarSeed, avatarBackground),
      roles: data.me.roles,
      scopes: data.me.scopes,
    }),
    [avatarBackground, avatarSeed, data.me, nickname],
  );

  const navTitles = {
    todos: "Todo 任务",
    profile: "个人资料",
    security: "安全设置",
  } as const;

  const mainNavItems = [
    { id: "todos" as const, label: "Todo 任务", icon: CheckSquare },
  ];

  const settingsItems = [
    { id: "profile" as const, label: "个人资料", icon: Settings },
    { id: "security" as const, label: "安全设置", icon: ShieldCheck },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans text-zinc-900 selection:bg-rose-200 selection:text-rose-900">
      <aside
        className={`hidden h-full shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 transition-[width] duration-300 md:flex ${
          isSidebarCollapsed ? "w-[88px]" : "w-64"
        }`}
      >
        <div
          className={`relative flex h-14 items-center border-b border-zinc-100 ${
            isSidebarCollapsed ? "justify-center px-2" : "justify-between px-3"
          }`}
        >
          <BrandLogo
            className={isSidebarCollapsed ? "absolute left-1/2 -translate-x-1/2 gap-0" : "gap-2.5"}
            logoSize={22}
            withText={!isSidebarCollapsed}
          />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            className={`rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-700 ${
              isSidebarCollapsed ? "absolute right-2.5 top-1/2 -translate-y-1/2" : ""
            }`}
            title={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
            aria-label={isSidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className={`hide-scrollbar flex-1 space-y-6 overflow-y-auto py-4 ${isSidebarCollapsed ? "px-2" : "px-3"}`}>
          <div>
            {!isSidebarCollapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">任务中心</p>
            ) : null}
            <nav className="space-y-0.5">
              {mainNavItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center rounded-lg py-2 text-[13px] font-medium transition-colors ${
                    isSidebarCollapsed ? "justify-center px-2" : "px-3"
                  } ${
                    activeNav === item.id
                      ? "bg-rose-50 text-rose-700 shadow-sm"
                      : "text-zinc-500 hover:bg-rose-50/50 hover:text-rose-700"
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <item.icon className={`${isSidebarCollapsed ? "" : "mr-2.5"} h-4 w-4 ${activeNav === item.id ? "text-rose-600" : "text-zinc-400"}`} />
                  {!isSidebarCollapsed ? item.label : null}
                </button>
              ))}
            </nav>
          </div>

          <div>
            {!isSidebarCollapsed ? (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">系统设置</p>
            ) : null}
            <nav className="space-y-0.5">
              {settingsItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`flex w-full items-center rounded-lg py-2 text-[13px] font-medium transition-colors ${
                    isSidebarCollapsed ? "justify-center px-2" : "px-3"
                  } ${
                    activeNav === item.id
                      ? "bg-rose-50 text-rose-700 shadow-sm"
                      : "text-zinc-500 hover:bg-rose-50/50 hover:text-rose-700"
                  }`}
                  title={isSidebarCollapsed ? item.label : undefined}
                  aria-label={item.label}
                >
                  <item.icon className={`${isSidebarCollapsed ? "" : "mr-2.5"} h-4 w-4 ${activeNav === item.id ? "text-rose-600" : "text-zinc-400"}`} />
                  {!isSidebarCollapsed ? item.label : null}
                </button>
              ))}
            </nav>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-100 p-3">
          <div
            className={`group flex cursor-pointer items-center rounded-lg p-2 transition-colors hover:bg-rose-50/50 ${
              isSidebarCollapsed ? "justify-center" : "justify-between"
            }`}
            onClick={() => setActiveNav("profile")}
            title={isSidebarCollapsed ? "个人资料" : undefined}
          >
            <div className={`flex items-center ${isSidebarCollapsed ? "" : "gap-3"}`}>
              <img src={user.avatar} className="h-8 w-8 rounded-full border border-zinc-200" alt="" />
              {!isSidebarCollapsed ? (
                <div className="flex flex-col">
                  <span className="text-[13px] font-medium text-zinc-900">{user.name}</span>
                  <span className="text-[11px] text-zinc-500">系统管理员</span>
                </div>
              ) : null}
            </div>
            {!isSidebarCollapsed ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  signOut({ callbackUrl: "/login" });
                }}
                className="rounded-md p-1.5 text-zinc-400 opacity-0 transition-all hover:text-rose-600 group-hover:opacity-100"
                title="退出登录"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {isSidebarCollapsed ? (
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="mt-2 flex w-full items-center justify-center rounded-lg p-2 text-zinc-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
              title="退出登录"
              aria-label="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </aside>

      <header className="absolute left-0 right-0 top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-200 bg-white/80 px-4 backdrop-blur-md md:hidden">
        <BrandLogoAnimated className="gap-2.5" logoSize={22} />
        <img src={user.avatar} className="h-7 w-7 rounded-full border border-zinc-200" onClick={() => setActiveNav("profile")} alt="" />
      </header>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-zinc-200 bg-white px-2 py-2 pb-safe md:hidden">
        {[...mainNavItems, { id: "settings_mobile", label: "设置", icon: Settings }].map((item) => {
          const isActive =
            activeNav === item.id ||
            (item.id === "settings_mobile" && (activeNav === "profile" || activeNav === "security"));
          const handleClick = () => {
            const nextNav = item.id === "settings_mobile" ? "profile" : item.id;
            setActiveNav(nextNav as "todos" | "profile" | "security");
          };
          return (
            <button
              key={item.id}
              onClick={handleClick}
              className={`flex flex-1 flex-col items-center justify-center rounded-xl py-1 transition-colors ${isActive ? "text-rose-600" : "text-zinc-400"}`}
            >
              <div className={`mb-0.5 rounded-full p-1.5 transition-colors ${isActive ? "bg-rose-50" : "bg-transparent"}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="relative flex flex-1 flex-col overflow-hidden bg-white pt-14 md:pt-0">
        <div className="hidden h-14 shrink-0 items-center justify-between border-b border-zinc-100 px-8 md:flex">
          <div className="flex items-center text-[13px] font-medium text-zinc-500">
            <span className="text-zinc-900">{navTitles[activeNav]}</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-[1000px]">
            {activeNav === "todos" ? <TodoView storageNamespace={data.me.id} /> : null}
            {activeNav === "profile" ? (
              <SettingsView
                user={user}
                nickname={nickname}
                onNicknameChange={setNickname}
                onSaveProfile={handleSaveProfile}
                isSavingProfile={isSavingProfile}
                avatarSeed={avatarSeed}
                avatarBackground={avatarBackground}
                avatarOptions={avatarOptions}
                backgroundOptions={backgroundOptions}
                onSaveAvatar={handleSaveAvatar}
                isSavingAvatar={isSavingAvatar}
              />
            ) : null}
            {activeNav === "security" ? (
              <SecurityView user={user} onChangePassword={handleChangePassword} isChangingPassword={isChangingPassword} />
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
