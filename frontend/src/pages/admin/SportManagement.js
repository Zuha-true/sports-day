import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import client from '../../api/client';
import TournamentBracket from '../../components/TournamentBracket';
import AdminLayout from '../../components/AdminLayout';

export default function SportManagement() {
  const { gameId } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get(`/games/${gameId}`),
      client.get(`/teams/${gameId}`),
    ]).then(([gameRes, teamsRes]) => {
      setGame(gameRes.data);
      setTeams(teamsRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [gameId]);

  if (loading) return <AdminLayout><div className="loading">Loading…</div></AdminLayout>;
  if (!game) return <AdminLayout><div className="error-message" style={{ margin: 20 }}>Game not found.</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>{game.name}</h1>
        <button className="back-button" style={{marginTop:4}} onClick={() => nav('/admin/games')}>← Manage games</button>
      </div>
      <TournamentBracket gameId={gameId} teams={teams} />
    </AdminLayout>
  );
}
