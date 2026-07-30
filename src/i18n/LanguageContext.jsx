import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { zh } from './zh'
import { en } from './en'

const translations = { zh, en }
const STORAGE_KEY = 'eat-with-me-lang'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'en' || saved === 'zh') return saved
    } catch { /* noop */ }
    return 'zh'
  })

  const setLang = useCallback((l) => {
    setLangState(l)
    try { localStorage.setItem(STORAGE_KEY, l) } catch { /* noop */ }
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'zh' ? 'en' : 'zh')
  }, [lang, setLang])

  const t = useCallback((key, params) => {
    const dict = translations[lang]
    let text = dict[key]
    if (text === undefined) text = translations.zh[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
      })
    }
    return text
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useTranslation() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useTranslation must be used within LanguageProvider')
  return ctx
}
