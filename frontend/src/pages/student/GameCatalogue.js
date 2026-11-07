import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import { logout, getDecodedToken } from '../../api/auth';

const CATS = ['solo', 'duo', 'team'];
const CAT_LABEL = { solo: 'Solos', duo: 'Duos', team: 'Teams' };
const CAT_KIND  = {
  solo: 'Solo',
  duo:  'Duo · you and a partner',
  team: 'Team',
};
const CAT_SLOGAN = {
  solo: 'Just you and the clock.',
  duo:  'Two players, one plan.',
  team: 'Squad up and make some noise.',
};

function statusChip(reg) {
  if (!reg) return null;
  if (reg.status === 'approved') return <span className="chip chip-registered">Registered</span>;
  if (reg.status === 'pending')  return <span className="chip chip-waiting">Waiting for approval</span>;
  if (reg.status === 'rejected') return <span className="chip chip-rejected">Rejected</span>;
  return null;
}

function gameAction(game, reg, nav) {
  if (game.reg_close_at && new Date(game.reg_close_at) < new Date()) {
    return <button className="btn btn-ghost btn-sm" disabled>Registration closed</button>;
  }
  if (!reg) {
    return <button className="btn btn-primary btn-sm" onClick={() => nav(`/student/games/${game.id}/pay`)}>Register</button>;
  }
  if (reg.status === 'approved') {
    return <button className="btn btn-primary btn-sm" onClick={() => nav(`/student/games/${game.id}`)}>View bracket</button>;
  }
  if (reg.status === 'pending') {
    return <button className="btn btn-ghost btn-sm" disabled>Payment being checked</button>;
  }
  // rejected — allow re-register
  return <button className="btn btn-primary btn-sm" onClick={() => nav(`/student/games/${game.id}/pay`)}>Register</button>;
}

function teamKind(game) {
  if (game.category === 'team' && game.min_team_size && game.max_team_size) {
    return `Team · ${game.min_team_size}–${game.max_team_size} players`;
  }
  return CAT_KIND[game.category];
}

export default function GameCatalogue() {
  const [games, setGames] = useState([]);
  const [regs, setRegs] = useState([]);
  const [tab, setTab] = useState('solo');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const nav = useNavigate();

  const payload = getDecodedToken('studentToken');
  const name = payload?.name || '';
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    Promise.all([
      client.get('/games'),
      client.get('/registrations/mine'),
    ]).then(([gr, rr]) => {
      setGames(gr.data);
      setRegs(rr.data);
    }).catch(() => setError('Failed to load games'))
      .finally(() => setLoading(false));
  }, []);

  const regByGame = Object.fromEntries(regs.map(r => [r.game_id, r]));
  const grouped = CATS.reduce((acc, c) => {
    acc[c] = games.filter(g => g.category === c);
    return acc;
  }, {});
  const counts = CATS.reduce((acc, c) => { acc[c] = grouped[c].length; return acc; }, {});

  const approved  = regs.filter(r => r.status === 'approved').length;
  const pending   = regs.filter(r => r.status === 'pending').length;

  if (loading) return <div className="loading">Loading games…</div>;

  return (
    <div>
      {/* Top bar */}
      <header className="student-topbar">
        <div className="student-topbar-left">
          <div className="home-logo" style={{textDecoration:'none', display:'flex', alignItems:'center', gap:10}}>
            <img src="/aitm-logo.png" alt="AITM" style={{width:36,height:36,objectFit:'contain'}} />
            <div className="logo-text">
              <strong style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:14,textTransform:'uppercase',letterSpacing:'0.04em',color:'var(--cherry)'}}>Girls' Sports Day</strong>
            </div>
          </div>
          <nav className="student-topbar-nav" aria-label="Student navigation">
            <Link to="/student/games">Games</Link>
            <Link to="/student/registrations">My registrations</Link>
          </nav>
        </div>
        <div style={{display:'flex', gap: 10, alignItems: 'center'}}>
          <div className="avatar-pill" title={name}>
            <div className="avatar-initials">{initials || '?'}</div>
            <span>{name.split(' ')[0]}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="page-content">
        {error && <div className="error-message" role="alert">{error}</div>}

        <div className="catalogue-header">
          <h1 style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:36,textTransform:'uppercase',letterSpacing:'0.03em',color:'var(--cherry)'}}>
            Pick your games
          </h1>
          {(approved > 0 || pending > 0) && (
            <p className="catalogue-status">
              You are registered for {approved + pending} game{approved + pending !== 1 ? 's' : ''}.
              {pending > 0 && ` ${pending} waiting for approval.`}
            </p>
          )}
        </div>

        {/* Segmented control */}
        <div className="seg-wrap">
          <div className="seg-control" role="group" aria-label="Game category">
            {CATS.map(c => (
              <button
                key={c}
                aria-pressed={tab === c}
                onClick={() => setTab(c)}
              >
                {CAT_LABEL[c]} ({counts[c]})
              </button>
            ))}
          </div>
        </div>
        <p className="seg-slogan">{CAT_SLOGAN[tab]}</p>

        {/* Game cards */}
        {grouped[tab].length === 0 ? (
          <p className="muted">No {CAT_LABEL[tab].toLowerCase()} events yet.</p>
        ) : (
          <div className="sports-grid">
            {grouped[tab].map(game => {
              const reg = regByGame[game.id];
              return (
                <div key={game.id} className="game-card">
                  <div className="game-card-kind">{teamKind(game)}</div>
                  {statusChip(reg)}
                  <div className="game-card-name">{game.name}</div>
                  {game.venue && (
                    <div className="game-card-meta">
                      <span>📍 {game.venue}</span>
                      {game.schedule_at && <span>📅 {new Date(game.schedule_at).toLocaleDateString('en-IN')}</span>}
                    </div>
                  )}
                  <div className="game-card-fee">₹{game.entry_fee} entry</div>
                  <div className="game-card-action">
                    {gameAction(game, reg, nav)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
