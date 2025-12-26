import { cn } from '@/utils/cn'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: React.ElementType
  iconColor?: string
  trend?: {
    value: number
    isPositive: boolean
  }
  description?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'bg-primary-600',
  trend,
  description,
}: StatCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <TrendingUp className="w-4 h-4 text-success-light" />
              ) : (
                <TrendingDown className="w-4 h-4 text-danger-light" />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-success-light' : 'text-danger-light'
                )}
              >
                {trend.value}%
              </span>
              <span className="text-sm text-gray-500">vs. sidste md.</span>
            </div>
          )}
          {description && (
            <p className="text-sm text-gray-500 mt-2">{description}</p>
          )}
        </div>
        <div className={cn('stat-icon', iconColor)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  )
}
