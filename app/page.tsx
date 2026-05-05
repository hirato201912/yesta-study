'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const codeNum = parseInt(code, 10)
    if (isNaN(codeNum)) {
      setError('講師コードを正しく入力してください')
      setLoading(false)
      return
    }
    const { data, error: dbError } = await supabase
      .from('itoshima_teachers')
      .select('id, name, code')
      .eq('code', codeNum)
      .eq('password', password)
      .single()
    if (dbError || !data) {
      setError('講師コードまたはパスワードが違います')
      setLoading(false)
      return
    }
    localStorage.setItem('yesta_teacher', JSON.stringify({ id: data.id, name: data.name, code: data.code }))
    router.push('/study')
  }

  return (
    <div className="min-h-screen bg-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-indigo-700">イエスタ 自習管理</h1>
          <p className="text-sm text-gray-500 mt-1">講師ログイン</p>
        </div>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">講師コード</label>
            <input
              type="number"
              inputMode="numeric"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="例：1001"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold rounded-lg py-3 text-base transition-colors"
          >
            {loading ? 'ログイン中…' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
