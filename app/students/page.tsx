'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LoggedInTeacher, Student, StudyRecord } from '@/types'

const EIGO_LAB_SUBJECT = 'えいごスタートラボ'

const SUBJECT_COLORS: Record<string, string> = {
  英語: 'bg-red-100 text-red-700',
  数学: 'bg-orange-100 text-orange-700',
  理科: 'bg-green-100 text-green-700',
  社会: 'bg-blue-100 text-blue-700',
  国語: 'bg-purple-100 text-purple-700',
  [EIGO_LAB_SUBJECT]: 'bg-[#FFF0F7] text-[#A0266A]',
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

const COMPREHENSION_BADGE: Record<string, string> = {
  'わからない':      'bg-red-100 text-red-700',
  'なんとなくわかる': 'bg-amber-100 text-amber-700',
  'よくわかった':    'bg-green-100 text-green-700',
}

const SLOT_TIMES: Record<string, string> = {
  '①': '17:05〜',
  '②': '18:10〜',
  '③': '19:05〜',
  '④': '19:55〜',
  '⑤': '20:45〜',
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${m}月${day}日（${dow}）`
}

export default function StudentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [teacher, setTeacher] = useState<LoggedInTeacher | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<StudyRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [teacherMap, setTeacherMap] = useState<Record<string, string>>({})
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState<Student['grade'] | ''>('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('yesta_teacher')
    if (!stored) { router.replace('/'); return }
    setTeacher(JSON.parse(stored))
  }, [router])

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from('yesta_students')
      .select('id, name, grade')
      .eq('active', true)
      .order('grade')
      .order('name')
    setStudents((data ?? []) as Student[])
  }, [])

  useEffect(() => {
    if (!teacher) return
    fetchStudents()
    supabase
      .from('itoshima_teachers')
      .select('id, name')
      .then(({ data }) => {
        const map: Record<string, string> = {}
        for (const t of data ?? []) map[t.id] = t.name
        setTeacherMap(map)
      })
  }, [teacher, fetchStudents])

  useEffect(() => {
    if (students.length === 0) return
    const sid = new URLSearchParams(window.location.search).get('studentId')
    if (!sid) return
    const s = students.find(s => s.id === sid)
    if (s) setSelectedStudent(s)
    window.history.replaceState(null, '', '/students')
  }, [students])

  const fetchRecords = useCallback(async () => {
    if (!selectedStudent) { setRecords([]); return }
    setLoadingRecords(true)
    const { data } = await supabase
      .from('yesta_study_records')
      .select('*')
      .eq('student_id', selectedStudent.id)
      .order('date', { ascending: false })
      .order('time_slot', { ascending: true })
    setRecords((data ?? []) as StudyRecord[])
    setLoadingRecords(false)
  }, [selectedStudent])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  function openAddModal() {
    setEditingStudent(null)
    setNewName('')
    setNewGrade('')
    setAddError('')
    setConfirmDelete(false)
    setModalMode('add')
  }

  function openEditModal(s: Student) {
    setEditingStudent(s)
    setNewName(s.name)
    setNewGrade(s.grade)
    setAddError('')
    setConfirmDelete(false)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingStudent(null)
    setConfirmDelete(false)
  }

  async function handleSaveStudent() {
    const name = newName.trim()
    if (!name || !newGrade) return
    setAddSaving(true)
    setAddError('')
    if (modalMode === 'edit' && editingStudent) {
      const { data, error } = await supabase
        .from('yesta_students')
        .update({ name, grade: newGrade })
        .eq('id', editingStudent.id)
        .select('id, name, grade')
        .single()
      setAddSaving(false)
      if (error) { setAddError(error.message); return }
      await fetchStudents()
      if (data) setSelectedStudent(data as Student)
    } else {
      const { data, error } = await supabase
        .from('yesta_students')
        .insert({ name, grade: newGrade })
        .select('id, name, grade')
        .single()
      setAddSaving(false)
      if (error) { setAddError(error.message); return }
      await fetchStudents()
      if (data) setSelectedStudent(data as Student)
    }
    closeModal()
  }

  async function handleDeleteStudent() {
    if (!editingStudent) return
    setAddSaving(true)
    setAddError('')
    const { error } = await supabase
      .from('yesta_students')
      .update({ active: false })
      .eq('id', editingStudent.id)
    setAddSaving(false)
    if (error) { setAddError(error.message); return }
    await fetchStudents()
    setSelectedStudent(prev => (prev?.id === editingStudent.id ? null : prev))
    closeModal()
  }

  if (!teacher) return null

  const grades = ['中3', '中2', '中1', '小6', '小5', '小4', '小3', '小2', '小1'] as const

  // Group records by date
  const groupedByDate = records.reduce<Record<string, StudyRecord[]>>((acc, rec) => {
    if (!acc[rec.date]) acc[rec.date] = []
    acc[rec.date].push(rec)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a))

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

      {/* Student selector */}
      <div className="bg-white border-b px-4 py-3">
        <div className="flex justify-end mb-2">
          <button
            onClick={openAddModal}
            className="text-xs font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors"
          >
            ＋ 生徒を追加
          </button>
        </div>
        {grades.map(grade => {
          const gradeStudents = students.filter(s => s.grade === grade)
          if (gradeStudents.length === 0) return null
          return (
            <div key={grade} className="mb-2 last:mb-0">
              <div className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1.5 ${GRADE_COLORS[grade]}`}>
                {grade}
              </div>
              <div className="flex flex-wrap gap-2">
                {gradeStudents.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStudent(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedStudent?.id === s.id
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Records area */}
      <div className="px-4 py-4 max-w-lg mx-auto pb-24">
        {selectedStudent && (
          <div className="flex items-center gap-2 mb-4">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLORS[selectedStudent.grade] ?? 'bg-gray-100 text-gray-600'}`}>
              {selectedStudent.grade}
            </span>
            <span className="text-base font-bold text-gray-800">{selectedStudent.name}</span>
            <button
              onClick={() => openEditModal(selectedStudent)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"
            >
              ✏️ 編集
            </button>
            {records.length > 0 && (
              <span className="text-sm text-gray-400 ml-auto">{records.length}件</span>
            )}
          </div>
        )}
        {!selectedStudent ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            生徒を選択してください
          </div>
        ) : loadingRecords ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {selectedStudent.name} さんの記録はまだありません
          </div>
        ) : (
          <>
            {/* Records grouped by date */}
            <div className="flex flex-col gap-4">
              {sortedDates.map(date => (
                <div key={date}>
                  <div className="text-xs font-semibold text-gray-500 mb-2 px-1">
                    {formatDateDisplay(date)}
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupedByDate[date].map(rec => {
                      const isEigoRec = rec.subject === EIGO_LAB_SUBJECT
                      return (
                      <div key={rec.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-sm font-semibold text-gray-500">
                            {rec.time_slot}{SLOT_TIMES[rec.time_slot] ? `　${SLOT_TIMES[rec.time_slot]}` : ''}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SUBJECT_COLORS[rec.subject] ?? 'bg-gray-100 text-gray-600'}`}>
                            {rec.subject}
                          </span>
                        </div>
                        <div className={isEigoRec ? 'mb-1' : 'flex items-center gap-2 mb-1'}>
                          <div className={`text-sm font-medium text-gray-800 ${isEigoRec ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>{rec.unit}</div>
                          {rec.comprehension && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COMPREHENSION_BADGE[rec.comprehension] ?? 'bg-gray-100 text-gray-600'}`}>
                              {rec.comprehension}
                            </span>
                          )}
                        </div>
                        {rec.teacher_comment && (
                          <div className="text-sm text-gray-600 bg-indigo-50 rounded-lg px-3 py-1.5">
                            <span className="font-semibold text-indigo-600">コメント：</span>{rec.teacher_comment}
                          </div>
                        )}
                        {rec.teacher_id && teacherMap[rec.teacher_id] && (
                          <div className="text-xs text-gray-400 mt-1.5 text-right">
                            {teacherMap[rec.teacher_id]} 先生
                          </div>
                        )}
                      </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add / edit student modal */}
      {modalMode && (
        <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center bg-black/40 px-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5 mb-4 sm:mb-0">
            <div className="text-base font-bold text-gray-800 mb-4">
              {modalMode === 'edit' ? '生徒を編集' : '生徒を追加'}
            </div>

            <label className="block text-xs font-semibold text-gray-500 mb-1">名前</label>
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="例：山田 太郎"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />

            <label className="block text-xs font-semibold text-gray-500 mb-1.5">学年</label>
            <div className="flex flex-wrap gap-2 mb-4">
              {grades.map(g => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setNewGrade(g)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    newGrade === g
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

            {addError && <div className="text-xs text-red-600 mb-3">{addError}</div>}

            <div className="flex gap-2">
              <button
                onClick={closeModal}
                disabled={addSaving}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveStudent}
                disabled={addSaving || !newName.trim() || !newGrade}
                className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {addSaving ? '保存中…' : modalMode === 'edit' ? '保存する' : '追加する'}
              </button>
            </div>

            {modalMode === 'edit' && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                {!confirmDelete ? (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    disabled={addSaving}
                    className="w-full py-2 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    この生徒を退塾（一覧から非表示）
                  </button>
                ) : (
                  <div>
                    <div className="text-xs text-gray-600 mb-2 text-center">
                      {editingStudent?.name} さんを一覧から非表示にします。<br />
                      （学習履歴・ABCクエスト記録は残ります）
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmDelete(false)}
                        disabled={addSaving}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        やめる
                      </button>
                      <button
                        onClick={handleDeleteStudent}
                        disabled={addSaving}
                        className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
                      >
                        {addSaving ? '処理中…' : '非表示にする'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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
          <Link
            href="/abc-quest"
            className={`flex-1 py-2 flex flex-col items-center gap-0.5 transition-colors ${
              pathname === '/abc-quest' ? 'text-indigo-600 border-t-2 border-indigo-600' : 'text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">🔤</span>
            <span className="text-xs font-semibold">ABCクエスト</span>
          </Link>
        </div>
      </nav>
    </div>
  )
}
