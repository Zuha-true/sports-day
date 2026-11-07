import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import client from '../../api/client';
import { logout, getDecodedToken } from '../../api/auth';

function statusChip(status) {
  if (status === 'approved') return <span className="chip chip-registered">Registered</span>;
  if (status === 'pending')  return <span className="chip chip-waiting">Waiting for approval</span>;
  if (status === 'rejected') return <span className="chip chip-rejected">Rejected</span>;
  return null;
}

export default function MyRegistrations() {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const location = useLocation();
  const justSubmitted = location.state?.success;
  const payload = getDecodedToken('studentToken');
  const name = payload?.name || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    client.get('/registrations/mine')
      .then(r => setRegs(r.data))
      .catch(() => setError('Failed to load registrations'))
      .finally(() => setLoading(false));
  }, []);

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
        <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:32,textTransform:'uppercase',letterSpacing:'0.03em',color:'var(--cherry)',marginBottom:20}}>
          My Registrations
        </h1>

        {justSubmitted && (
          <div className="success-message" style={{marginBottom:16}}>
            Registration submitted! Organisers will review your payment and approve it shortly.
          </div>
        )}
        {error && <div className="error-message" role="alert" style={{marginBottom:12}}>{error}</div>}

        {loading ? (
          <div className="loading">Loading…</div>
        ) : regs.length === 0 ? (
          <p className="muted">No registrations yet. <Link to="/student/games" style={{color:'var(--cherry)',fontWeight:600}}>Browse games →</Link></p>
        ) : (
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Game</th>
                    <th>Fee paid</th>
                    <th>UTR</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{fontWeight:600}}>{r.game_name}</div>
                        <div style={{fontSize:12,color:'var(--muted-color)',textTransform:'capitalize'}}>{r.category}</div>
                      </td>
                      <td>₹{r.fee_paid}</td>
                      <td style={{fontFamily:'monospace',fontSize:13}}>{r.utr || '—'}</td>
                      <td>{statusChip(r.status)}</td>
                      <td>
                        {r.status === 'rejected' && r.rejected_reason
                          ? <span className="rejection-reason" style={{fontSize:13,color:'var(--muted-color)'}}>{r.rejected_reason}</span>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
