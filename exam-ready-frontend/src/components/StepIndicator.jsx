import { useLocation } from 'react-router-dom'

const STEPS = [
  { key: 'upload', label: 'Source', match: (path) => path.startsWith('/upload') },
  { key: 'configure', label: 'Configure', match: (path) => path.startsWith('/configure') },
  { key: 'paper', label: 'Paper', match: (path) => path.startsWith('/paper') },
]

// Uses the shared classes from styles/components.css (plain global
// stylesheet, not a CSS module — hence plain string classNames here).
// Active step is derived from the URL, not passed in as a prop, so
// the indicator and the browser's own back/forward navigation can
// never disagree about which step is showing.
export default function StepIndicator() {
  const { pathname } = useLocation()
  const activeIndex = STEPS.findIndex((s) => s.match(pathname))

  return (
    <ol className="stepList">
      {STEPS.map((step, i) => {
        const state = i < activeIndex ? 'stepItemDone' : i === activeIndex ? 'stepItemActive' : ''
        return (
          <li key={step.key} className={`stepItem ${state}`}>
            <span className="stepDrop" aria-hidden="true" />
            <span className="stepLabel">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
