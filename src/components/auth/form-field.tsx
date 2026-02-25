type FormFieldProps = React.ComponentProps<"input"> & {
  label: string;
  error?: string;
};

export function FormField({ label, error, ...props }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-ink-700" htmlFor={props.id}>
        {label}
      </label>
      <input
        className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ink-700"
        {...props}
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
