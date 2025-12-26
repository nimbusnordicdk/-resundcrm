import { cn } from '@/utils/cn'

interface TableProps {
  children: React.ReactNode
  className?: string
}

export function Table({ children, className }: TableProps) {
  return (
    <div className="table-container">
      <table className={cn('table', className)}>{children}</table>
    </div>
  )
}

export function TableHeader({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <thead className={className}>{children}</thead>
}

export function TableBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <tbody className={className}>{children}</tbody>
}

export function TableRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  return (
    <tr
      className={cn(onClick && 'cursor-pointer', className)}
      onClick={onClick}
    >
      {children}
    </tr>
  )
}

export function TableHead({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) {
  return <th className={className}>{children}</th>
}

export function TableCell({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode
  className?: string
  colSpan?: number
}) {
  return <td className={className} colSpan={colSpan}>{children}</td>
}

export function TableEmpty({ message = 'Ingen data fundet' }: { message?: string }) {
  return (
    <tr>
      <td colSpan={100} className="text-center py-8 text-gray-500">
        {message}
      </td>
    </tr>
  )
}
