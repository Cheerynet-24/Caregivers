import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function Register() {
  const { t, i18n } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', password: '', displayName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Register failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Caregivers" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-4 border-sky-400" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('register')}</h1>
        </div>

        <div className="flex justify-end mb-4 gap-2">
          <button onClick={() => i18n.changeLanguage('my')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'my' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>မြန်မာ</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'en' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>EN</button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('username')}</label>
            <input type="text" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('displayName')}</label>
            <input type="text" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t('password')}</label>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-sky-500 outline-none" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50">
            {loading ? t('loading') : t('register')}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          <Link to="/login" className="text-sky-500 hover:underline font-medium">{t('login')}</Link>
        </p>
      </div>
    </div>
  )
}
