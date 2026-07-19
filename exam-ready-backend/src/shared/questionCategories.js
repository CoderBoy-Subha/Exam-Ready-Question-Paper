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

export const VALID_FILE_FORMATS_BY_SOURCE = {
  study_material: ['pdf', 'docx', 'image'],
  syllabus: ['pdf', 'docx', 'image', 'text'],
}

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
