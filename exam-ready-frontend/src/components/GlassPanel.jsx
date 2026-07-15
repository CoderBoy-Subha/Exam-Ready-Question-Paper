import styles from './GlassPanel.module.css'

export default function GlassPanel({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`${styles.panel} ${className}`} {...rest}>
      <span className={styles.sheen} aria-hidden="true" />
      {children}
    </Tag>
  )
}
