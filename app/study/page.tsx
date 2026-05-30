'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LoggedInTeacher, Student, StudyRecord, StudyRecordWithStudent } from '@/types'
import { isSubjectAvailable, getUnitGroups } from '@/lib/curriculum'
import { EigoWordPicker, type EigoWord } from '@/components/EigoWordPicker'

const TODAY_JST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

const EIGO_LAB_SLOT = '①'
const EIGO_LAB_SUBJECT = 'えいごスタートラボ'
const EIGO_LAB_DRAFT_PREFIX = 'eigo_lab_draft'
const DRAFT_AUTOSAVE_MS = 1000

function draftKey(date: string, studentId: string): string {
  return `${EIGO_LAB_DRAFT_PREFIX}:${date}:${EIGO_LAB_SLOT}:${studentId}`
}

function loadDraftsForDate(date: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const prefix = `${EIGO_LAB_DRAFT_PREFIX}:${date}:${EIGO_LAB_SLOT}:`
  const result: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(prefix)) {
      const studentId = key.slice(prefix.length)
      const value = localStorage.getItem(key)
      if (value) result[studentId] = value
    }
  }
  return result
}

const TIME_SLOTS = [
  { label: '①', time: '17:05〜' },
  { label: '②', time: '18:10〜' },
  { label: '③', time: '19:05〜' },
  { label: '④', time: '19:55〜' },
  { label: '⑤', time: '20:45〜' },
]

const SUBJECTS = ['英語', '数学', '理科', '社会', '国語'] as const

const SUBJECT_COLORS: Record<string, string> = {
  英語: 'bg-red-100 text-red-700',
  数学: 'bg-orange-100 text-orange-700',
  理科: 'bg-green-100 text-green-700',
  社会: 'bg-blue-100 text-blue-700',
  国語: 'bg-purple-100 text-purple-700',
  [EIGO_LAB_SUBJECT]: 'bg-[#FFF0F7] text-[#A0266A]',
}

const SUBJECT_BTN: Record<string, string> = {
  英語: 'border-red-400 text-red-700 bg-red-50',
  数学: 'border-orange-400 text-orange-700 bg-orange-50',
  理科: 'border-green-400 text-green-700 bg-green-50',
  社会: 'border-blue-400 text-blue-700 bg-blue-50',
  国語: 'border-purple-400 text-purple-700 bg-purple-50',
}

const GRADE_COLORS: Record<string, string> = {
  '小1': 'bg-[#FFF0F7] text-[#A0266A]',
  '小2': 'bg-[#FFF0F7] text-[#A0266A]',
  '小3': 'bg-[#FFF0F7] text-[#A0266A]',
  '小4': 'bg-[#FFF0F7] text-[#A0266A]',
  '小5': 'bg-[#FFF0F7] text-[#A0266A]',
  '小6': 'bg-[#FFF0F7] text-[#A0266A]',
  '中1': 'bg-emerald-100 text-emerald-700',
  '中2': 'bg-sky-100 text-sky-700',
  '中3': 'bg-violet-100 text-violet-700',
}

const ELEMENTARY_GRADES = ['小1', '小2', '小3', '小4', '小5', '小6'] as const
const JUNIOR_GRADES = ['中1', '中2', '中3'] as const

const COMPREHENSION_LEVELS = [
  { value: 'わからない',      label: 'わからない',  btnClass: 'border-red-400 text-red-700 bg-red-50',      badgeClass: 'bg-red-100 text-red-700' },
  { value: 'なんとなくわかる', label: 'なんとなく',  btnClass: 'border-amber-400 text-amber-700 bg-amber-50', badgeClass: 'bg-amber-100 text-amber-700' },
  { value: 'よくわかった',    label: 'よくわかった', btnClass: 'border-green-400 text-green-700 bg-green-50',  badgeClass: 'bg-green-100 text-green-700' },
]

const EIGO_LAB_HEADINGS = [
  '【今日の活動】',
  '【できたこと】',
  '【成長ポイント】',
  '【次回の目標】',
]

const EIGO_LAB_PHRASES = [
  'アルファベットが書けた',
  '発音がきれいになった',
  '新しい単語を覚えた',
  '英語で会話に挑戦',
  '歌・チャンツを楽しんだ',
  '積極的に発表できた',
  '集中して取り組めた',
  '前回より自信を持って取り組んでいた',
  '笑顔で楽しそうだった',
  '質問を自分から投げかけた',
]

