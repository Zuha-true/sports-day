import React, { useState, useEffect, useCallback } from 'react';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';

export default function ApprovalsQueue() {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reason, setReason] = useState({});

  const fetchQueue = useCallback(() => {
    setLoading(true);
    client.get('/registrations/pending')
      .then(r => setQueue(r.data))
      .catch(() => setError('Failed to load queue'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(fetchQueue, [fetchQueue]);

  const updateStatus = async (id, status, rejectionReason) => {
    try {
      await client.patch(`/registrations/${id}/status`, { status, reason: rejectionReason });
      fetchQueue();
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed');
    }
  };

  const approved = queue.filter ? 0 : 0; // placeholder for summary
  void approved;

  return (
    <AdminLayout>
      <div className="admin-page-header">
        <h1>Approvals</h1>
        <p>{queue.length} pending · {queue.filter(r => r.status === 'approved').length} approved</p>
      </div>

      {error && <div className="error-message" role="alert" style={{marginBottom:16}}>{error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : queue.length === 0 ? (
        <div className="success-message">No pending registrations. All clear!</div>
      ) : (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Game</th>
                  <th>Fee</th>
                  <th>UTR</th>
                  <th>Proof</th>
                  <th>Sent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queue.map(r => (
                  <tr key={r.id}>
                    <td>
                      <div style={{fontWeight:600}}>{r.user_name}</div>
                      <div style={{fontSize:12,color:'var(--muted-color)'}}>{r.roll_number}</div>
                    </td>
                    <td>
                      <div>{r.game_name}</div>
                      <div style={{fontSize:12,color:'var(--muted-color)'}}>{r.category}</div>
                      {r.partner_roll && <div style={{fontSize:12,color:'var(--muted-color)'}}>Partner: {r.partner_roll}</div>}
                    </td>
                    <td>₹{r.fee_paid}</td>
                    <td style={{fontFamily:'monospace',fontSize:13}}>{r.utr || '—'}</td>
                    <td>
                      {r.screenshot_url
                        ? <a href={r.screenshot_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View</a>
                        : '—'}
                    </td>
                    <td style={{fontSize:13,color:'var(--muted-color)'}}>{new Date(r.created_at).toLocaleDateString('en-IN')}</td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => updateStatus(r.id, 'approved')}
                        >
                          Approve
                        </button>
                        <input
                          type="text"
                          placeholder="Reason (optional)…"
                          value={reason[r.id] || ''}
                          onChange={e => setReason(p => ({ ...p, [r.id]: e.target.value }))}
                          style={{
                            height: 36, width: 160, fontSize: 12, padding: '0 8px',
                            border: '2px solid var(--field)', borderRadius: 8,
                            fontFamily: 'var(--font-body)',
                          }}
                        />
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => updateStatus(r.id, 'rejected', reason[r.id])}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
