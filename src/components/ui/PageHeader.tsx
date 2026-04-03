export function PageHeader({ title, subtitle, icon, action }: { title: string, subtitle?: string, icon?: string, action?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 px-1">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-sm font-black text-on-surface flex items-center gap-3">
           {icon && <span className="material-symbols-outlined text-[28px] text-primary icon-filled">{icon}</span>}
           {title}
        </h1>
        {subtitle && (
          <p className="text-body-sm text-on-surface-variant flex items-center gap-2 font-medium">
             {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-3">{action}</div>}
    </div>
  );
}
