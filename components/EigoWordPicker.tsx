'use client'
import { useState, useMemo, useEffect } from 'react'
import wordsData from '@/data/eigo_words.json'

export type EigoWord = { en: string; ja: string }
type Category = { name: string; words: EigoWord[] }

type Props = {
  open: boolean
  onClose: () => void
  onInsert: (words: EigoWord[]) => void
}

const categories = (wordsData as { categories: Category[] }).categories

export function EigoWordPicker({ open, onClose, onInsert }: Props) {
  const [activeCategoryIdx, setActiveCategoryIdx] = useState(0)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<EigoWord[]>([])

  useEffect(() => {
    if (!open) {
      setSelected([])
      setQuery('')
      setActiveCategoryIdx(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  const visibleWords = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      return categories.flatMap(c => c.words).filter(w =>
        w.en.toLowerCase().includes(q) || w.ja.includes(q)
      )
    }
    return categories[activeCategoryIdx]?.words ?? []
  }, [activeCategoryIdx, query])

  const isSelected = (w: EigoWord) => selected.some(s => s.en === w.en)

  const toggle = (w: EigoWord) => {
    setSelected(prev =>
      isSelected(w) ? prev.filter(s => s.en !== w.en) : [...prev, w]
    )
  }

  const handleInsert = () => {
    if (selected.length === 0) return
    onInsert(selected)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full bg-white rounded-t-2xl max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="px-4 pt-2 pb-2 border-b border-gray-100">
          <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-[#A0266A]">📖 覚えた単語を選ぶ</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center text-xl leading-none"
              aria-label="閉じる"
            >
              ×
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-gray-100">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="🔍 単語を検索（英語・日本語）"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D94F8A]"
          />
        </div>

        {/* Tabs */}
        {!query.trim() && (
          <div className="border-b border-gray-100 overflow-x-auto">
            <div className="flex gap-1.5 px-3 py-2 min-w-max">
              {categories.map((c, idx) => (
                <button
                  key={c.name}
                  onClick={() => setActiveCategoryIdx(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                    idx === activeCategoryIdx
                      ? 'bg-[#D94F8A] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Words grid */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[200px]">
          {visibleWords.length === 0 ? (
            <div className="text-center text-gray-400 text-sm py-12">
              該当する単語が見つかりません
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {visibleWords.map(w => {
                const sel = isSelected(w)
                return (
                  <button
                    key={w.en}
                    onClick={() => toggle(w)}
                    className={`flex flex-col items-start px-3 py-1.5 rounded-lg text-sm border transition-all min-w-[80px] ${
                      sel
                        ? 'bg-[#D94F8A] text-white border-[#D94F8A] shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-[#FFD1E4]'
                    }`}
                  >
                    <span className="font-semibold leading-tight">{w.en}</span>
                    <span className={`text-xs leading-tight ${sel ? 'text-pink-100' : 'text-gray-500'}`}>
                      {w.ja}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Selected preview + footer */}
        {selected.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 bg-[#FFF8FB] max-h-20 overflow-y-auto">
            <div className="text-xs text-[#A0266A] font-semibold mb-1">選択中（{selected.length}）</div>
            <div className="flex flex-wrap gap-1">
              {selected.map(w => (
                <button
                  key={w.en}
                  onClick={() => toggle(w)}
                  className="text-xs bg-white border border-[#D94F8A] text-[#A0266A] rounded-full px-2 py-0.5 hover:bg-[#FFE0EF]"
                >
                  {w.en} ×
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-gray-100 px-4 py-3 flex gap-2 bg-white">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            閉じる
          </button>
          <button
            onClick={handleInsert}
            disabled={selected.length === 0}
            className="flex-[2] bg-[#D94F8A] hover:bg-[#A0266A] disabled:bg-[#F5B8D2] text-white font-semibold rounded-xl py-2.5 text-sm transition-colors"
          >
            選択した {selected.length} 個を追加
          </button>
        </div>
      </div>
    </div>
  )
}
