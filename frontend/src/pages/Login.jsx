import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { t, i18n } = useTranslation()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-500 to-indigo-600 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/favicon.jpg" alt="Caregivers" className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-4 border-sky-400" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('appName')}</h1>
          <p className="text-gray-500 mt-1">{t('welcome')}</p>
        </div>

        <div className="flex justify-end mb-4 gap-2">
          <button onClick={() => i18n.changeLanguage('my')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'my' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>မြန်မာ</button>
          <button onClick={() => i18n.changeLanguage('en')} className={`px-3 py-1 rounded text-sm ${i18n.language === 'en' ? 'bg-sky-500 text-white' : 'bg-gray-200'}`}>EN</button>
        </div>

        {error && <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? t('loading') : t('login')}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600 dark:text-gray-400">
          <Link to="/register" className="text-sky-500 hover:underline font-medium">{t('register')}</Link>
        </p>
      </div>
    </div>
  )
}
