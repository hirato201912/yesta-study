'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LoggedInTeacher, Student, StudyRecord, StudyRecordWithStudent } from '@/types'
import { isSubjectAvailable, getUnitGroups } from '@/lib/curriculum'

const TODAY_JST = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })

const TIME_SLOTS = [
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
}

const SUBJECT_BTN: Record<string, string> = {
  英語: 'border-red-400 text-red-700 bg-red-50',
  数学: 'border-orange-400 text-orange-700 bg-orange-50',
  理科: 'border-green-400 text-green-700 bg-green-50',
  社会: 'border-blue-400 text-blue-700 bg-blue-50',
  国語: 'border-purple-400 text-purple-700 bg-purple-50',
}

const GRADE_COLORS: Record<string, string> = {
  '中1': 'bg-emerald-100 text-emerald-700',
  '中2': 'bg-sky-100 text-sky-700',
  '中3': 'bg-violet-100 text-violet-700',
}

const COMPREHENSION_LEVELS = [
  { value: 'わからない',      label: 'わからない',  btnClass: 'border-red-400 text-red-700 bg-red-50',      badgeClass: 'bg-red-100 text-red-700' },
  { value: 'なんとなくわかる', label: 'なんとなく',  btnClass: 'border-amber-400 text-amber-700 bg-amber-50', badgeClass: 'bg-amber-100 text-amber-700' },
  { value: 'よくわかった',    label: 'よくわかった', btnClass: 'border-green-400 text-green-700 bg-green-50',  badgeClass: 'bg-green-100 text-green-700' },
]

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

  function startAdd() {
    setEditId(null)
    setForm(makeEmptyForm())
    setIsAdding(true)
  }

  function startAddForStudent(studentId: string) {
    setEditId(null)
    setForm({ ...makeEmptyForm(), studentId })
    setIsAdding(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  function cancelForm() {
    setIsAdding(false)
    setEditId(null)
    setForm(makeEmptyForm())
    setSaveError('')
  }

  function setFormField(key: 'studentId' | 'subject' | 'comment', value: string) {
    setForm(prev => {
      const next = { ...prev, [key]: value }
      if (key === 'studentId' || key === 'subject') next.entries = [{ unit: '', comprehension: '' }]
      return next
    })
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
    const validEntries = form.entries.filter(e => e.unit)
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
        comprehension: entry.comprehension,
        teacher_comment: form.comment,
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
          comprehension: entry.comprehension,
          teacher_comment: form.comment,
          teacher_id: teacher.id,
        }))
      ))
    }
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    cancelForm()
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
        {TIME_SLOTS.map(slot => (
          <button
            key={slot.label}
            onClick={() => { setSelectedSlot(slot.label); cancelForm() }}
            className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl text-sm font-semibold transition-colors ${
              selectedSlot === slot.label
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <span className="text-base">{slot.label}</span>
            <span className={`text-xs mt-0.5 ${selectedSlot === slot.label ? 'text-indigo-200' : 'text-gray-400'}`}>{slot.time}</span>
          </button>
        ))}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {/* Add button */}
        {!showForm && (
          <button
            onClick={startAdd}
            className="w-full mb-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl py-3 text-base transition-colors flex items-center justify-center gap-2"
          >
            <span className="text-xl leading-none">＋</span>
            新規追加
          </button>
        )}

        {/* Add / Edit Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 p-4 mb-4">
            <h2 className="text-base font-bold text-indigo-700 mb-3">
              {editId ? '記録を編集' : '新規追加'}
            </h2>

            {/* Student */}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">生徒</label>
              <select
                value={form.studentId}
                onChange={e => setFormField('studentId', e.target.value)}
                disabled={!!editId}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="">-- 生徒を選択 --</option>
                {(['中1', '中2', '中3'] as const).map(grade => {
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

            {saveError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{saveError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
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
          </div>
        )}

        {/* Records */}
        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中…</div>
        ) : studentGroups.length === 0 && !showForm ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            この時間帯の記録はまだありません
          </div>
        ) : (
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
                      <button
                        onClick={() => startAddForStudent(group.student.id)}
                        className="text-xs text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1 hover:bg-indigo-50 transition-colors"
                      >
                        ＋ 単元を追加
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-gray-50">
                  {group.recs.map(rec => {
                    const isEditing = editId === rec.id
                    return (
                      <div
                        key={rec.id}
                        className={`px-4 py-3 transition-colors ${isEditing ? 'bg-indigo-50' : ''}`}
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
                            <div className="text-sm text-gray-800 font-medium leading-snug">{rec.unit}</div>
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
    </div>
  )
}
