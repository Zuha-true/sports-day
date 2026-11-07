import React, { useState, useEffect } from 'react';
import client from '../api/client';

export default function TeamBuilder({ gameId, teams, onTeamsUpdate }) {
  const [available, setAvailable] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [selected, setSelected] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchAvailable = () => {
    client.get(`/students/eligible/${gameId}`)
      .then(r => setAvailable(r.data))
      .catch(console.error);
  };

  useEffect(() => { fetchAvailable(); }, [gameId]);  // eslint-disable-line

  const toggle = id => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!selected.length) return setError('Select at least one member');
    try {
      await client.post('/teams', { game_id: parseInt(gameId), team_name: teamName, members: selected });
      setSuccess('Team created!');
      setTeamName(''); setSelected([]);
      onTeamsUpdate(); fetchAvailable();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create team');
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this team?')) return;
    try {
      await client.delete(`/teams/${id}`);
      onTeamsUpdate(); fetchAvailable();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete team');
    }
  };

  return (
    <div className="team-builder">
      <div className="builder-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2>Create New Team</h2>
          <button className="btn btn-sm btn-secondary" type="button" onClick={fetchAvailable}>🔄 Refresh</button>
        </div>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleSubmit} className="team-form">
          <div className="form-group">
            <label>Team Name</label>
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Select Members</label>
            <div className="students-selection">
              {available.length === 0
                ? <p className="no-students">No eligible students (must be approved for this game)</p>
                : available.map(s => (
                  <label key={s.id} className="student-checkbox">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />
                    <span>{s.name} ({s.roll_number})</span>
                  </label>
                ))
              }
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={!available.length}>+ Create Team</button>
        </form>
      </div>

      <div className="teams-section">
        <h2>Existing Teams</h2>
        {teams.length === 0
          ? <p className="no-teams">No teams yet.</p>
          : (
            <div className="teams-list">
              {teams.map(team => (
                <div key={team.id} className="team-card">
                  <div className="team-header">
                    <h3>{team.team_name}</h3>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(team.id)}>Delete</button>
                  </div>
                  <div className="team-members">
                    <strong>Members:</strong>
                    <ul>{team.members.map(m => <li key={m.id}>{m.name}</li>)}</ul>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
