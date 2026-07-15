import RippleButton from './RippleButton.jsx'
import RatingWidget from './RatingWidget.jsx'
import { getDownloadUrl } from '../api/client.js'
import styles from './PaperResult.module.css'

export default function PaperResult({ status, error, paper, onBack, onRegenerate }) {
  if (status === 'pending') {
    return (
      <div className={styles.pending}>
        <div className={styles.pendingDrop} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <h2>Working it through Gemini&hellip;</h2>
        <p>Pulling questions from your material and balancing them to your mark scheme.</p>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className={styles.failed}>
        <h2>That didn&rsquo;t generate cleanly</h2>
        <p>{error || 'Something interrupted the request.'}</p>
        <div className={styles.actions}>
          <RippleButton variant="ghost" onClick={onBack}>
            Back to configure
          </RippleButton>
          <RippleButton variant="primary" onClick={onRegenerate}>
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
          <div key={section.title} className={styles.previewSection}>
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
        <a className={styles.downloadLink} href={getDownloadUrl(paper.generationId, 'pdf')}>
          Download PDF
        </a>
        <a className={styles.downloadLink} href={getDownloadUrl(paper.generationId, 'docx')}>
          Download Word
        </a>
      </div>

      <div className={styles.actions}>
        <RippleButton variant="ghost" onClick={onBack}>
          Adjust configuration
        </RippleButton>
        <RippleButton variant="primary" onClick={onRegenerate}>
          Regenerate
        </RippleButton>
      </div>

      <RatingWidget generationId={paper.generationId} />
    </div>
  )
}
