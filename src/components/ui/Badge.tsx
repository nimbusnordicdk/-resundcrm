import { cn } from '@/utils/cn'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'gray'
  className?: string
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
  const variants = {
    primary: 'badge-primary',
    success: 'badge-success',
    danger: 'badge-danger',
    warning: 'badge-warning',
    info: 'badge-info',
    gray: 'badge bg-gray-500/20 text-gray-400',
  }

  return <span className={cn(variants[variant], className)}>{children}</span>
}

// Lead status badge helper
export function LeadStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    nyt_lead: { label: 'Nyt Lead', variant: 'info' },
    kvalifikationskald_booket: { label: 'Kvalifikationskald Booket', variant: 'primary' },
    discoverykald_booket: { label: 'Discoverykald Booket', variant: 'primary' },
    salgskald_booket: { label: 'Salgskald Booket', variant: 'warning' },
    onboarding_booket: { label: 'Onboarding Booket', variant: 'warning' },
    kontrakt_sendt: { label: 'Kontrakt Sendt', variant: 'info' },
    kontrakt_underskrevet: { label: 'Kontrakt Underskrevet', variant: 'success' },
    lead_tabt: { label: 'Lead Tabt', variant: 'danger' },
    bureau_afvist: { label: 'Bureau Afvist', variant: 'danger' },
  }

  const config = statusConfig[status] || { label: status, variant: 'gray' }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Customer status badge helper
export function CustomerStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    aktiv: { label: 'Aktiv', variant: 'success' },
    opsagt: { label: 'Opsagt', variant: 'danger' },
    afventer_bekraeftelse: { label: 'Afventer Bekræftelse', variant: 'warning' },
  }

  const config = statusConfig[status] || { label: status, variant: 'gray' }

  return <Badge variant={config.variant}>{config.label}</Badge>
}

// Contract status badge helper
export function ContractStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; variant: BadgeProps['variant'] }> = {
    afventer: { label: 'Afventer', variant: 'warning' },
    underskrevet: { label: 'Underskrevet', variant: 'success' },
    afvist: { label: 'Afvist', variant: 'danger' },
  }

  const config = statusConfig[status] || { label: status, variant: 'gray' }

  return <Badge variant={config.variant}>{config.label}</Badge>
}
