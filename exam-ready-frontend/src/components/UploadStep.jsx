import { useCallback, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  setContentSource,
  setSyllabusText,
  uploadStarted,
  uploadSucceeded,
  uploadFailed,
} from '../store/uploadSlice.js'
import { uploadSource } from '../api/client.js'
import RippleButton from './RippleButton.jsx'
import styles from './UploadStep.module.css'

const ACCEPTED_MATERIAL = '.pdf,.doc,.docx,image/*'
const ACCEPTED_SYLLABUS = '.pdf,.doc,.docx,image/*,text/plain'

export default function UploadStep({ onContinue }) {
  const dispatch = useDispatch()
  const { contentSource, file, syllabusText, status, error } = useSelector((s) => s.upload)
  const [isDragging, setDragging] = useState(false)
  const [pendingFile, setPendingFile] = useState(null) // real File object — kept out of Redux
  const inputRef = useRef(null)

  const chooseSource = (source) => {
    dispatch(setContentSource(source))
    setPendingFile(null)
  }

  const handleFiles = useCallback((fileList) => {
    const picked = fileList?.[0]
    if (!picked) return
    setPendingFile(picked)
  }, [])

  const handleContinue = async () => {
    dispatch(uploadStarted())
    try {
      const result = await uploadSource({
        contentSource,
        file: pendingFile,
        syllabusText: contentSource === 'syllabus' ? syllabusText : undefined,
      })
      dispatch(
        uploadSucceeded({
          sessionId: result.sessionId,
          file: pendingFile
            ? { name: pendingFile.name, size: pendingFile.size, type: pendingFile.type }
            : null,
        }),
      )
      onContinue()
    } catch (err) {
      dispatch(uploadFailed(err.message))
    }
  }

  const canContinue =
    contentSource === 'syllabus'
      ? Boolean(syllabusText.trim()) || Boolean(pendingFile)
      : Boolean(pendingFile)

  const displayFile = pendingFile ? { name: pendingFile.name, size: pendingFile.size } : file

  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <h2>What are we building this from?</h2>
        <p className={styles.stepSub}>
          Upload study material, or hand over a syllabus — we&rsquo;ll pull the paper straight
          out of it.
        </p>
      </div>

      <div className={styles.sourceToggle} role="radiogroup" aria-label="Source type">
        <button
          type="button"
          role="radio"
          aria-checked={contentSource === 'study_material'}
          className={`${styles.sourceOption} ${contentSource === 'study_material' ? styles.sourceOptionActive : ''}`}
          onClick={() => chooseSource('study_material')}
        >
          Study material
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={contentSource === 'syllabus'}
          className={`${styles.sourceOption} ${contentSource === 'syllabus' ? styles.sourceOptionActive : ''}`}
          onClick={() => chooseSource('syllabus')}
        >
          Syllabus
        </button>
      </div>

      <div
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          accept={contentSource === 'syllabus' ? ACCEPTED_SYLLABUS : ACCEPTED_MATERIAL}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <span className={styles.dropIcon} aria-hidden="true" />
        {displayFile ? (
          <div className={styles.fileChip}>
            <strong>{displayFile.name}</strong>
            <span>{Math.round(displayFile.size / 1024)} KB</span>
          </div>
        ) : (
          <>
            <p className={styles.dropText}>Drop a file here, or click to browse</p>
            <p className={styles.dropHint}>PDF, Word, or image</p>
          </>
        )}
      </div>

      {contentSource === 'syllabus' && (
        <>
          <div className={styles.orDivider}>
            <span>or paste it as text</span>
          </div>
          <textarea
            className={styles.syllabusText}
            placeholder="Paste your syllabus text here..."
            value={syllabusText}
            onChange={(e) => dispatch(setSyllabusText(e.target.value))}
            rows={4}
          />
        </>
      )}

      {error && <p className={styles.errorText}>{error}</p>}

      <div className={styles.actions}>
        <RippleButton
          variant="primary"
          onClick={handleContinue}
          disabled={!canContinue}
          loading={status === 'uploading'}
        >
          Continue
        </RippleButton>
      </div>
    </div>
  )
}
