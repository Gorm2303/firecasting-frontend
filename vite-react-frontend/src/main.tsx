import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import {BrowserRouter} from 'react-router-dom'
import './index.css'
import App from './App'
import { AssumptionsProvider } from './state/assumptions'
import { UiPreferencesProvider } from './state/uiPreferences'
import { ExecutionDefaultsProvider } from './state/executionDefaults'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <UiPreferencesProvider>
        <AssumptionsProvider>
          <ExecutionDefaultsProvider>
            <App />
          </ExecutionDefaultsProvider>
        </AssumptionsProvider>
      </UiPreferencesProvider>
    </BrowserRouter>
  </StrictMode>,
)
