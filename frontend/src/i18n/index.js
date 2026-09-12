import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import my from './my.json'
import en from './en.json'

i18n.use(initReactI18next).init({
  resources: {
    my: { translation: my },
    en: { translation: en }
  },
  lng: 'my',
  fallbackLng: 'en',
  interpolation: { escapeValue: false }
})

export default i18n
