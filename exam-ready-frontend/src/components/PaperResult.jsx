import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useParams } from 'react-router-dom'
import {
  startGeneration,
  startLoadingExisting,
  generationSucceeded,
  generationFailed,
} from '../store/generationSlice.js'
import { generatePaper, getGeneration, getDownloadUrl } from '../api/client.js'
import RippleButton from './RippleButton.jsx'
import RatingWidget from './RatingWidget.jsx'
import GeneratingStatus from './GeneratingStatus.jsx'
import SectionPreviewModal from './SectionPreviewModal.jsx'
import styles from './PaperResult.module.css'

export default function PaperResult() {
  const { generationId: urlGenerationId } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { status, error, paper, generationId } = useSelector((s) => s.generation)
  const sessionId = useSelector((s) => s.upload.sessionId)
  const config = useSelector((s) => s.config)
  const [activeSection, setActiveSection] = useState(null)

  useEffect(() => {
    if (paper && generationId === urlGenerationId) return
    let cancelled = false
    dispatch(startLoadingExisting())
    getGeneration(urlGenerationId)
      .then((result) => {
        if (!cancelled) dispatch(generationSucceeded(result))
      })
      .catch((err) => {
        if (!cancelled) dispatch(generationFailed(err.message))
      })
    return () => {
      cancelled = true
    }
  }, [urlGenerationId])

  const handleRegenerate = async () => {
    setActiveSection(null)
    dispatch(startGeneration())
    try {
      const result = await generatePaper({
        sessionId,
        config,
        regenerateFrom: urlGenerationId,
        makeItDifferent: true,
      })
      dispatch(generationSucceeded(result))
      navigate(`/paper/${result.generationId}`)
    } catch (err) {
      dispatch(generationFailed(err.message))
    }
  }

  if (status === 'loading') {
    return <GeneratingStatus title="Loading your paper…" />
  }

  if (status === 'pending') {
    return <GeneratingStatus title="Regenerating your paper…" />
  }

  if (status === 'failed') {
    return (
      <div className={styles.failed}>
        <h2>That didn&rsquo;t work cleanly</h2>
        <p>{error || 'Something interrupted the request.'}</p>
        <div className={styles.actions}>
          <div className={styles.actionsLeft}>
            <RippleButton variant="ghost" onClick={() => navigate('/configure')}>
              Back to configure
            </RippleButton>
            <RippleButton variant="ghost" onClick={() => navigate('/')}>
              Go Home
            </RippleButton>
          </div>
          <RippleButton variant="primary" onClick={handleRegenerate} disabled={!sessionId}>
            Try again
          </RippleButton>
        </div>
      </div>
    )
  }

  if (!paper) return null

  return (
    <div className={styles.result}>
      <div className={styles.resultHead}>
        <h2>Your paper is ready</h2>
        <p>
          {paper.totalMarks} marks &middot; {paper.questionCount} questions &middot;{' '}
          {paper.difficulty}
        </p>
      </div>

      <div className={styles.preview}>
        {paper.sections?.map((section) => (
          <div
            key={section.title}
            className={styles.previewSection}
            role="button"
            tabIndex={0}
            onClick={() => setActiveSection(section)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setActiveSection(section)
              }
            }}
            aria-label={`View all questions in ${section.title}`}
          >
            <h3>{section.title}</h3>
            <ol>
              {section.questions.slice(0, 3).map((q) => (
                <li key={q.id}>{q.prompt}</li>
              ))}
            </ol>
            {section.questions.length > 3 && (
              <p className={styles.previewMore}>+{section.questions.length - 3} more</p>
            )}
          </div>
        ))}
      </div>

      <div className={styles.downloads}>
        <a className={styles.downloadLink} href={getDownloadUrl(urlGenerationId, 'pdf')}>
          Download PDF
        </a>
        <a className={styles.downloadLink} href={getDownloadUrl(urlGenerationId, 'docx')}>
          Download Word
        </a>
      </div>

      <div className={styles.actions}>
        <div className={styles.actionsLeft}>
          <RippleButton variant="ghost" onClick={() => navigate('/configure')}>
            Adjust configuration
          </RippleButton>
          <RippleButton variant="ghost" onClick={() => navigate('/')}>
            Go Home
          </RippleButton>
        </div>
        <RippleButton variant="primary" onClick={handleRegenerate} disabled={!sessionId}>
          Regenerate
        </RippleButton>
      </div>

      <RatingWidget generationId={urlGenerationId} />

      {activeSection && (
        <SectionPreviewModal section={activeSection} onClose={() => setActiveSection(null)} />
      )}
    </div>
  )
}
