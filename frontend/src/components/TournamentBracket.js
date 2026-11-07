import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function TournamentBracket({ gameId, teams }) {
  const [matches, setMatches] = useState([]);
  const [champion, setChampion] = useState(null);
  const [error, setError] = useState('');

  const fetchBracket = () => {
    client.get(`/brackets/${gameId}`)
      .then(r => setMatches(r.data))
      .catch(console.error);
    client.get(`/brackets/champion/${gameId}`)
      .then(r => setChampion(r.data.champion))
      .catch(console.error);
  };

  useEffect(() => { fetchBracket(); }, [gameId]);  // eslint-disable-line

  const handleGenerate = async () => {
    setError('');
    try {
      await client.post(`/brackets/generate/${gameId}`);
      fetchBracket();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate bracket');
    }
  };

  const handleSetWinner = async (matchId, winnerId) => {
    try {
      await client.put(`/brackets/match/${matchId}`, { winner_id: winnerId });
      fetchBracket();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to set winner');
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset the bracket? All match results will be lost.')) return;
    try {
      await client.delete(`/brackets/${gameId}`);
      setMatches([]); setChampion(null);
    } catch (err) {
      setError('Failed to reset bracket');
    }
  };

  const grouped = matches.reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});
  const rounds = Object.keys(grouped).sort((a, b) => a - b);

  return (
    <div className="tournament-bracket">
      <div className="bracket-header">
        <h2>Tournament Bracket</h2>
        <div className="bracket-actions">
          {matches.length === 0
            ? <button className="btn btn-primary" onClick={handleGenerate} disabled={teams.length < 2}>Generate Bracket</button>
            : <button className="btn btn-danger" onClick={handleReset}>Reset Bracket</button>
          }
        </div>
      </div>
      {error && <div className="error-message">{error}</div>}

      {champion && (
        <div className="winner-announcement">
          <h2>🏆 Champion 🏆</h2>
          <h3>{champion}</h3>
        </div>
      )}

      {matches.length > 0 && (
        <div className="bracket-container">
          <div className="bracket-rounds">
            {rounds.map(round => (
              <div key={round} className="bracket-round">
                <h3>Round {round}</h3>
                <div className="round-matches">
                  {grouped[round].map(match => (
                    <div key={match.id} className={`match-card ${match.is_bye ? 'match-bye' : ''}`}>
                      <div className="match-header">
                        Match {match.match_number}
                        {match.is_bye && <span className="bye-label"> (bye)</span>}
                      </div>
                      <div className={`team ${match.winner_id === match.entity1_id ? 'winner' : match.is_completed ? 'loser' : ''}`}>
                        <span className="team-name">{match.entity1_name || 'TBD'}</span>
                        {match.entity1_id && !match.is_completed && (
                          <button className="btn btn-sm btn-success" onClick={() => handleSetWinner(match.id, match.entity1_id)}>✓</button>
                        )}
                      </div>
                      <div className="vs-divider">vs</div>
                      <div className={`team ${match.winner_id === match.entity2_id ? 'winner' : match.is_completed ? 'loser' : ''}`}>
                        <span className="team-name">{match.entity2_name || 'BYE'}</span>
                        {match.entity2_id && !match.is_completed && (
                          <button className="btn btn-sm btn-success" onClick={() => handleSetWinner(match.id, match.entity2_id)}>✓</button>
                        )}
                      </div>
                      {match.is_completed && !match.is_bye && (
                        <div className="match-result">Winner: {match.winner_name}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
