// Uses the shared classes from styles/components.css (plain global
// stylesheet, not a CSS module — hence plain string classNames here).
export default function StepIndicator({ steps, activeIndex }) {
  return (
    <ol className="stepList">
      {steps.map((step, i) => {
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
