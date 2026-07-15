import { describe, it, expect } from 'vitest'
import { computeTotalMarks, isValidCategoryCode, CATEGORY_BY_CODE } from '../../src/shared/questionCategories.js'

describe('computeTotalMarks', () => {
  it('sums count * marks across categories', () => {
    const total = computeTotalMarks({ MCQ_1: 20, SUB_2: 10, SUB_5: 4, SUB_10: 2, SUB_20: 1 })
    expect(total).toBe(100)
  })

  it('ignores zero and missing counts', () => {
    expect(computeTotalMarks({ MCQ_1: 0, SUB_2: 5 })).toBe(10)
    expect(computeTotalMarks({})).toBe(0)
  })

  it('ignores unknown category codes rather than throwing', () => {
    expect(computeTotalMarks({ NOT_REAL: 5, MCQ_1: 3 })).toBe(3)
  })
})

describe('isValidCategoryCode', () => {
  it('accepts every seeded category code', () => {
    Object.keys(CATEGORY_BY_CODE).forEach((code) => {
      expect(isValidCategoryCode(code)).toBe(true)
    })
  })

  it('rejects an unknown code', () => {
    expect(isValidCategoryCode('NOPE')).toBe(false)
  })

  it('has exactly 11 categories, matching the DB seed data', () => {
    expect(Object.keys(CATEGORY_BY_CODE)).toHaveLength(11)
  })
})
