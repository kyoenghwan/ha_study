import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppDialogHost } from './components/AppDialog.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <AppDialogHost />
  </StrictMode>,
)
