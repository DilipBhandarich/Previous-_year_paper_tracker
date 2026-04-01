import React, { useState } from 'react'
import Home from './pages/Home'
import Subjects from './pages/Subjects'
import Papers from './pages/Papers'
import SubjectDetail from './pages/SubjectDetail'

export default function App() {
  const [page, setPage] = useState({ name: 'home', params: {} })

  const navigate = (name, params = {}) => setPage({ name, params })

  const renderPage = () => {
    switch (page.name) {
      case 'home':     return <Home navigate={navigate} />
      case 'subjects': return <Subjects navigate={navigate} />
      case 'subject':  return <SubjectDetail navigate={navigate} id={page.params.id} />
      case 'papers':   return <Papers navigate={navigate} />
      default:         return <Home navigate={navigate} />
    }
  }

  return (
    <div className="app">
      <nav className="navbar">
        <button onClick={() => navigate('home')} className="navbar-brand" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          📚 NCET Paper Tracker
        </button>
        <ul className="navbar-nav">
          <li><button onClick={() => navigate('home')} className={page.name === 'home' ? 'active' : ''}>Home</button></li>
          <li><button onClick={() => navigate('subjects')} className={page.name === 'subjects' || page.name === 'subject' ? 'active' : ''}>Subjects</button></li>
          <li><button onClick={() => navigate('papers')} className={page.name === 'papers' ? 'active' : ''}>Papers</button></li>
        </ul>
      </nav>

      <div className="main-content">
        {renderPage()}
      </div>

      <footer>
        <p>NCET Previous Year Paper Tracker &copy; {new Date().getFullYear()} — All Rights Reserved</p>
      </footer>
    </div>
  )
}
