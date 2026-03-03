import { AlertCircle, Loader2 } from "lucide-react";

type InputProps = React.ComponentProps<"input"> & {
  label?: string;
  error?: string;
  rightSlot?: React.ReactNode;
};

export function Input({ label, type = "text", error, rightSlot, ...props }: InputProps) {
  return (
    <div className="space-y-1.5">
      {label ? (
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-[13px] font-medium text-zinc-700" htmlFor={props.id}>
            {label}
          </label>
          {rightSlot}
        </div>
      ) : null}
      <input
        type={type}
        className={`block w-full rounded-lg border bg-white px-3 py-2 text-base text-zinc-900 outline-none transition-all placeholder-zinc-400 shadow-sm md:text-[13px] ${
          error
            ? "border-rose-500 focus:border-rose-500 focus:shadow-[inset_0_0_0_1px_rgba(244,63,94,0.45)]"
            : "border-zinc-200 focus:border-rose-400 focus:shadow-[inset_0_0_0_1px_rgba(244,63,94,0.3)]"
        }`}
        {...props}
      />
      {error ? (
        <p className="mt-1 flex items-center text-[12px] text-rose-500">
          <AlertCircle className="mr-1 h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: "primary" | "outline";
  isLoading?: boolean;
};

export function Button({ children, variant = "primary", isLoading, className = "", ...props }: ButtonProps) {
  const variantClass =
    variant === "outline"
      ? "border border-zinc-200 bg-white text-zinc-700 hover:bg-rose-50 hover:text-rose-700"
      : "bg-rose-500 text-white hover:bg-rose-600 shadow-sm shadow-rose-200";

  return (
    <button
      className={`flex w-full items-center justify-center rounded-lg px-4 py-2 text-[13px] font-medium transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${variantClass} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Loader2 className="-ml-1 mr-2 h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  const reqLength = password.length >= 8;
  const reqLetter = /[a-zA-Z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  const level = [reqLength, reqLetter, reqNumber].filter(Boolean).length;

  const label = level === 0 ? "极弱" : level === 1 ? "弱" : level === 2 ? "中等" : "合规";

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex h-1 gap-1">
        <div className={`flex-1 rounded-full transition-colors ${level >= 1 ? "bg-rose-500" : "bg-zinc-100"}`} />
        <div className={`flex-1 rounded-full transition-colors ${level >= 2 ? "bg-rose-300" : "bg-zinc-100"}`} />
        <div className={`flex-1 rounded-full transition-colors ${level >= 3 ? "bg-emerald-500" : "bg-zinc-100"}`} />
      </div>
      <p className="flex justify-between text-[11px] font-medium tracking-wide text-zinc-500">
        <span>安全合规度</span>
        <span>{label}</span>
      </p>
    </div>
  );
}

export function getPasswordStrengthLevel(password: string): number {
  const reqLength = password.length >= 8;
  const reqLetter = /[a-zA-Z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  return [reqLength, reqLetter, reqNumber].filter(Boolean).length;
}
