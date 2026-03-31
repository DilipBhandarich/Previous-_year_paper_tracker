import React from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Subjects from './pages/Subjects'
import Papers from './pages/Papers'
import SubjectDetail from './pages/SubjectDetail'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <nav className="navbar">
          <NavLink to="/" className="navbar-brand">
            📚 NCET Paper Tracker
          </NavLink>
          <ul className="navbar-nav">
            <li><NavLink to="/" end>Home</NavLink></li>
            <li><NavLink to="/subjects">Subjects</NavLink></li>
            <li><NavLink to="/papers">Papers</NavLink></li>
          </ul>
        </nav>

        <div className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectDetail />} />
            <Route path="/papers" element={<Papers />} />
          </Routes>
        </div>

        <footer>
          <p>NCET Previous Year Paper Tracker &copy; {new Date().getFullYear()} — All Rights Reserved</p>
        </footer>
      </div>
    </BrowserRouter>
  )
}
