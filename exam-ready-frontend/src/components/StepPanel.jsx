import { Outlet } from 'react-router-dom'
import GlassPanel from './GlassPanel.jsx'
import styles from '../App.module.css'

// Keeps the glass-card step treatment isolated to the 3-step flow —
// Home renders directly in <main> (via App.jsx) for a wider, freer
// hero layout instead of being wrapped in this card.
export default function StepPanel() {
  return (
    <GlassPanel className={styles.stage}>
      <Outlet />
    </GlassPanel>
  )
}
