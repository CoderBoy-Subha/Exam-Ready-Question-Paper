import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GlassPanel from './GlassPanel.jsx'
import RippleButton from './RippleButton.jsx'
import styles from './HeroCarousel.module.css'


const slideModules = import.meta.glob('../assets/hero-slides/*.{png,jpg,jpeg,webp}', {
  eager: true,
  import: 'default',
})

function humanizeCaption(filename) {
  const base = filename.replace(/\.[^.]+$/, '')
  const withoutOrder = base.replace(/^\d+[-_]?/, '')
  const spaced = withoutOrder.replace(/[-_]+/g, ' ').trim()
  const caption = spaced.replace(/\b\w/g, (c) => c.toUpperCase())
  return caption || 'App preview'
}

const imageSlides = Object.entries(slideModules)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([path, src]) => ({
    type: 'image',
    key: path,
    src,
    caption: humanizeCaption(path.split('/').pop()),
  }))


const slides = [...imageSlides, { type: 'cta', key: 'cta-slide' }]

const AUTO_ADVANCE_MS = 5000

export default function HeroCarousel() {
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStartX = useRef(null)
  const total = slides.length
  const isLastSlide = index === total - 1

  useEffect(() => {
    if (paused || isLastSlide || total <= 1) return undefined
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return undefined // manual navigation only

    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), AUTO_ADVANCE_MS)
    return () => clearTimeout(id)
  }, [index, paused, isLastSlide, total])

  const goTo = (i) => setIndex(Math.max(0, Math.min(i, total - 1)))
  const prev = () => goTo(index - 1)
  const next = () => goTo(index + 1)

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    setPaused(true)
  }
  const handleTouchEnd = (e) => {
    if (touchStartX.current == null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(deltaX) > 40) {
      deltaX < 0 ? next() : prev()
    }
    touchStartX.current = null
    setPaused(false)
  }

  if (total === 0) return null

  return (
    <GlassPanel
      className={styles.carousel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={styles.viewport} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {slides.map((slide, i) => (
          <div
            key={slide.key}
            className={`${styles.slide} ${i === index ? styles.slideActive : ''}`}
            aria-hidden={i !== index}
          >
            {slide.type === 'image' ? (
              <>
                <img
                  src={slide.src}
                  alt={slide.caption}
                  className={styles.slideImage}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                />
                <p className={styles.caption}>{slide.caption}</p>
              </>
            ) : (
              <div className={styles.ctaSlide}>
                <span className={styles.ctaDiamond} aria-hidden="true" />
                <h3>Ready when you are</h3>
                <p>Upload your material and have a full paper in minutes.</p>
                <RippleButton
                  variant="primary"
                  onClick={() => navigate('/upload')}
                  tabIndex={i === index ? 0 : -1}
                >
                  Generate Now
                </RippleButton>
              </div>
            )}
          </div>
        ))}

        {total > 1 && (
          <>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navPrev}`}
              onClick={prev}
              disabled={index === 0}
              aria-label="Previous slide"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles.navBtn} ${styles.navNext}`}
              onClick={next}
              disabled={index === total - 1}
              aria-label="Next slide"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className={styles.dots} role="tablist" aria-label="Slides">
          {slides.map((slide, i) => (
            <button
              key={slide.key}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={slide.type === 'cta' ? 'Get started' : `Slide ${i + 1}: ${slide.caption}`}
              className={`${styles.dot} ${i === index ? styles.dotActive : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </GlassPanel>
  )
}
