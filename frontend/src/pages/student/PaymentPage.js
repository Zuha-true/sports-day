import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import client from '../../api/client';
import upiQr from '../../assets/upiscanner.jpeg';

export default function PaymentPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [payInfo, setPayInfo] = useState({});
  const [form, setForm] = useState({
    utr: '', team_name: '', partner_roll: '', member_rolls: '', screenshot: null,
  });
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get(`/games/${id}`),
      client.get('/settings/payment-info'),
    ]).then(([gameRes, payRes]) => {
      setGame(gameRes.data);
      setPayInfo(payRes.data);
    }).catch(() => setError('Failed to load payment info'))
      .finally(() => setPageLoading(false));
  }, [id]);

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleFile = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Screenshot must be under 2 MB');
      e.target.value = '';
      return;
    }
    setForm(f => ({ ...f, screenshot: file }));
    setPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = new FormData();
      data.append('game_id', id);
      if (form.utr) data.append('utr', form.utr);
      if (form.screenshot) data.append('screenshot', form.screenshot);
      if (game.category === 'duo') {
        data.append('team_name', form.team_name);
        data.append('partner_roll', form.partner_roll);
      }
      if (game.category === 'team') {
        data.append('team_name', form.team_name);
        data.append('member_rolls', form.member_rolls);
      }

      await client.post('/registrations', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      nav('/student/registrations', { state: { success: true } });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit registration');
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) return <div className="loading">Loading…</div>;
  if (!game) return <div className="error-message" style={{margin:20}}>Game not found.</div>;

  // Live fee calculation for team games
  const memberLines = game.category === 'team'
    ? form.member_rolls.split(/[\n,]+/).map(r => r.trim()).filter(Boolean)
    : [];
  const totalPlayers = game.category === 'team' ? 1 + memberLines.length : 1;
  const totalFee = game.category === 'team'
    ? game.entry_fee * totalPlayers
    : game.entry_fee;

  return (
    <div className="admin-page">
      <nav className="admin-navbar">
        <button className="back-button" onClick={() => nav('/student/games')}>← Games</button>
        <h1>Pay to register — {game.name}</h1>
      </nav>
      <div className="page-content payment-page">
        {error && <div className="error-message">{error}</div>}

        {/* Payment instructions */}
        <div className="payment-card">
          <h2>Payment Instructions</h2>

          {/* Fee summary */}
          <div style={{background:'var(--matcha-tint)',borderRadius:10,padding:'12px 16px',marginBottom:14}}>
            {game.category === 'solo' && (
              <p style={{margin:0}}>Entry fee: <strong>₹{game.entry_fee}</strong></p>
            )}
            {game.category === 'duo' && (
              <>
                <p style={{margin:'0 0 4px'}}>
                  ₹{game.entry_fee} per person ×{' '}
                  <strong>2 players</strong>
                  {' '}= <strong>₹{game.entry_fee * 2}</strong>
                </p>
                <p style={{margin:0,fontSize:13,color:'var(--muted-color)'}}>
                  The team leader pays for both players in one transaction.
                </p>
              </>
            )}
            {game.category === 'team' && (
              <>
                <p style={{margin:'0 0 4px'}}>
                  ₹{game.entry_fee} per person ×{' '}
                  <strong>{totalPlayers} player{totalPlayers !== 1 ? 's' : ''}</strong>
                  {' '}= <strong>₹{totalFee}</strong>
                </p>
                <p style={{margin:0,fontSize:13,color:'var(--muted-color)'}}>
                  The team leader pays for the whole team in one transaction.
                </p>
              </>
            )}
          </div>

          <p>
            Pay to <strong>{payInfo.upi_id || '—'}</strong>
            {payInfo.payee_name ? ` (${payInfo.payee_name})` : ''} or scan the QR code.
          </p>
          <p className="payment-note">After paying, enter your UTR/transaction reference number below.</p>
          <img src={payInfo.qr_url || upiQr} alt="UPI QR Code" className="qr-image" />
        </div>

        <form onSubmit={handleSubmit} className="register-form" style={{ marginTop: 24 }}>
          {/* Team name — required for duo and team */}
          {(game.category === 'duo' || game.category === 'team') && (
            <div className="form-group">
              <label>Team name *</label>
              <input
                type="text"
                value={form.team_name}
                onChange={set('team_name')}
                placeholder="e.g. Phoenix Squad"
                required
              />
            </div>
          )}

          {/* Duo: partner roll number */}
          {game.category === 'duo' && (
            <div className="form-group">
              <label>Partner's roll number *</label>
              <input
                type="text"
                value={form.partner_roll}
                onChange={set('partner_roll')}
                placeholder="22CS002"
                required
              />
              <small>Your partner must already have an account.</small>
            </div>
          )}

          {/* Team: member roll numbers */}
          {game.category === 'team' && (
            <div className="form-group">
              <label>
                Other team members' roll numbers *
                ({game.min_team_size - 1}–{game.max_team_size - 1} others, not including yourself)
              </label>
              <textarea
                value={form.member_rolls}
                onChange={set('member_rolls')}
                placeholder={'22CS001\n22CS002\n22CS003'}
                rows={5}
                required
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, padding: '8px 12px', borderRadius: 10, border: '2px solid var(--field)', resize: 'vertical' }}
              />
              <small>One roll number per line. Each member must have an account.</small>
            </div>
          )}

          <div className="form-group">
            <label>UTR / Transaction Reference</label>
            <input
              type="text"
              value={form.utr}
              onChange={set('utr')}
              placeholder="12-digit UTR or reference number"
            />
          </div>

          <div className="form-group">
            <label>Payment Screenshot (optional, max 2 MB)</label>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} />
            {preview && <img src={preview} alt="Preview" style={{ maxWidth: 200, marginTop: 8, borderRadius: 8 }} />}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Submitting…' : 'I Paid — Submit Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
