import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';

const STATUS_BADGE = {
  approved: { label: 'Approved ✓', cls: 'badge-approved' },
  pending:  { label: 'Pending…',   cls: 'badge-pending' },
  rejected: { label: 'Rejected',   cls: 'badge-rejected' },
};

export default function GameDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [myReg, setMyReg] = useState(null);
  const [participants, setParticipants] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get(`/games/${id}`),
      client.get('/registrations/mine'),
    ]).then(([gameRes, regsRes]) => {
      setGame(gameRes.data);
      const reg = regsRes.data.find(r => String(r.game_id) === String(id));
      setMyReg(reg || null);

      // Fetch participants only if approved
      if (reg?.status === 'approved') {
        return client.get(`/games/${id}/participants`);
      }
    }).then(pRes => {
      if (pRes) setParticipants(pRes.data.participants);
    }).catch(err => {
      if (err.response?.status !== 403) console.error('Failed to load game details', err);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">Loading…</div>;
  if (!game) return <div className="error-message" style={{margin:20}}>Game not found.</div>;

  const badge = myReg ? STATUS_BADGE[myReg.status] : null;

  return (
    <div className="admin-page">
      <nav className="admin-navbar">
        <button className="back-button" onClick={() => nav('/student/games')}>← Games</button>
        <h1>{game.name}</h1>
      </nav>
      <div className="page-content">
        <div className="game-detail-card">
          <div className="game-meta-block">
            <span className="category-tag">{game.category.toUpperCase()}</span>
            <span>Entry fee: ₹{game.entry_fee}</span>
            {game.venue && <span>📍 {game.venue}</span>}
            {game.schedule_at && <span>📅 {new Date(game.schedule_at).toLocaleString('en-IN')}</span>}
          </div>

          {game.description && <p>{game.description}</p>}
          {game.rules && (
            <details className="rules-block">
              <summary>Rules</summary>
              <p>{game.rules}</p>
            </details>
          )}

          {/* Registration status */}
          {badge && (
            <div className={`reg-status-banner ${badge.cls}`}>
              Your registration: {badge.label}
              {myReg.status === 'rejected' && myReg.rejected_reason && (
                <span className="rejection-reason"> — {myReg.rejected_reason}</span>
              )}
            </div>
          )}

          {/* Register button — only if no registration yet (or rejected) */}
          {(!myReg || myReg.status === 'rejected') && game.is_active && (
            <button
              className="btn btn-primary"
              onClick={() => nav(`/student/games/${id}/pay`)}
            >
              Register — Pay ₹{game.entry_fee}
            </button>
          )}

          {/* Participants (approved students only) */}
          {participants !== null && (
            <div className="participants-block">
              <h3>Approved Participants</h3>
              {game.category === 'team'
                ? participants.map(t => (
                    <div key={t.team} className="team-card-view">
                      <strong>{t.team}</strong>
                      <div>{t.members.join(', ')}</div>
                    </div>
                  ))
                : (
                  <ul className="participant-list">
                    {participants.map((name, i) => <li key={i}>{name}</li>)}
                  </ul>
                )
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