const EIGO_LAB_PLACEHOLDER = `今日の様子や成長ポイントを、できるだけ詳しく書いてあげてください。
保護者の方の安心と、お子さんの自信に繋がります。

ーーー 記入例 ーーー
【今日の活動】
・フォニックスでa〜eの音を練習
・絵カードを使った単語ゲーム
・自己紹介の練習

【できたこと】
・"a"の音を意識して発音できるようになった
・"apple"を聞いて意味が分かるようになった

【成長ポイント】
・前回より大きな声で発音できた
・初めて自分から手を挙げて答えてくれた

【次回の目標】
・f〜jの音に進む
・"My name is..."が言えるようにする`

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('sv-SE')
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${m}月${day}日（${dow}）`
}

function appendLine(current: string, line: string): string {
  if (!current) return line + '\n'
  if (current.endsWith('\n')) return current + line + '\n'
  return current + '\n' + line + '\n'
}

type UnitEntry = { unit: string; comprehension: string }

type FormState = {
  studentId: string
  subject: string
  entries: UnitEntry[]
  comment: string
}

const makeEmptyForm = (): FormState => ({
  studentId: '',
  subject: '',
  entries: [{ unit: '', comprehension: '' }],
  comment: '',
})

export default function StudyPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [teacher, setTeacher] = useState<LoggedInTeacher | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [records, setRecords] = useState<StudyRecordWithStudent[]>([])
  const [selectedDate, setSelectedDate] = useState(TODAY_JST)
  const [selectedSlot, setSelectedSlot] = useState('②')
  const [loading, setLoading] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [form, setForm] = useState<FormState>(makeEmptyForm())
  const [pickerOpen, setPickerOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('yesta_teacher')
    if (!stored) { router.replace('/'); return }
    setTeacher(JSON.parse(stored))
  }, [router])

  useEffect(() => {
    if (!teacher) return
    supabase
      .from('yesta_students')
      .select('id, name, grade')
      .order('grade')
      .order('name')
      .then(({ data }) => setStudents((data ?? []) as Student[]))
    supabase
      .from('itoshima_teachers')
      .select('id, name')
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const t of data ?? []) map[t.id] = t.name
        setTeacherMap(map)
      })
  }, [teacher])

  const fetchRecords = useCallback(async () => {
    if (!teacher) return
    setLoading(true)
    const { data } = await supabase
      .from('yesta_study_records')
      .select('*')
      .eq('date', selectedDate)
      .eq('time_slot', selectedSlot)
      .order('created_at', { ascending: true })
    const joined: StudyRecordWithStudent[] = ((data ?? []) as StudyRecord[]).map(rec => ({
      ...rec,
      student: students.find(s => s.id === rec.student_id) ?? { id: rec.student_id, name: '不明', grade: '中1' as const },
    }))
    setRecords(joined)
    setLoading(false)
  }, [teacher, selectedDate, selectedSlot, students])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const isEigoLab = selectedSlot === EIGO_LAB_SLOT

  useEffect(() => {
    setDrafts(loadDraftsForDate(selectedDate))
  }, [selectedDate])

  const currentDraftStudentId = isEigoLab && isAdding && !editId ? form.studentId : ''
  const currentDraftContent = form.entries[0]?.unit ?? ''

  useEffect(() => {
    if (!currentDraftStudentId) return
    const handle = setTimeout(() => {
      const key = draftKey(selectedDate, currentDraftStudentId)
      if (currentDraftContent.trim()) {
        localStorage.setItem(key, currentDraftContent)
        setDrafts(prev => ({ ...prev, [currentDraftStudentId]: currentDraftContent }))
        setDraftSavedAt(Date.now())
      } else {
        localStorage.removeItem(key)
        setDrafts(prev => {
          if (!(currentDraftStudentId in prev)) return prev
          const next = { ...prev }
          delete next[currentDraftStudentId]
          return next
        })
        setDraftSavedAt(null)
      }
    }, DRAFT_AUTOSAVE_MS)
    return () => clearTimeout(handle)
  }, [currentDraftStudentId, currentDraftContent, selectedDate])

  useEffect(() => {
    if (!currentDraftStudentId) return
    const handler = () => {
      const key = draftKey(selectedDate, currentDraftStudentId)
      if (currentDraftContent.trim()) {
        localStorage.setItem(key, currentDraftContent)
      } else {
        localStorage.removeItem(key)
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [currentDraftStudentId, currentDraftContent, selectedDate])

  function startAdd() {
    setEditId(null)
    setForm({ ...makeEmptyForm(), subject: isEigoLab ? EIGO_LAB_SUBJECT : '' })
    setIsAdding(true)
    setDraftSavedAt(null)
  }

  function startAddForStudent(studentId: string) {
    setEditId(null)
    const draft = isEigoLab ? drafts[studentId] : undefined
    setForm({
      ...makeEmptyForm(),
      studentId,
      subject: isEigoLab ? EIGO_LAB_SUBJECT : '',
      entries: draft ? [{ unit: draft, comprehension: '' }] : [{ unit: '', comprehension: '' }],
    })
    setIsAdding(true)
    setDraftSavedAt(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleSaveDraftAndClose() {
    flushCurrentDraft()
    closeFormState()
  }

  function handleDiscardDraft() {
    if (!isEigoLab || !form.studentId) return
    if (!confirm('この下書きを破棄しますか？')) return
    const key = draftKey(selectedDate, form.studentId)
    localStorage.removeItem(key)
    setDrafts(prev => {
      const next = { ...prev }
      delete next[form.studentId]
      return next
    })
    closeFormState()
  }

  function startEdit(rec: StudyRecordWithStudent) {
    setIsAdding(false)
    setEditId(rec.id)
    setForm({
      studentId: rec.student_id,
      subject: rec.subject,
      entries: [{ unit: rec.unit, comprehension: rec.comprehension }],
      comment: rec.teacher_comment,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function flushCurrentDraft() {
    if (!isEigoLab || editId || !form.studentId) return
    const content = form.entries[0]?.unit ?? ''
    const studentId = form.studentId
    const key = draftKey(selectedDate, studentId)
    if (content.trim()) {
      localStorage.setItem(key, content)
      setDrafts(prev => ({ ...prev, [studentId]: content }))
    } else {
      localStorage.removeItem(key)
      setDrafts(prev => {
        if (!(studentId in prev)) return prev
        const next = { ...prev }
        delete next[studentId]
        return next
      })
    }
  }

  function closeFormState() {
    setIsAdding(false)
    setEditId(null)
    setForm(makeEmptyForm())
    setSaveError('')
  }

  function cancelForm() {
    flushCurrentDraft()
    closeFormState()
  }

  function setFormField(key: 'studentId' | 'subject' | 'comment', value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'studentId' || key === 'subject') {
        if (isEigoLab && key === 'studentId' && !editId) {
          const draft = drafts[value]
          next.entries = draft ? [{ unit: draft, comprehension: '' }] : [{ unit: '', comprehension: '' }]
        } else {
          next.entries = [{ unit: '', comprehension: '' }]
        }
      }
      return next
    })
    if (key === 'studentId') setDraftSavedAt(null)
  }

  function addEntry() {
    setForm(prev => ({ ...prev, entries: [...prev.entries, { unit: '', comprehension: '' }] }))
  }

  function removeEntry(idx: number) {
    setForm(prev => ({ ...prev, entries: prev.entries.filter((_, i) => i !== idx) }))
  }

  function setEntryField(idx: number, key: keyof UnitEntry, value: string) {
    setForm(prev => {
      const entries = [...prev.entries]
      entries[idx] = { ...entries[idx], [key]: value }
      return { ...prev, entries }
    })
  }

  const selectedStudent = students.find(s => s.id === form.studentId)
  const unitGroups = selectedStudent && form.subject
    ? getUnitGroups(form.subject, selectedStudent.grade)
    : []

  async function handleSave() {
    if (!teacher || !form.studentId || !form.subject) return
    const validEntries = form.entries.filter(e => e.unit.trim())
    if (validEntries.length === 0) return
    setSaving(true)
    setSaveError('')
    let error
    if (editId) {
      const entry = form.entries[0]
      ;({ error } = await supabase.from('yesta_study_records').update({
        date: selectedDate,
        time_slot: selectedSlot,
        student_id: form.studentId,
        subject: form.subject,
        unit: entry.unit,
        comprehension: isEigoLab ? '' : entry.comprehension,
        teacher_comment: isEigoLab ? '' : form.comment,
        teacher_id: teacher.id,
      }).eq('id', editId))
    } else {
      ;({ error } = await supabase.from('yesta_study_records').insert(
        validEntries.map(entry => ({
          date: selectedDate,
          time_slot: selectedSlot,
          student_id: form.studentId,
          subject: form.subject,
          unit: entry.unit,
          comprehension: isEigoLab ? '' : entry.comprehension,
          teacher_comment: isEigoLab ? '' : form.comment,
          teacher_id: teacher.id,
        }))
      ))
    }
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    if (isEigoLab && !editId && form.studentId) {
      const key = draftKey(selectedDate, form.studentId)
      localStorage.removeItem(key)
      setDrafts(prev => {
        const next = { ...prev }
        delete next[form.studentId]
        return next
      })
    }
    closeFormState()
    fetchRecords()
  }

  async function handleDelete(id: string, studentName: string) {
    if (!confirm(`${studentName} の記録を削除しますか？`)) return
    setRecords(prev => prev.filter(r => r.id !== id))
    await supabase.from('yesta_study_records').delete().eq('id', id)
  }

  if (!teacher) return null

  const showForm = isAdding || editId !== null
  const comprehensionBadge = COMPREHENSION_LEVELS.reduce<Record<string, string>>((acc, l) => {
    acc[l.value] = l.badgeClass
    return acc
  }, {})

  const studentGroups = records.reduce<Array<{ student: Student; recs: StudyRecordWithStudent[] }>>(
    (acc, rec) => {
      const existing = acc.find(g => g.student.id === rec.student_id)
      if (existing) existing.recs.push(rec)
      else acc.push({ student: rec.student, recs: [rec] })
      return acc
    },
    [],
  )

  const canSave = !saving && !!form.studentId && !!form.subject && form.entries.some(e => e.unit)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold leading-tight">イエスタ 自習管理</div>
          <div className="text-xs text-indigo-200">{teacher.name} 先生</div>
        </div>
        <button
          onClick={() => { localStorage.removeItem('yesta_teacher'); router.replace('/') }}
          className="text-xs bg-indigo-700 hover:bg-indigo-800 px-3 py-1.5 rounded-lg transition-colors"
        >
          ログアウト
        </button>
      </header>

      {/* Date picker */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, -1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl"
        >
          ‹
        </button>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-gray-800">{formatDateDisplay(selectedDate)}</span>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="sr-only"
            id="date-input"
          />
          <label htmlFor="date-input" className="text-xs text-indigo-600 border border-indigo-300 rounded px-2 py-0.5 cursor-pointer hover:bg-indigo-50">
            変更
          </label>
        </div>
        <button
          onClick={() => setSelectedDate(addDays(selectedDate, 1))}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 text-xl"
        >
          ›
        </button>
      </div>

      {/* Slot tabs */}
      <div className="bg-white border-b px-2 flex gap-1 py-2">
        {TIME_SLOTS.map(slot => {
          const isEigoTab = slot.label === EIGO_LAB_SLOT
          const isSelected = selectedSlot === slot.label
          const draftCount = isEigoTab ? Object.keys(drafts).length : 0
          const tabClass = isEigoTab
            ? isSelected
              ? 'bg-[#D94F8A] text-white shadow-sm'
              : 'bg-[#FFF0F7] text-[#A0266A] border border-[#D94F8A] hover:bg-[#FFE0EF]'
            : isSelected
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          const timeClass = isEigoTab
            ? isSelected ? 'text-pink-100' : 'text-[#A0266A]/70'
            : isSelected ? 'text-indigo-200' : 'text-gray-400'
          return (
            <button
              key={slot.label}
              onClick={() => { setSelectedSlot(slot.label); cancelForm() }}
              className={`relative flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-sm font-semibold transition-colors ${tabClass}`}
            >
              <span className="text-base">{isEigoTab ? `${slot.label} えいご` : slot.label}</span>
              <span className={`text-xs mt-0.5 ${timeClass}`}>{slot.time}</span>
              {draftCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#A0266A] text-white text-[10px] font-bold flex items-center justify-center shadow">
                  📝{draftCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {/* Add button */}
        {!showForm && (
          <button
            onClick={startAdd}
            className={`w-full mb-4 text-white font-semibold rounded-xl py-3 text-base transition-colors flex items-center justify-center gap-2 ${
              isEigoLab
                ? 'bg-[#D94F8A] hover:bg-[#A0266A]'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <span className="text-xl leading-none">＋</span>
            {isEigoLab ? 'えいごスタートラボ 新規追加' : '新規追加'}
          </button>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className={`bg-white rounded-2xl shadow-sm border p-4 mb-4 ${
            isEigoLab ? 'border-[#D94F8A]/40 ring-1 ring-[#D94F8A]/20' : 'border-indigo-100'
          }`}>
            <h2 className={`text-base font-bold mb-3 ${isEigoLab ? 'text-[#A0266A]' : 'text-indigo-700'}`}>
              {editId
                ? isEigoLab ? 'えいごスタートラボ 記録を編集' : '記録を編集'
                : isEigoLab ? 'えいごスタートラボ 新規追加' : '新規追加'}
            </h2>

            {/* Student */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">生徒</label>
              <select
                value={form.studentId}
                onChange={e => setFormField('studentId', e.target.value)}
                disabled={!!editId}
                className={`w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 bg-white disabled:bg-gray-50 disabled:text-gray-500 ${
                  isEigoLab ? 'focus:ring-[#D94F8A]' : 'focus:ring-indigo-400'
                }`}
              >
                <option value="">-- 生徒を選択 --</option>
                {(isEigoLab ? ELEMENTARY_GRADES : JUNIOR_GRADES).map(grade => {
                  const gradeStudents = students.filter(s => s.grade === grade)
                  if (gradeStudents.length === 0) return null
                  return (
                    <optgroup key={grade} label={grade}>
                      {gradeStudents.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>

            {isEigoLab ? (
              <>
                {/* Locked subject indicator */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">講座</label>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-[#D94F8A] text-white">
                    {EIGO_LAB_SUBJECT}
                  </div>
                </div>

                {/* Quick-insert headings */}
                <div className="mb-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    見出しを挿入（タップで追加）
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EIGO_LAB_HEADINGS.map(h => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setEntryField(0, 'unit', appendLine(form.entries[0].unit, h))}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#D94F8A]/60 text-[#A0266A] bg-white hover:bg-[#FFF0F7] transition-colors"
                      >
                        {h}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick-insert phrases */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    よく使うフレーズ（タップで追加）
                  </label>
                  <div className="flex gap-1.5 flex-wrap">
                    {EIGO_LAB_PHRASES.map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setEntryField(0, 'unit', appendLine(form.entries[0].unit, `・${p}`))}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border border-[#FFD1E4] text-[#A0266A] bg-[#FFF0F7] hover:bg-[#FFE0EF] transition-colors"
                      >
                        ＋ {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Word picker launch */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    覚えた単語を素早く入力
                  </label>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-[#D94F8A]/60 text-[#A0266A] bg-[#FFF0F7] hover:bg-[#FFE0EF] font-semibold text-sm transition-colors"
                  >
                    <span className="text-base">📖</span>
                    覚えた単語を選ぶ（カテゴリ・検索つき）
                  </button>
                </div>

                {/* Free-text content */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    今日の様子・成長記録
                  </label>
                  <textarea
                    value={form.entries[0].unit}
                    onChange={e => setEntryField(0, 'unit', e.target.value)}
                    placeholder={EIGO_LAB_PLACEHOLDER}
                    rows={14}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F8A] resize-y leading-relaxed placeholder:text-gray-400 placeholder:leading-relaxed bg-[#FFFCFD]"
                  />
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-gray-500">
                      できるだけ具体的に書いてあげてください。
                    </p>
                    {!editId && form.studentId && (
                      <span className="text-xs text-[#A0266A] font-medium shrink-0 ml-2">
                        {draftSavedAt
                          ? '💾 下書き保存済'
                          : form.entries[0].unit.trim()
                            ? '入力中…'
                            : ''}
                      </span>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Subject */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">科目</label>
                  <div className="flex gap-2 flex-wrap">
                    {SUBJECTS.map(sub => {
                      const available = isSubjectAvailable(sub)
                      const selected = form.subject === sub
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => !editId && available && setFormField('subject', sub)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                            !available
                              ? 'border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed'
                              : editId
                              ? selected
                                ? `${SUBJECT_BTN[sub]} border-2 opacity-70 cursor-default`
                                : 'border-gray-200 text-gray-300 bg-gray-50 cursor-default'
                              : selected
                              ? `${SUBJECT_BTN[sub]} border-2 shadow-sm`
                              : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'
                          }`}
                        >
                          {sub}
                          {!available && <span className="ml-1 text-xs text-gray-400">準備中</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Units */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">単元</label>
                  <div className="flex flex-col gap-2">
                    {form.entries.map((entry, idx) => (
                      <div key={idx} className="border border-gray-200 rounded-xl p-3 relative">
                        {form.entries.length > 1 && !editId && (
                          <button
                            type="button"
                            onClick={() => removeEntry(idx)}
                            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 text-base leading-none"
                          >
                            ×
                          </button>
                        )}
                        {unitGroups.length > 0 ? (
                          <select
                            value={entry.unit}
                            onChange={e => setEntryField(idx, 'unit', e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white mb-2"
                          >
                            <option value="">-- 単元を選択 --</option>
                            {unitGroups.map(group => (
                              <optgroup key={group.groupLabel} label={group.groupLabel}>
                                {group.units.map(u => (
                                  <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                              </optgroup>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={entry.unit}
                            onChange={e => setEntryField(idx, 'unit', e.target.value)}
                            placeholder="単元名を入力"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-2"
                          />
                        )}
                        <div className="flex gap-1.5">
                          {COMPREHENSION_LEVELS.map(level => (
                            <button
                              key={level.value}
                              type="button"
                              onClick={() => setEntryField(idx, 'comprehension', level.value)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                                entry.comprehension === level.value
                                  ? `${level.btnClass} border-2 shadow-sm`
                                  : 'border-gray-200 text-gray-500 bg-white hover:bg-gray-50'
                              }`}
                            >
                              {level.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {!editId && (
                    <button
                      type="button"
                      onClick={addEntry}
                      disabled={!form.subject || !form.studentId}
                      className="mt-2 w-full border border-dashed border-indigo-300 text-indigo-500 hover:bg-indigo-50 disabled:border-gray-200 disabled:text-gray-300 disabled:cursor-not-allowed rounded-xl py-2 text-sm font-medium transition-colors"
                    >
                      ＋ 単元を追加
                    </button>
                  )}
                </div>

                {/* Comment */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">コメント・申し送り</label>
                  <textarea
                    value={form.comment}
                    onChange={e => setFormField('comment', e.target.value)}
                    placeholder="コメント・申し送りを入力"
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                  />
                </div>
              </>
            )}

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{saveError}</p>
            )}
            {isEigoLab && !editId ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className="flex-[2] bg-[#D94F8A] hover:bg-[#A0266A] disabled:bg-[#F5B8D2] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
                  >
                    {saving ? '保存中…' : '✓ 保存して完了'}
                  </button>
                  <button
                    onClick={handleSaveDraftAndClose}
                    disabled={!form.studentId}
                    className="flex-1 bg-white hover:bg-[#FFF0F7] disabled:bg-gray-50 disabled:text-gray-300 text-[#A0266A] border border-[#D94F8A] font-semibold rounded-xl py-2.5 text-sm transition-colors"
                  >
                    📝 途中保存
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={cancelForm}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl py-2 text-xs transition-colors"
                  >
                    閉じる（下書きは自動保存されています）
                  </button>
                  {form.studentId && drafts[form.studentId] && (
                    <button
                      onClick={handleDiscardDraft}
                      className="bg-white hover:bg-red-50 text-red-500 border border-red-200 font-semibold rounded-xl py-2 px-3 text-xs transition-colors"
                    >
                      🗑️ 下書き破棄
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`flex-1 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors ${
                    isEigoLab
                      ? 'bg-[#D94F8A] hover:bg-[#A0266A] disabled:bg-[#F5B8D2]'
                      : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200'
                  }`}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button
                  onClick={cancelForm}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl py-2.5 text-sm transition-colors"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        )}

        {/* Drafts section (eigo lab only) */}
        {isEigoLab && !showForm && Object.keys(drafts).length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-[#A0266A] mb-2 px-1">
              📝 下書き中の生徒（{Object.keys(drafts).length}人）— タップして続きを入力
            </div>
            <div className="flex flex-col gap-2">
              {Object.entries(drafts).map(([studentId, content]) => {
                const student = students.find(s => s.id === studentId)
                if (!student) return null
                const preview = content.replace(/\s+/g, ' ').trim().slice(0, 80)
                return (
                  <button
                    key={studentId}
                    onClick={() => startAddForStudent(studentId)}
                    className="bg-white rounded-xl border border-[#D94F8A]/40 shadow-sm px-4 py-3 text-left hover:bg-[#FFF8FB] transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLORS[student.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                        {student.grade}
                      </span>
                      <span className="text-base font-bold text-gray-800">{student.name}</span>
                      <span className="ml-auto text-xs bg-[#FFF0F7] text-[#A0266A] font-semibold px-2 py-0.5 rounded-full">
                        📝 下書き
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 line-clamp-2">
                      {preview}{content.length > 80 ? '…' : ''}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Records */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中…</div>
        ) : studentGroups.length === 0 && Object.keys(drafts).length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            この時間帯の記録はまだありません
          </div>
        ) : studentGroups.length === 0 ? null : (
          <div className="flex flex-col gap-3">
            {studentGroups.map(group => (
              <div key={group.student.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLORS[group.student.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                      {group.student.grade}
                    </span>
                    <span className="text-base font-bold text-gray-800">{group.student.name}</span>
                  </div>
                  {!showForm && (
                    <div className="flex gap-1.5">
                      <Link
                        href={`/students?studentId=${group.student.id}`}
                        className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-50 transition-colors"
                      >
                        履歴 →
                      </Link>
                      {!isEigoLab && (
                        <button
                          onClick={() => startAddForStudent(group.student.id)}
                          className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50 transition-colors"
                        >
                          ＋ 単元を追加
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {group.recs.map(rec => {
                    const isEditing = editId === rec.id
                    const isEigoRec = rec.subject === EIGO_LAB_SUBJECT
                    return (
                      <div
                        key={rec.id}
                        className={`px-4 py-3 transition-colors ${isEditing ? (isEigoRec ? 'bg-[#FFF0F7]' : 'bg-indigo-50') : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[rec.subject] ?? 'bg-gray-100 text-gray-600'}`}>
                                {rec.subject}
                              </span>
                              {rec.comprehension && (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${comprehensionBadge[rec.comprehension] ?? 'bg-gray-100 text-gray-600'}`}>
                                  {rec.comprehension}
                                </span>
                              )}
                            </div>
                            <div className={`text-sm text-gray-800 font-medium ${isEigoRec ? 'whitespace-pre-wrap leading-relaxed' : 'leading-snug'}`}>{rec.unit}</div>
                            {rec.teacher_comment && (
                              <div className="text-xs text-gray-500 mt-1.5 bg-indigo-50 rounded-lg px-2.5 py-1.5">
                                {rec.teacher_comment}
                              </div>
                            )}
                            {rec.teacher_id && teacherMap[rec.teacher_id] && (
                              <div className="text-xs text-gray-400 mt-1">
                                {teacherMap[rec.teacher_id]} 先生
                              </div>
                            )}
                          </div>
                          {!showForm && (
                            <div className="flex gap-1 shrink-0 mt-0.5">
                              <button
                                onClick={() => startEdit(rec)}
                                className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50 transition-colors"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDelete(rec.id, rec.student.name)}
                                className="text-xs text-red-500 border border-red-200 rounded-lg px-2.5 py-1 hover:bg-red-50 transition-colors"
                              >
                                削除
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-10">
        <div className="flex max-w-lg mx-auto">
          <Link
            href="/study"
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
              pathname === '/study' ? 'text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">📝</span>
            <span className="text-xs font-semibold">今日の入力</span>
          </Link>
          <Link
            href="/students"
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
              pathname === '/students' ? 'text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">📅</span>
            <span className="text-xs font-semibold">生徒の履歴</span>
          </Link>
        </div>
      </nav>

      <EigoWordPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onInsert={(words: EigoWord[]) => {
          const block = ['【今日覚えた単語】', ...words.map(w => `・${w.en}（${w.ja}）`)].join('\n')
          setEntryField(0, 'unit', appendLine(form.entries[0].unit, block))
        }}
      />
    </div>
  )
}
