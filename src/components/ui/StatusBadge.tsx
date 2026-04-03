type BadgeProps = {
  status: 'critical' | 'warning' | 'healthy' | 'info' | 'pending' | 'success' | 'FBA' | 'FBM';
  label: string;
};

export function StatusBadge({ status, label }: BadgeProps) {
  const styles = {
    critical: 'badge-error shadow-sm font-black',
    warning: 'badge-warning shadow-sm font-black',
    healthy: 'badge-success shadow-sm font-black',
    success: 'badge-success shadow-sm font-black',
    info: 'badge-info shadow-sm font-black',
    pending: 'badge-warning shadow-sm font-black',
    FBA: 'bg-primary/10 text-primary border border-primary/20 font-black font-mono px-2 py-0.5 rounded-md',
    FBM: 'bg-surface-container-highest text-on-surface-variant font-black font-mono px-2 py-0.5 rounded-md border border-outline-variant/10',
  };

  const isFBA_FBM = status === 'FBA' || status === 'FBM';

  return (
    <span className={`text-[9px] uppercase tracking-widest inline-flex items-center justify-center ${styles[status]}`}>
      {label}
    </span>
  );
}
