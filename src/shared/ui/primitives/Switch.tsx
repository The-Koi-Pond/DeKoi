/**
 * Toggle switch. Renders the `.switch` / `.switch.on` classes from
 * care-fields.css. Controlled: pass `checked` and `onChange`.
 */
interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  ariaLabel: string
  disabled?: boolean
}

export function Switch({ checked, onChange, ariaLabel, disabled }: SwitchProps) {
  return (
    <div
      className={`switch${checked ? ' on' : ''}`}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onChange(!checked)
        }
      }}
    >
      <i />
    </div>
  )
}
