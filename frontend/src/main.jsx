import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './auth.jsx'
import { ShiftProvider } from './shift.jsx'
import App from './App.jsx'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <ShiftProvider>
          <App />
        </ShiftProvider>
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
