import PDFDocument from 'pdfkit'
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'

function letterFor(index) {
  return String.fromCharCode(97 + index) // a, b, c, d...
}

// PDF (pdfkit)
export function renderPdfBuffer(paper, meta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(20).text('Exam Paper', { align: 'center' })
    doc
      .fontSize(11)
      .fillColor('#444')
      .text(`Total Marks: ${meta.totalMarks}    Difficulty: ${meta.difficulty}`, { align: 'center' })
      .fillColor('#000')
    doc.moveDown(1.5)

    paper.sections.forEach((section) => {
      doc.fontSize(14).font('Helvetica-Bold').text(section.title, { underline: true })
      doc.font('Helvetica')
      if (section.instructions) {
        doc.fontSize(10).font('Helvetica-Oblique').text(section.instructions)
        doc.font('Helvetica')
      }
      doc.moveDown(0.5)

      section.questions.forEach((q, idx) => {
        doc.fontSize(11).text(`${idx + 1}. ${q.prompt}   [${q.marks} mark${q.marks > 1 ? 's' : ''}]`)
        if (q.type === 'mcq' && Array.isArray(q.options)) {
          q.options.forEach((opt, i) => {
            doc.fontSize(10).text(`     ${letterFor(i)}) ${opt}`)
          })
        }
        doc.moveDown(0.4)
      })
      doc.moveDown(1)
    })

    doc.addPage()
    doc.fontSize(16).font('Helvetica-Bold').text('Answer Key', { underline: true })
    doc.font('Helvetica')
    doc.moveDown(0.5)
    paper.sections.forEach((section) => {
      section.questions.forEach((q, idx) => {
        doc.fontSize(10).text(`${section.title} — Q${idx + 1}: ${q.answer}`)
      })
    })

    doc.end()
  })
}

// Word (docx)
export async function renderDocxBuffer(paper, meta) {
  const children = [
    new Paragraph({ text: 'Exam Paper', heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `Total Marks: ${meta.totalMarks}    Difficulty: ${meta.difficulty}`, italics: true }),
      ],
    }),
  ]

  paper.sections.forEach((section) => {
    children.push(
      new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 100 } }),
    )
    if (section.instructions) {
      children.push(new Paragraph({ children: [new TextRun({ text: section.instructions, italics: true })] }))
    }

    section.questions.forEach((q, idx) => {
      children.push(
        new Paragraph({
          spacing: { before: 160 },
          children: [
            new TextRun({ text: `${idx + 1}. `, bold: true }),
            new TextRun({ text: q.prompt }),
            new TextRun({ text: `   [${q.marks} mark${q.marks > 1 ? 's' : ''}]`, italics: true }),
          ],
        }),
      )
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        q.options.forEach((opt, i) => {
          children.push(new Paragraph({ text: `${letterFor(i)}) ${opt}`, indent: { left: 500 } }))
        })
      }
    })
  })

  children.push(
    new Paragraph({ text: 'Answer Key', heading: HeadingLevel.HEADING_1, pageBreakBefore: true }),
  )
  paper.sections.forEach((section) => {
    section.questions.forEach((q, idx) => {
      children.push(new Paragraph({ text: `${section.title} — Q${idx + 1}: ${q.answer}` }))
    })
  })

  const doc = new Document({ sections: [{ children }] })
  return Packer.toBuffer(doc)
}

export function buildExportMeta(paper, config) {
  const totalMarks = paper.sections.reduce(
    (sum, s) => sum + s.questions.reduce((sSum, q) => sSum + (q.marks || 0), 0),
    0,
  )
  const questionCount = paper.sections.reduce((sum, s) => sum + s.questions.length, 0)
  return { totalMarks, questionCount, difficulty: config.difficulty }
}
