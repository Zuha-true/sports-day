import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { logout, getDecodedToken } from '../../api/auth';

export default function StudentHome() {
  const nav = useNavigate();
  const payload = getDecodedToken('studentToken');
  const name = payload?.name || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div>
      <header className="student-topbar">
        <div className="student-topbar-left">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <img src="/aitm-logo.png" alt="AITM" style={{width:36,height:36,objectFit:'contain'}} />
            <strong style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:14,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--cherry)'}}>Girls' Sports Day</strong>
          </div>
          <nav className="student-topbar-nav">
            <Link to="/student/games">Games</Link>
            <Link to="/student/registrations">My registrations</Link>
          </nav>
        </div>
        <div style={{display:'flex',gap:10,alignItems:'center'}}>
          <div className="avatar-pill">
            <div className="avatar-initials">{initials || '?'}</div>
            <span>{name.split(' ')[0]}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="page-content">
        <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:40,textTransform:'uppercase',letterSpacing:'0.03em',color:'var(--cherry)',marginBottom:8}}>
          AITM Girls' Sports Day
        </h1>
        <p style={{color:'var(--muted-color)',marginBottom:32}}>Browse games, register, and track your registrations.</p>
        <div className="sports-grid" style={{maxWidth:600}}>
          <div className="sport-card clickable" onClick={() => nav('/student/games')}>
            <h3>Browse Games</h3>
            <p>See all events and register</p>
            <div style={{marginTop:16}}><button className="btn btn-primary btn-sm">Go →</button></div>
          </div>
          <div className="sport-card clickable" onClick={() => nav('/student/registrations')}>
            <h3>My Registrations</h3>
            <p>Track your registration status</p>
            <div style={{marginTop:16}}><button className="btn btn-primary btn-sm">Go →</button></div>
          </div>
        </div>
      </main>
    </div>
  );
}
