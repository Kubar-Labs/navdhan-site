import { ReactNode } from 'react'

interface Props {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  required?: boolean
}

export default function FormField({ label, hint, error, children, required }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="label">
        {label}
        {required && <span className="text-ember ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-steel">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
