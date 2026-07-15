// Mirrors the `question_categories` seed data in the backend schema —
// same codes (MCQ_1, SUB_1..SUB_20) so config payloads line up with the
// database's generation_question_selections rows one-to-one.
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

export const DIFFICULTIES = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
  { value: 'mixture', label: 'Mixture' },
]
