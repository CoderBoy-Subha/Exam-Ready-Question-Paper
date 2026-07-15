// Mirrors question_categories in the DB schema (schema.sql) and
// QUESTION_CATEGORIES in the frontend (src/utils/questionCategories.js).
// Three independent copies of the same fixed reference data, one per
// codebase — a deliberate tradeoff for this stack (separate repos,
// no shared package) rather than an oversight. If a category is ever
// added or a mark value changes, update all three.
export const QUESTION_CATEGORIES = [
  { code: 'MCQ_1', kind: 'mcq', marks: 1, label: 'MCQ' },
  { code: 'SUB_1', kind: 'subjective', marks: 1, label: 'Short Answer' },
  { code: 'SUB_2', kind: 'subjective', marks: 2, label: 'Short Answer' },
  { code: 'SUB_3', kind: 'subjective', marks: 3, label: 'Short Answer' },
  { code: 'SUB_4', kind: 'subjective', marks: 4, label: 'Short Answer' },
  { code: 'SUB_5', kind: 'subjective', marks: 5, label: 'Short Answer' },
  { code: 'SUB_6', kind: 'subjective', marks: 6, label: 'Short Answer' },
  { code: 'SUB_8', kind: 'subjective', marks: 8, label: 'Long Answer' },
  { code: 'SUB_10', kind: 'subjective', marks: 10, label: 'Long Answer' },
  { code: 'SUB_15', kind: 'subjective', marks: 15, label: 'Long Answer' },
  { code: 'SUB_20', kind: 'subjective', marks: 20, label: 'Long Answer' },
]

export const CATEGORY_BY_CODE = Object.fromEntries(QUESTION_CATEGORIES.map((c) => [c.code, c]))

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixture']

export const CONTENT_SOURCES = ['study_material', 'syllabus']

// file_format values legal for each content_source — mirrors the
// generations CHECK constraint in schema.sql exactly, so the backend
// rejects an invalid combination before it ever reaches Postgres.
export const VALID_FILE_FORMATS_BY_SOURCE = {
  study_material: ['pdf', 'docx', 'image'],
  syllabus: ['pdf', 'docx', 'image', 'text'],
}

/**
 * Sums count * marks across a { categoryCode: count } map. This is the
 * same computation as the DB's validate_generation_marks() function —
 * kept in sync deliberately, not generated from one source (see note
 * above). Used both to validate the requested config server-side and
 * to reconcile what Gemini actually returned.
 */
export function computeTotalMarks(questionCounts) {
  return Object.entries(questionCounts || {}).reduce((sum, [code, count]) => {
    const category = CATEGORY_BY_CODE[code]
    if (!category || !count) return sum
    return sum + category.marks * count
  }, 0)
}

export function isValidCategoryCode(code) {
  return Object.prototype.hasOwnProperty.call(CATEGORY_BY_CODE, code)
}
