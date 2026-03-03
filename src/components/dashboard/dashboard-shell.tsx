"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { BrandLogo, BrandLogoAnimated } from "@/components/brand/brand-logo";
import { LibraryHubPanel } from "@/components/dashboard/panels/library-hub-panel";
import { StudioWorkbenchPanel } from "@/components/dashboard/panels/studio-workbench";
import { TodoWorkspace } from "@/components/dashboard/panels/todo-workspace";
import type { DashboardData } from "@/components/dashboard/types";
import { primaryRoleLabel, roleLabels, systemRoleValues } from "@/lib/role-labels";

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
  <div className="space-y-2">
    {label ? <label className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 px-1">{label}</label> : null}
    <div className="relative group">
      {Icon ? <Icon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 transition-colors group-focus-within:text-rose-500" /> : null}
      {rightSlot ? <div className="absolute right-3 top-1/2 z-10 -translate-y-1/2">{rightSlot}</div> : null}
      <input
        type={type}
        className={`block w-full rounded-xl border bg-zinc-50/50 py-2.5 text-sm font-bold text-zinc-900 outline-none transition-all placeholder-zinc-300 dark:bg-zinc-900/50 dark:text-zinc-100 ${
          Icon ? "pl-11" : "pl-4"
        } ${rightSlot ? "pr-12" : "pr-4"} ${
          error
            ? "border-rose-500 ring-4 ring-rose-500/5"
            : "border-zinc-200 focus:border-rose-400 focus:bg-white focus:shadow-xl focus:shadow-rose-500/5 dark:border-zinc-800 dark:focus:border-rose-900/50 dark:focus:bg-zinc-950"
        }`}
        {...props}
      />
    </div>
    {error ? (
      <p className="mt-1 flex items-center px-1 text-[11px] font-bold text-rose-500 animate-in fade-in slide-in-from-top-1">
        <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> {error}
      </p>
    ) : null}
  </div>
);

const ReadonlyField = ({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) => (
  <div className="space-y-2">
    <p className="block text-[11px] font-black uppercase tracking-widest text-zinc-400 px-1">{label}</p>
    <div className={`rounded-xl border border-zinc-100 bg-zinc-50/30 px-4 py-2.5 text-sm font-bold text-zinc-600 dark:border-zinc-800/50 dark:bg-zinc-900/20 dark:text-zinc-400 ${mono ? "font-mono text-[13px]" : ""}`}>
      {value || "—"}
    </div>
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
    "flex select-none items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40";
  const variants = {
    primary: "bg-zinc-900 text-white hover:bg-rose-600 shadow-lg shadow-zinc-900/10 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-rose-500 dark:hover:text-white dark:shadow-none",
    secondary: "bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20",
    outline: "bg-white text-zinc-700 border border-zinc-200 hover:border-rose-200 hover:text-rose-600 shadow-sm dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800 dark:hover:border-rose-900/50",
    ghost: "bg-transparent text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
    danger: "bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20",
  };

  return (
    <button className={`${baseStyle} ${variants[variant]} ${className}`} disabled={isLoading} {...props}>
      {isLoading ? <Loader2 className="-ml-1 mr-2.5 h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
};

function TodoView({ storageNamespace }: { storageNamespace: string }) {
  return <TodoWorkspace storageNamespace={storageNamespace} />;
}

function StudioWorkbenchView({
  ownerMe,
  ownerDirectory,
}: {
  ownerMe: { id: string; nickname: string; avatarSeed?: string; avatarBackground?: string };
  ownerDirectory: Array<{ id: string; nickname: string; avatarSeed?: string; avatarBackground?: string }>;
}) {
  return <StudioWorkbenchPanel ownerMe={ownerMe} ownerDirectory={ownerDirectory} />;
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
  const primaryRole = primaryRoleLabel(user.roles) || "成员";

  const openAvatarModal = () => {
    setDraftAvatarSeed(avatarSeed);
    setDraftAvatarBackground(avatarBackground);
    setAvatarModalOpen(true);
  };

  const closeAvatarModal = () => {
    if (isSavingAvatar) return;
    setAvatarModalOpen(false);
  };

  const confirmAvatar = async () => {
    const ok = await onSaveAvatar(draftAvatarSeed, draftAvatarBackground);
    if (ok) setAvatarModalOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-[1200px] animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4 pb-24 md:pb-8">
      {/* Profile Header Card */}
      <section className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-rose-500/5 blur-3xl dark:bg-rose-500/10" />
        <div className="relative flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
          <div className="relative group cursor-pointer" onClick={openAvatarModal}>
            <img src={user.avatar} className="h-20 w-20 rounded-full border-4 border-zinc-50 shadow-xl transition-transform group-hover:scale-105 dark:border-zinc-900" alt="Avatar" />
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <Plus className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-zinc-100">{nickname || "未设置昵称"}</h2>
            <div className="flex flex-wrap justify-center gap-2 md:justify-start">
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">{user.email}</span>
              <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{primaryRole}</span>
            </div>
          </div>
          <Button variant="outline" className="h-9 w-full md:w-auto" onClick={openAvatarModal}>
            个性化形象
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Basic Info Column */}
        <section className="lg:col-span-2 space-y-5 rounded-[28px] border border-zinc-100 bg-zinc-50/30 p-5 dark:border-zinc-800 dark:bg-zinc-900/20 md:p-6">
          <div>
            <h3 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">基础信息设置</h3>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-500">更新您的公开展示名称与其他账号属性。</p>
          </div>
          
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <Input 
                label="公开昵称" 
                value={nickname} 
                onChange={(event) => onNicknameChange(event.target.value)} 
                placeholder="起一个好听的名字吧"
              />
            </div>
            <ReadonlyField label="主身份标识" value={primaryRole} />
            <ReadonlyField label="系统唯一编号" value={user.id} mono />
            <div className="md:col-span-2">
              <ReadonlyField label="关联邮箱地址" value={user.email} />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button 
              className="w-full md:w-auto min-w-[130px]" 
              isLoading={isSavingProfile} 
              onClick={onSaveProfile}
              disabled={nickname.trim() === (user.name || "").trim()}
            >
              保存资料修改
            </Button>
          </div>
        </section>

        {/* Status/Activity Column */}
        <section className="space-y-5 rounded-[28px] border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-6">
          <div>
            <h3 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">账号当前状态</h3>
            <p className="mt-0.5 text-[11px] font-medium text-zinc-500">查看您的访问权限与安全统计。</p>
          </div>

          <div className="space-y-3.5">
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-900/50">
              <span className="text-[11px] font-bold text-zinc-500">权限节点数</span>
              <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">{user.scopes.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-900/50">
              <span className="text-[11px] font-bold text-zinc-500">安全等级</span>
              <span className="flex items-center gap-1.5 text-sm font-black text-emerald-500">
                <ShieldCheck size={14} /> 极高
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-3.5 dark:bg-zinc-900/50">
              <span className="text-[11px] font-bold text-zinc-500">会话版本</span>
              <span className="text-sm font-black text-zinc-900 dark:text-zinc-100">v1.0.4</span>
            </div>
          </div>
        </section>
      </div>

      {/* Avatar Customization Modal - M3 Standard */}
      {isAvatarModalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-[560px] rounded-[40px] border border-zinc-200 bg-white p-8 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 animate-in zoom-in-95 duration-300">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">自定义形象</h3>
                <p className="mt-1 text-[12px] font-medium text-zinc-500">通过不同的种子与背景色彩组合，打造独特的标识。</p>
              </div>
              <button onClick={closeAvatarModal} className="rounded-full bg-zinc-100 p-2 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="mb-10 flex flex-col items-center gap-6 rounded-[32px] bg-zinc-50 p-8 dark:bg-zinc-900/50">
              <div className="relative">
                <img
                  src={buildNotionistsAvatar(draftAvatarSeed, draftAvatarBackground)}
                  className="h-32 w-32 rounded-full border-4 border-white bg-white shadow-2xl dark:border-zinc-800 object-cover"
                  alt="Avatar Preview"
                />
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <p className="mb-4 px-1 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">选择角色种子</p>
                <div className="grid grid-cols-6 gap-3">
                  {avatarOptions.map((option) => {
                    const isActive = option.seed === draftAvatarSeed;
                    return (
                      <button
                        key={option.seed}
                        onClick={() => setDraftAvatarSeed(option.seed)}
                        className={`inline-flex aspect-square items-center justify-center rounded-2xl transition-all active:scale-90 ${
                          isActive ? "ring-2 ring-rose-500 ring-offset-4 ring-offset-white dark:ring-offset-zinc-950" : "bg-zinc-100/50 dark:bg-zinc-900 hover:bg-zinc-100"
                        }`}
                      >
                        <img src={buildNotionistsAvatar(option.seed, draftAvatarBackground)} className="h-full w-full rounded-full object-cover" alt="" />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="mb-4 px-1 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400">选择氛围色</p>
                <div className="grid grid-cols-8 gap-3">
                  {backgroundOptions.map((color) => {
                    const isActive = color === draftAvatarBackground;
                    return (
                      <button
                        key={color}
                        onClick={() => setDraftAvatarBackground(color)}
                        className={`h-8 w-8 rounded-full border-2 transition-all active:scale-90 ${isActive ? "scale-110 border-zinc-900 ring-2 ring-rose-500/20 dark:border-white" : "border-transparent hover:scale-105"}`}
                        style={{ backgroundColor: `#${color}` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-10 flex gap-3">
              <Button variant="outline" className="flex-1 rounded-2xl" onClick={closeAvatarModal} disabled={isSavingAvatar}>
                取消
              </Button>
              <Button className="flex-[2] rounded-2xl" isLoading={isSavingAvatar} onClick={confirmAvatar}>
                应用并保存形象
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
  const strengthLabel = strength <= 1 ? "安全性：低" : strength === 2 ? "安全性：中" : "安全性：极高";
  const policyReady = newPasswordHasLength && newPasswordHasLetter && newPasswordHasNumber;
  const canSubmit =
    currentPassword.trim() !== "" && policyReady && newPasswordDiffers && confirmMatches && !isChangingPassword;

  const confirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword;
  const currentPasswordError = passwordError.toLowerCase().includes("current password") ? "当前密码输入有误" : "";
  const generalError = currentPasswordError ? "" : passwordError;

  const passwordRules = [
    { label: "至少 8 位字符", ok: newPasswordHasLength },
    { label: "包含英文字母", ok: newPasswordHasLetter },
    { label: "包含数字", ok: newPasswordHasNumber },
    { label: "不同于当前密码", ok: newPasswordDiffers && newPassword.length > 0 },
    { label: "确认密码一致", ok: confirmMatches },
  ];
  const localizedRoles = roleLabels(user.roles);
  const rawRoles = systemRoleValues(user.roles);

  const toggleSlot = (shown: boolean, onToggle: () => void) => (
    <button
      type="button"
      onClick={onToggle}
      className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
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
    <div className="mx-auto w-full max-w-[1200px] animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-4 pb-24 md:pb-8">
      <div>
        <h2 className="text-xl font-black text-zinc-900 dark:text-zinc-100 leading-tight">安全与权限访问</h2>
        <p className="text-[12px] font-medium text-zinc-500">管理您的登录凭证、系统权限与会话安全风险。</p>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Password Form Column */}
        <section className="lg:col-span-8 space-y-6 rounded-[28px] border border-zinc-100 bg-zinc-50/30 p-5 dark:border-zinc-800 dark:bg-zinc-900/20 md:p-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">重置登录密码</h3>
              <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
                <ShieldCheck size={12} className="text-emerald-500" />
                安全受限操作
              </div>
            </div>
            <p className="text-[11px] font-medium leading-relaxed text-amber-600 dark:text-amber-400">
              为保障您的账号安全，密码更新后将立即吊销所有历史刷新令牌，并要求您在当前设备重新登录。
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3">
            <Input
              label="当前密码"
              type={showCurrentPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(event) => { setPasswordError(""); setCurrentPassword(event.target.value); }}
              rightSlot={toggleSlot(showCurrentPassword, () => setShowCurrentPassword((v) => !v))}
              error={currentPasswordError || undefined}
            />
            <Input
              label="新设密码"
              type={showNewPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(event) => { setPasswordError(""); setNewPassword(event.target.value); }}
              rightSlot={toggleSlot(showNewPassword, () => setShowNewPassword((v) => !v))}
            />
            <Input
              label="重复新密码"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(event) => { setPasswordError(""); setConfirmPassword(event.target.value); }}
              rightSlot={toggleSlot(showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
              error={confirmMismatch ? "两次输入的新密码不一致" : undefined}
            />
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-zinc-400">密码合规强度</span>
              <span className={`text-[11px] font-black uppercase tracking-widest ${strength >= 3 ? "text-emerald-500" : strength === 2 ? "text-amber-500" : "text-rose-500"}`}>{strengthLabel}</span>
            </div>
            <div className="mb-6 flex h-1.5 gap-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-900">
              <div className={`h-full transition-all duration-500 ${strength >= 1 ? "w-1/3 bg-rose-500" : "w-0"}`} />
              <div className={`h-full transition-all duration-500 ${strength >= 2 ? "w-1/3 bg-amber-500" : "w-0"}`} />
              <div className={`h-full transition-all duration-500 ${strength >= 3 ? "w-1/3 bg-emerald-500" : "w-0"}`} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {passwordRules.map((rule) => (
                <div key={rule.label} className="flex items-center gap-2.5">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all ${rule.ok ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-200 bg-transparent text-zinc-200 dark:border-zinc-800"}`}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                  <span className={`text-[12px] font-bold ${rule.ok ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>{rule.label}</span>
                </div>
              ))}
            </div>
          </div>

          {generalError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-[12px] font-bold text-rose-600 animate-in shake-1 dark:bg-rose-950/20">
              <AlertCircle size={16} /> {generalError}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button className="w-full md:w-auto min-w-[200px]" isLoading={isChangingPassword} onClick={submitPasswordChange} disabled={!canSubmit}>
              确认修改并强制重新登录
            </Button>
          </div>
        </section>

        {/* Sidebar Info Columns */}
        <div className="lg:col-span-4 space-y-6">
          <section className="space-y-5 rounded-[28px] border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-7">
            <h3 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">JWT 会话负载信息</h3>
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="bg-zinc-50 px-4 py-1.5 dark:bg-zinc-900">
                <span className="text-[9px] font-mono font-black uppercase tracking-widest text-zinc-400">Claims Inspection</span>
              </div>
              <div className="space-y-2 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-400">
                <div className="flex"><span className="w-12 text-rose-400">iss:</span><span className="text-emerald-400">"studio.internal"</span></div>
                <div className="flex"><span className="w-12 text-rose-400">sub:</span><span className="text-emerald-400">"{user.id.slice(0, 12)}..."</span></div>
                <div className="flex flex-col gap-0.5">
                  <span className="w-12 text-rose-400">roles:</span>
                  <div className="flex flex-wrap gap-1 pl-4">
                    {rawRoles.map(r => <span key={r} className="text-blue-400">"{r}",</span>)}
                  </div>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="w-12 text-rose-400">scopes:</span>
                  <div className="flex flex-wrap gap-1 pl-4">
                    {user.scopes.slice(0, 4).map(s => <span key={s} className="text-blue-400">"{s}",</span>)}
                    <span className="text-zinc-600">...and {user.scopes.length - 4} more</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5 rounded-[28px] border border-zinc-100 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950 md:p-7">
            <h3 className="text-[14px] font-black text-zinc-900 dark:text-zinc-100">角色与权限清单</h3>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">核准角色</p>
                <div className="flex flex-wrap gap-1.5">
                  {localizedRoles.map(r => <span key={r} className="rounded-lg border border-zinc-100 bg-zinc-50 px-2 py-0.5 text-[10px] font-black text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">{r}</span>)}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">有效权限范围 ({user.scopes.length})</p>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
                  {user.scopes.map(s => <div key={s} className="rounded-lg bg-zinc-50 px-3 py-1 text-[10px] font-bold text-zinc-500 dark:bg-zinc-900">{s}</div>)}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ data }: DashboardShellProps) {
  const [activeNav, setActiveNav] = useState<"studio" | "library" | "todos" | "profile" | "security" | "rbac">("studio");
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [nickname, setNickname] = useState(data.me.nickname || data.me.email || "未知用户");
  const [avatarSeed, setAvatarSeed] = useState(data.me.avatar_seed || `${data.me.id}-core`);
  const [avatarBackground, setAvatarBackground] = useState(data.me.avatar_background || "f4f4f5");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const mobileDrawerCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDrawerId = "dashboard-mobile-sidebar";

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
  const userRoleLabel = primaryRoleLabel(user.roles) || "成员";

  const navTitles = {
    studio: "创作工作台",
    library: "资料库",
    todos: "待办任务",
    profile: "个人资料",
    security: "安全设置",
    rbac: "用户管理",
  } as const;

  const mainNavItems = [
    { id: "studio" as const, label: "创作工作台", icon: Sparkles },
    { id: "library" as const, label: "资料库", icon: BookOpen },
    { id: "todos" as const, label: "待办任务", icon: CheckSquare },
  ];

  const settingsItems = [
    { id: "profile" as const, label: "个人资料", icon: Settings },
    { id: "security" as const, label: "安全设置", icon: ShieldCheck },
  ];

  const adminItems = data.canManageUsers ? [{ id: "rbac" as const, label: "用户管理", icon: Settings }] : [];
  const mobileNavItems = [...settingsItems, ...adminItems];

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const html = document.documentElement;
    const originalOverflow = document.body.style.overflow;
    const originalHtmlOverflow = html.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    html.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      html.style.overflow = originalHtmlOverflow;
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const previousFocusedElement = document.activeElement as HTMLElement | null;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    const focusTimer = window.setTimeout(() => {
      mobileDrawerCloseButtonRef.current?.focus();
    }, 0);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleEscape);
      previousFocusedElement?.focus?.();
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const openMobileMenu = () => {
    setIsMobileMenuOpen(true);
  };

  const handleMobileNavSelect = (next: "studio" | "library" | "todos" | "profile" | "security" | "rbac") => {
    setActiveNav(next);
    closeMobileMenu();
  };

  const handleMobileAvatarClick = () => {
    setActiveNav("profile");
    closeMobileMenu();
  };

  return (
    <div className="flex h-[100svh] min-h-screen w-full min-w-0 overflow-hidden bg-white font-sans text-zinc-900 selection:bg-rose-200 selection:text-rose-900">
      <aside
        className={`hidden h-[100svh] min-h-screen shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/50 transition-[width] duration-300 md:flex ${
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
                  <span className="text-[11px] text-zinc-500">{userRoleLabel}</span>
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

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm transition-all animate-in fade-in duration-300 md:hidden dark:bg-black/60" 
          onClick={closeMobileMenu}
        />
      )}

      {/* Mobile Sidebar Drawer - Refined UI with Dark Mode */}
      <aside
        id={mobileDrawerId}
        role="dialog"
        aria-modal="true"
        aria-label="移动端侧边栏菜单"
        className={`fixed inset-y-0 left-0 z-[60] flex w-[84vw] max-w-[320px] flex-col bg-white transition-transform duration-300 ease-out md:hidden dark:bg-zinc-950 dark:border-r dark:border-zinc-800/50 ${
          isMobileMenuOpen ? "translate-x-0 shadow-[20px_0_80px_-10px_rgba(0,0,0,0.15)] dark:shadow-none" : "-translate-x-full"
        } will-change-transform`}
      >
        <div className="flex h-[72px] items-center justify-between border-b border-zinc-100/50 px-6 dark:border-zinc-800/50">
          <BrandLogo logoSize={26} className="origin-left dark:text-white" textClassName="font-black dark:text-white" />
          <button
            ref={mobileDrawerCloseButtonRef}
            onClick={closeMobileMenu}
            className="group flex h-10 w-10 items-center justify-center rounded-full bg-zinc-50 text-zinc-500 transition-all active:scale-90 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
          </button>
        </div>

        <div className="hide-scrollbar flex-1 space-y-8 overflow-y-auto px-4 py-8">
          <section>
            <p className="mb-4 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">工作空间</p>
            <nav className="space-y-1.5">
              {mainNavItems.map(item => {
                const isActive = activeNav === item.id;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => handleMobileNavSelect(item.id)} 
                    className={`group relative flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97] ${
                      isActive 
                        ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 dark:bg-rose-600 dark:text-white dark:shadow-rose-600/20" 
                        : "text-zinc-800 hover:bg-zinc-100/70 hover:text-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? "text-rose-400 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`} />
                    {item.label}
                    {isActive && <div className="absolute right-4 h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse dark:bg-white" />}
                  </button>
                );
              })}
            </nav>
          </section>

          <section>
            <p className="mb-4 px-4 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">管理与安全</p>
            <nav className="space-y-1.5">
              {mobileNavItems.map(item => {
                const isActive = activeNav === item.id;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => handleMobileNavSelect(item.id)} 
                    className={`group flex w-full items-center gap-4 rounded-2xl px-4 py-3.5 text-[15px] font-bold transition-all active:scale-[0.97] ${
                      isActive 
                        ? "bg-zinc-900 text-white shadow-lg shadow-zinc-900/20 dark:bg-rose-600 dark:text-white dark:shadow-rose-600/20" 
                        : "text-zinc-800 hover:bg-zinc-100/70 hover:text-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900/50 dark:hover:text-white"
                    }`}
                  >
                    <item.icon className={`h-5 w-5 transition-transform group-hover:scale-110 ${isActive ? "text-rose-400 dark:text-white" : "text-zinc-600 dark:text-zinc-300"}`} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </section>
        </div>

        <div className="mt-auto border-t border-zinc-100/50 p-6 bg-zinc-50/30 dark:border-zinc-800/50 dark:bg-zinc-900/20">
          <div className="flex items-center gap-4 rounded-[24px] bg-white border border-zinc-100 p-4 shadow-sm dark:bg-zinc-950 dark:border-zinc-800/80">
            <div className="relative">
              <img src={user.avatar} className="h-12 w-12 rounded-full border-2 border-zinc-50 bg-zinc-100 object-cover dark:border-zinc-900 dark:bg-zinc-800" alt="" />
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-500 dark:border-zinc-950" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-black tracking-tight text-zinc-900 dark:text-zinc-100">{user.name}</p>
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-zinc-400/80 dark:text-zinc-500">{userRoleLabel}</p>
            </div>
            <button 
              onClick={() => signOut({ callbackUrl: "/login" })} 
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 transition-all active:scale-90 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:hover:bg-rose-500/20"
              title="退出登录"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Adjust Padding for Floating Header */}
      <main className="relative flex h-[100svh] min-h-screen min-h-0 flex-1 flex-col bg-white pt-[calc(env(safe-area-inset-top)+76px)] md:pt-0 dark:bg-zinc-950">
        {/* Mobile Top Header - Floating Glass Style */}
        <header className="fixed left-0 right-0 top-0 z-40 flex h-[calc(env(safe-area-inset-top)+72px)] shrink-0 items-end justify-between px-4 pb-3 md:hidden">
          <div className="flex h-12 w-full items-center justify-between rounded-full border border-zinc-200 bg-white/80 px-2 pr-4 shadow-[0_8px_32px_-10px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-zinc-800/50 dark:bg-zinc-900/70 dark:shadow-none">
            <div className="flex items-center gap-1">
              <button
                ref={mobileMenuButtonRef}
                onClick={openMobileMenu}
                className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-600 transition-all active:scale-90 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                aria-expanded={isMobileMenuOpen}
                aria-controls={mobileDrawerId}
                aria-label="打开菜单"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
            <img
              src={user.avatar}
              className="h-8 w-8 cursor-pointer rounded-full border-2 border-zinc-100 bg-white shadow-sm transition-transform active:scale-90 dark:border-zinc-700 dark:bg-zinc-900"
              onClick={handleMobileAvatarClick}
              alt="个人资料"
            />
          </div>
        </header>

        <div className="hidden h-14 shrink-0 items-center justify-between border-b border-zinc-100 px-8 md:flex dark:border-zinc-800/50">
          <div className="flex items-center text-[13px] font-medium text-zinc-500 dark:text-zinc-400">
            <span className="text-zinc-900 dark:text-zinc-100">{navTitles[activeNav]}</span>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button className="text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="hide-scrollbar flex-1 min-h-0 overflow-y-auto p-3 pt-2 sm:p-4 lg:p-8">
          <div className="mx-auto w-full max-w-[1800px]">
            {activeNav === "studio" ? (
              <StudioWorkbenchView
                ownerMe={{
                  id: data.me.id,
                  nickname: data.me.nickname,
                  avatarSeed: data.me.avatar_seed,
                  avatarBackground: data.me.avatar_background,
                }}
                ownerDirectory={data.users.map((item) => ({
                  id: item.id,
                  nickname: item.nickname || item.email || "未命名用户",
                  avatarSeed: item.avatar_seed,
                  avatarBackground: item.avatar_background,
                }))}
              />
            ) : null}
            {activeNav === "library" ? <LibraryHubPanel /> : null}
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
