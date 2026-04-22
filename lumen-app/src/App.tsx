import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { LibraryPage } from './pages/LibraryPage'
import { ReaderPage } from './pages/ReaderPage'
import { ResearchPage } from './pages/ResearchPage'
import { GraphPage } from './pages/GraphPage'
import { SettingsPage } from './pages/SettingsPage'
import { CollectionPage } from './pages/CollectionPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/reader" element={<ReaderPage />} />
          <Route path="/reader/:id" element={<ReaderPage />} />
          <Route path="/research" element={<ResearchPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/collection/:id" element={<CollectionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
