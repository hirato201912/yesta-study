'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { LoggedInTeacher, Student, AbcQuestRecord } from '@/types'

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

const MODE_LABELS: Record<AbcQuestRecord['mode'], { label: string; badge: string }> = {
  matching: { label: 'ペアさがし', badge: 'bg-green-100 text-green-700' },
  quiz: { label: 'クイズ', badge: 'bg-pink-100 text-pink-700' },
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

type LetterStat = { correct: number; wrong: number }

// 文字ごとの定着度: 緑=定着 / 黄=練習中 / 赤=要復習 / 灰=未着手
function letterCellStyle(stat: LetterStat | undefined): string {
  if (!stat || stat.correct + stat.wrong === 0) return 'bg-gray-100 text-gray-300'
  const rate = stat.correct / (stat.correct + stat.wrong)
  if (rate >= 0.8) return 'bg-green-100 text-green-700'
  if (rate >= 0.5) return 'bg-amber-100 text-amber-700'
  return 'bg-red-100 text-red-700'
}

function formatDateDisplay(d: Date): string {
  const m = d.getMonth() + 1
  const day = d.getDate()
  const dow = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${m}月${day}日（${dow}）`
}

function formatTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function AbcQuestPage() {
  const router = useRouter()
  const pathname = usePathname()
  const [teacher, setTeacher] = useState<LoggedInTeacher | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [records, setRecords] = useState<AbcQuestRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

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
  }, [teacher])

  const fetchRecords = useCallback(async () => {
    if (!selectedStudent) { setRecords([]); return }
    setLoadingRecords(true)
    const { data } = await supabase
      .from('abc_quest_records')
      .select('*')
      .eq('student_id', selectedStudent.id)
      .order('played_at', { ascending: false })
      .limit(200)
    setRecords((data ?? []) as AbcQuestRecord[])
    setLoadingRecords(false)
  }, [selectedStudent])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  if (!teacher) return null

  const grades = ['中3', '中2', '中1', '小6', '小5', '小4', '小3', '小2', '小1'] as const

  // 集計
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const playsThisWeek = records.filter(r => new Date(r.played_at) >= weekAgo).length
  const bestLevel = records.reduce((max, r) => Math.max(max, r.level ?? 0), 0)
  const bestStars = records.reduce((max, r) => Math.max(max, r.stars ?? 0), 0)

  // 文字別の正解/ミス集計
  const letterStats: Record<string, LetterStat> = {}
  for (const rec of records) {
    for (const l of rec.correct_letters ?? []) {
      letterStats[l] = letterStats[l] ?? { correct: 0, wrong: 0 }
      letterStats[l].correct++
    }
    for (const l of rec.wrong_letters ?? []) {
      letterStats[l] = letterStats[l] ?? { correct: 0, wrong: 0 }
      letterStats[l].wrong++
    }
  }
  const weakLetters = ALPHABET.filter(l => {
    const s = letterStats[l]
    return s && s.correct + s.wrong > 0 && s.correct / (s.correct + s.wrong) < 0.5
  })

  // 日付ごとにグループ化
  const groupedByDate = records.reduce<Record<string, AbcQuestRecord[]>>((acc, rec) => {
    const key = new Date(rec.played_at).toDateString()
    if (!acc[key]) acc[key] = []
    acc[key].push(rec)
    return acc
  }, {})
  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold leading-tight">ABCクエスト 取り組み状況</div>
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
        {!selectedStudent ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            生徒を選択してください
          </div>
        ) : loadingRecords ? (
          <div className="text-center py-12 text-gray-400 text-sm">読み込み中…</div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            {selectedStudent.name} さんのプレイ記録はまだありません
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${GRADE_COLORS[selectedStudent.grade] ?? 'bg-gray-100 text-gray-600'}`}>
                {selectedStudent.grade}
              </span>
              <span className="text-base font-bold text-gray-800">{selectedStudent.name}</span>
              <span className="text-sm text-gray-400 ml-auto">{records.length}件</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 text-center">
                <div className="text-xl font-bold text-indigo-600">{playsThisWeek}</div>
                <div className="text-xs text-gray-500">今週のプレイ</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 text-center">
                <div className="text-xl font-bold text-green-600">Lv.{bestLevel}</div>
                <div className="text-xs text-gray-500">ペアさがし最高</div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 text-center">
                <div className="text-xl font-bold text-pink-600">{bestStars}</div>
                <div className="text-xs text-gray-500">クイズ最高スター</div>
              </div>
            </div>

            {/* 文字別の定着マップ */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-gray-700">アルファベット別の定着状況</span>
                <span className="text-xs text-gray-400">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-100 border border-green-300 mr-1" />定着
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-100 border border-amber-300 ml-2 mr-1" />練習中
                  <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-100 border border-red-300 ml-2 mr-1" />要復習
                </span>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
                {ALPHABET.map(l => (
                  <div
                    key={l}
                    className={`aspect-square rounded-md flex items-center justify-center text-xs font-bold ${letterCellStyle(letterStats[l])}`}
                    title={letterStats[l] ? `${l}: 正解${letterStats[l].correct} / ミス${letterStats[l].wrong}` : `${l}: 未着手`}
                  >
                    {l}
                  </div>
                ))}
              </div>
              {weakLetters.length > 0 && (
                <div className="mt-2 text-xs text-red-600 font-medium">
                  要復習: {weakLetters.join('・')}
                </div>
              )}
            </div>

            {/* Records grouped by date */}
            <div className="flex flex-col gap-4">
              {sortedDates.map(dateKey => (
                <div key={dateKey}>
                  <div className="text-xs font-semibold text-gray-500 mb-2 px-1">
                    {formatDateDisplay(new Date(dateKey))}
                  </div>
                  <div className="flex flex-col gap-2">
                    {groupedByDate[dateKey].map(rec => {
                      const d = new Date(rec.played_at)
                      const modeInfo = MODE_LABELS[rec.mode]
                      return (
                        <div key={rec.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3">
                          <span className="text-sm font-semibold text-gray-500 w-12">{formatTime(d)}</span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${modeInfo.badge}`}>
                            {modeInfo.label}
                          </span>
                          <span className="text-sm font-medium text-gray-800 ml-auto">
                            {rec.mode === 'matching'
                              ? `レベル ${rec.level ?? '-'} クリア`
                              : `スター ${rec.stars ?? 0} / ${rec.total ?? '-'}`}
                          </span>
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
