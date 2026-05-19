import forestaRaw from '@/data/foresta_step.json'
import type { ForestaStepData } from '@/types'

const forestaData = forestaRaw as ForestaStepData

export type UnitOption = { value: string; label: string }
export type UnitGroup = { groupLabel: string; units: UnitOption[] }

export function isSubjectAvailable(subject: string): boolean {
  const entry = forestaData.subjects.find(s => s.subject === subject)
  return entry?.status !== 'coming_soon'
}

export function getUnitGroups(
  subject: string,
  studentGrade: '中1' | '中2' | '中3',
): UnitGroup[] {
  const grade = subject === '数学' || subject === '英語' ? studentGrade : '中学'
  const data = forestaData.subjects.find(
    s => s.subject === subject && s.grade === grade,
  )
  if (!data || data.status === 'coming_soon') return []

  const groups: UnitGroup[] = []

  if (data.pre_step && data.pre_step.length > 0) {
    groups.push({
      groupLabel: 'プレステップ',
      units: data.pre_step.map(u => ({
        value: u.title,
        label: u.step ? `${u.step} ${u.title}` : u.title,
      })),
    })
  }

  let prevChapter: string | null = null
  let currentGroup: UnitGroup | null = null

  for (const unit of data.main) {
    const isNewChapter =
      unit.chapter !== prevChapter || unit.chapter === 'まとめ'

    if (isNewChapter) {
      if (currentGroup) groups.push(currentGroup)
      prevChapter = unit.chapter
      const groupLabel =
        unit.chapter === '0'
          ? 'はじめに'
          : unit.chapter === 'まとめ'
          ? 'まとめ'
          : `第${unit.chapter}章`
      currentGroup = { groupLabel, units: [] }
    }

    currentGroup!.units.push({
      value: unit.title,
      label: unit.step
        ? `${unit.step} ${unit.title}${unit.difficulty ? ` (${unit.difficulty})` : ''}`
        : unit.title,
    })
  }
  if (currentGroup) groups.push(currentGroup)

  return groups
}
