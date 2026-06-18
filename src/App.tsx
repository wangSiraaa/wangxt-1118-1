import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Register from '@/pages/Register'
import Testing from '@/pages/Testing'
import Warehouse from '@/pages/Warehouse'
import Disposal from '@/pages/Disposal'
import Reminder from '@/pages/Reminder'
import Trace from '@/pages/Trace'

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/register" element={<Register />} />
          <Route path="/testing" element={<Testing />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/disposal" element={<Disposal />} />
          <Route path="/reminder" element={<Reminder />} />
          <Route path="/trace/:id" element={<Trace />} />
        </Route>
      </Routes>
    </Router>
  )
}
