import { useRipple } from '../hooks/useRipple.js'
import styles from './RippleButton.module.css'

// Signature interaction for the app: a click spawns a ring anchored at
// the exact pointer position, like a drop hitting the glass surface —
// not a generic Material-style solid-fill ripple.
export default function RippleButton({
  children,
  onClick,
  loading = false,
  disabled = false,
  variant = 'primary',
  type = 'button',
  ...rest
}) {
  const { containerRef, ripples, addRipple } = useRipple()

  const handleClick = (event) => {
    if (disabled || loading) return
    addRipple(event)
    onClick?.(event)
  }

  return (
    <button
      ref={containerRef}
      type={type}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${styles.button} ${styles[variant]} ${loading ? styles.loading : ''}`}
      {...rest}
    >
      <span className={styles.label}>
        {loading ? (
          <span className={styles.dropletSpinner} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        ) : (
          children
        )}
      </span>
      {ripples.map((r) => (
        <span
          key={r.id}
          className={styles.ripple}
          style={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size,
          }}
        />
      ))}
    </button>
  )
}
