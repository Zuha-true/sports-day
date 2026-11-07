import React, { useState, useEffect } from 'react';
import client from '../../api/client';
import AdminLayout from '../../components/AdminLayout';
import upiQr from '../../assets/upiscanner.jpeg';

export default function PaymentSettings() {
  const [info, setInfo] = useState({ qr_url: '', upi_id: '', payee_name: '' });
  const [upiForm, setUpiForm] = useState({ upi_id: '', payee_name: '' });
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      client.get('/settings/payment-info'),
      client.get('/settings/qr-history'),
    ]).then(([infoRes, histRes]) => {
      setInfo(infoRes.data);
      setUpiForm({ upi_id: infoRes.data.upi_id || '', payee_name: infoRes.data.payee_name || '' });
      setHistory(histRes.data);
    }).catch(() => setError('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleQrChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Image must be under 2 MB'); return; }
    setQrFile(file);
    setQrPreview(URL.createObjectURL(file));
  };

  const handleQrUpload = async e => {
    e.preventDefault();
    if (!qrFile) return setError('No image selected');
    setError(''); setSuccess('');
    const form = new FormData();
    form.append('qr', qrFile);
    try {
      const r = await client.post('/settings/qr', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setInfo(i => ({ ...i, qr_url: r.data.qr_url }));
      setSuccess('QR image updated');
      setQrFile(null); setQrPreview('');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    }
  };

  const handleUpiSave = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    try {
      await client.post('/settings/upi', upiForm);
      setSuccess('UPI settings saved');
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed');
    }
  };

  if (loading) return <AdminLayout><div className="loading">Loading…</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="admin-page-header"><h1>Payment settings</h1></div>
      <div>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="register-form-container">
          <h2>UPI QR Code</h2>
          <div style={{ marginBottom: 12 }}>
            <p>Current QR:</p>
            <img src={info.qr_url || upiQr} alt="Current QR" className="qr-image" />
          </div>
          <form onSubmit={handleQrUpload} className="register-form">
            <div className="form-group">
              <label>Upload New QR Image (JPEG/PNG/WebP, max 2 MB)</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleQrChange} />
              {qrPreview && (
                <div>
                  <p>Preview:</p>
                  <img src={qrPreview} alt="New QR preview" className="qr-image" />
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={!qrFile}>Save New QR</button>
          </form>
        </div>

        <div className="register-form-container" style={{ marginTop: 32 }}>
          <h2>UPI Details</h2>
          <form onSubmit={handleUpiSave} className="register-form">
            <div className="form-row">
              <div className="form-group">
                <label>UPI ID</label>
                <input type="text" value={upiForm.upi_id} onChange={e => setUpiForm(f => ({ ...f, upi_id: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Payee Name</label>
                <input type="text" value={upiForm.payee_name} onChange={e => setUpiForm(f => ({ ...f, payee_name: e.target.value }))} required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary">Save UPI Details</button>
          </form>
        </div>

        {history.length > 0 && (
          <div className="register-form-container" style={{ marginTop: 32 }}>
            <h2>Change History</h2>
            <div className="students-table-wrapper">
              <table className="students-table">
                <thead><tr><th>Action</th><th>By</th><th>When</th><th>Detail</th></tr></thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={i}>
                      <td>{h.action}</td>
                      <td>{h.actor}</td>
                      <td>{new Date(h.created_at).toLocaleString('en-IN')}</td>
                      <td><small>{JSON.stringify(h.detail)}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
