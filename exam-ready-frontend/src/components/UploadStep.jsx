import { useCallback, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
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
const MAX_FILES = 6

export default function UploadStep() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { contentSource, syllabusText, status, error } = useSelector((s) => s.upload)
  const [isDragging, setDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([]) // real File objects — kept out of Redux
  const inputRef = useRef(null)

  const chooseSource = (source) => {
    dispatch(setContentSource(source))
    setPendingFiles([])
  }

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || [])
    if (!incoming.length) return
    setPendingFiles((prev) => {
      const merged = [...prev, ...incoming].slice(0, MAX_FILES)
      return merged
    })
  }, [])

  const removeFile = (index) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleContinue = async () => {
    dispatch(uploadStarted())
    try {
      const result = await uploadSource({
        contentSource,
        files: pendingFiles,
        syllabusText: contentSource === 'syllabus' ? syllabusText : undefined,
      })
      dispatch(
        uploadSucceeded({
          sessionId: result.sessionId,
          files: pendingFiles.map((f) => ({ name: f.name, size: f.size, type: f.type })),
        }),
      )
      navigate('/configure')
    } catch (err) {
      dispatch(uploadFailed(err.message))
    }
  }

  const canContinue =
    contentSource === 'syllabus'
      ? Boolean(syllabusText.trim()) || pendingFiles.length > 0
      : pendingFiles.length > 0
  const atLimit = pendingFiles.length >= MAX_FILES

  return (
    <div className={styles.step}>
      <div className={styles.stepHead}>
        <h2>What are we building this from?</h2>
        <p className={styles.stepSub}>
          Upload one or more files of study material, or hand over a syllabus — we&rsquo;ll pull the
          paper straight out of it.
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
        className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ''} ${atLimit ? styles.dropzoneDisabled : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (!atLimit) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!atLimit) addFiles(e.dataTransfer.files)
        }}
        onClick={() => !atLimit && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !atLimit && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          hidden
          multiple
          accept={contentSource === 'syllabus' ? ACCEPTED_SYLLABUS : ACCEPTED_MATERIAL}
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <span className={styles.dropIcon} aria-hidden="true" />
        <p className={styles.dropText}>
          {atLimit ? `Maximum ${MAX_FILES} files reached` : 'Drop files here, or click to browse'}
        </p>
        <p className={styles.dropHint}>PDF, Word, or image — up to {MAX_FILES} files</p>
      </div>

      {pendingFiles.length > 0 && (
        <ul className={styles.fileList}>
          {pendingFiles.map((file, i) => (
            <li key={`${file.name}-${i}`} className={styles.fileChip}>
              <span className={styles.fileChipName}>{file.name}</span>
              <span className={styles.fileChipSize}>{Math.round(file.size / 1024)} KB</span>
              <button
                type="button"
                className={styles.fileChipRemove}
                onClick={() => removeFile(i)}
                aria-label={`Remove ${file.name}`}
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

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
