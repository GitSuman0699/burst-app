'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchDrops, useUserId } from '@/lib/hooks';
import type { Drop } from '@/lib/types';
import { Modal } from '@/components/Modal';
import styles from './page.module.css';

export default function AdminPage() {
 const userId = useUserId();
 const [drops, setDrops] = useState<Drop[]>([]);
 const [loading, setLoading] = useState(true);
 const [actionLoading, setActionLoading] = useState<string | null>(null);
 const [simResults, setSimResults] = useState<any>(null);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'alert' | 'confirm' | 'prompt';
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'alert' });
  const [simCount, setSimCount] = useState('50');

  const showAlert = (title: string, message: string) => {
    setModalState({ isOpen: true, title, message, type: 'alert' });
  };

 const loadDrops = useCallback(async () => {
 if (!userId) return;
 try {
 const data = await fetchDrops(undefined, userId);
 setDrops(data);
 } catch (err) {
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, [userId]);

 useEffect(() => {
 loadDrops();
 }, [loadDrops]);

  const executeActivate = async (dropId: string) => {
    setActionLoading(`activate-${dropId}`);
    try {
      const res = await fetch(`/api/drops/${dropId}/activate`, {
        method: 'POST',
        headers: { 'x-admin-key': 'burst-admin-secret' }
      });
      if (res.ok) await loadDrops();
      else showAlert('Error', 'Failed to activate drop');
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Error activating drop');
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = (dropId: string) => {
    setModalState({
      isOpen: true,
      title: 'Activate Drop',
      message: 'Are you sure you want to activate this drop? This will make it LIVE instantly.',
      type: 'confirm',
      onConfirm: () => executeActivate(dropId),
    });
  };

  const executeSimulate = async (dropId: string) => {
    const count = parseInt(simCount, 10);
    if (isNaN(count) || count <= 0) return;

    setActionLoading(`simulate-${dropId}`);
    setSimResults(null);
    
    try {
      const res = await fetch('/api/admin/simulate', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': 'burst-admin-secret' 
        },
        body: JSON.stringify({ dropId, count, waves: 3 })
      });
      
      const data = await res.json();
      if (res.ok) {
        setSimResults(data);
        await loadDrops();
      } else {
        showAlert('Simulation Failed', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Error running simulation');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulate = (dropId: string) => {
    setModalState({
      isOpen: true,
      title: 'Simulate Traffic',
      message: 'How many bot/user claims to simulate?',
      type: 'prompt',
      onConfirm: () => executeSimulate(dropId),
    });
  };

  const handleCleanup = async (dropId: string) => {
    setActionLoading(`cleanup-${dropId}`);
    try {
      const res = await fetch('/api/admin/cleanup-drop', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': 'burst-admin-secret' 
        },
        body: JSON.stringify({ dropId })
      });
      
      const data = await res.json();
      if (res.ok) {
        showAlert('Cleanup Complete', `Released ${data.releasedCount} expired reservations back to inventory.`);
        await loadDrops();
      } else {
        showAlert('Cleanup Failed', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Error running cleanup');
    } finally {
      setActionLoading(null);
    }
  };

  const executeSeed = async () => {
    setActionLoading('seed');
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { 'x-admin-key': 'burst-admin-secret' }
      });
      const data = await res.json();
      if (res.ok) {
        showAlert('Seeded Successfully', `${data.drops} drops, ${data.queueEntries} queue entries.`);
        await loadDrops();
      } else {
        showAlert('Seed Failed', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error(err);
      showAlert('Error', 'Error running seed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSeed = () => {
    setModalState({
      isOpen: true,
      title: 'Demo Seed',
      message: 'Run full demo data seed? This might take 30-60 seconds and create lots of DB items.',
      type: 'confirm',
      onConfirm: executeSeed,
    });
  };

 return (
 <div className={styles.page}>
 <div className="container">
 <header className={styles.header}>
 <div>
 <h1 className={styles.title}>Admin Panel</h1>
 <p className={styles.subtitle}>Manage drops and run simulations.</p>
 </div>
 <button 
 className="btn btn-secondary" 
 onClick={handleSeed}
 disabled={!!actionLoading}
 >
 {actionLoading === 'seed' ? 'Seeding...' : ' Run Full Demo Seed'}
 </button>
 </header>

 {simResults && (
 <div className={styles.simResults}>
 <h3>Simulation Complete</h3>
 <div className={styles.simStats}>
 <div className={styles.simStat}>
 <span className="mono">{simResults.totalAttempts}</span>
 <label>Attempts</label>
 </div>
 <div className={styles.simStat}>
 <span className="mono" style={{color: 'var(--accent-success)'}}>{simResults.successfulClaims}</span>
 <label>Succeeded</label>
 </div>
 <div className={styles.simStat}>
 <span className="mono" style={{color: 'var(--accent-danger)'}}>{simResults.soldOut}</span>
 <label>Sold Out</label>
 </div>
 <div className={styles.simStat}>
 <span className="mono" style={{color: 'var(--accent-warning)'}}>{simResults.duplicate}</span>
 <label>Duplicates</label>
 </div>
 </div>
 <button className="btn btn-secondary" onClick={() => setSimResults(null)}>Dismiss</button>
 </div>
 )}

 {loading ? (
 <div className={styles.tableWrapper}>
 <table className={styles.table}>
 <thead>
 <tr>
 <th>Drop</th>
 <th>Status</th>
 <th>Inventory</th>
 <th>Price</th>
 <th style={{ textAlign: 'right' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {[1, 2, 3].map(i => (
 <tr key={i}>
 <td>
 <div className={styles.dropCell}>
 <div className="skeleton" style={{ width: 48, height: 48, borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
 <div>
 <div className="skeleton" style={{ width: 160, height: 14, borderRadius: 'var(--radius-sm)', marginBottom: 6 }} />
 <div className="skeleton" style={{ width: 100, height: 10, borderRadius: 'var(--radius-sm)' }} />
 </div>
 </div>
 </td>
 <td><div className="skeleton" style={{ width: 70, height: 22, borderRadius: 'var(--radius-full)' }} /></td>
 <td><div className="skeleton" style={{ width: 40, height: 14, borderRadius: 'var(--radius-sm)' }} /></td>
 <td><div className="skeleton" style={{ width: 60, height: 14, borderRadius: 'var(--radius-sm)' }} /></td>
 <td style={{ textAlign: 'right' }}>
 <div className="skeleton" style={{ width: 60, height: 26, borderRadius: 'var(--radius-md)', marginLeft: 'auto' }} />
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 ) : (
 <div className={styles.tableWrapper}>
 <table className={styles.table}>
 <thead>
 <tr>
 <th>Drop</th>
 <th>Status</th>
 <th>Inventory</th>
 <th>Price</th>
 <th style={{ textAlign: 'right' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {drops.length === 0 && (
 <tr>
 <td colSpan={5} style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
 No drops found. Try running the demo seed!
 </td>
 </tr>
 )}
 {drops.map(drop => (
 <tr key={drop.dropId}>
 <td>
 <div className={styles.dropCell}>
 <img src={drop.imageUrl} alt={drop.title} className={styles.thumbnail} />
 <div>
 <strong>{drop.title}</strong>
 <div className={styles.dropId} title={drop.dropId}>ID: {drop.dropId.slice(0, 10)}...</div>
 </div>
 </div>
 </td>
 <td>
 <span className={`badge badge-${drop.status.replace('_', '-')}`}>
 {drop.status}
 </span>
 </td>
 <td className="mono">{drop.totalInventory}</td>
 <td className="mono">${(drop.price / 100).toFixed(2)}</td>
 <td style={{ textAlign: 'right' }}>
 <div className={styles.actions}>
 <Link href={`/drop/${drop.dropId}`} className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}>
 View
 </Link>
 {drop.status === 'upcoming' && (
 <button 
 className="btn btn-primary" 
 style={{ padding: '4px 12px', fontSize: '0.8rem' }}
 onClick={() => handleActivate(drop.dropId)}
 disabled={!!actionLoading}
 >
 {actionLoading === `activate-${drop.dropId}` ? '...' : 'Activate'}
 </button>
 )}
 {drop.status === 'live' && (
 <button 
 className="btn btn-secondary" 
 style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--accent-warning)' }}
 onClick={() => handleSimulate(drop.dropId)}
 disabled={!!actionLoading}
 >
 {actionLoading === `simulate-${drop.dropId}` ? '...' : 'Simulate Traffic'}
 </button>
 )}
 {(drop.status === 'live' || drop.status === 'sold_out') && (
 <button 
 className="btn btn-secondary" 
 style={{ padding: '4px 12px', fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: 'var(--accent-success)' }}
 onClick={() => handleCleanup(drop.dropId)}
 disabled={!!actionLoading}
 title="Releases expired 10-minute reservations back into inventory"
 >
 {actionLoading === `cleanup-${drop.dropId}` ? '...' : 'Cleanup Expired'}
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>
      <Modal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={modalState.onConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      >
        {modalState.type === 'prompt' && (
          <div style={{ marginTop: '1rem' }}>
            <input
              type="number"
              className="input"
              style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white' }}
              value={simCount}
              onChange={e => setSimCount(e.target.value)}
              min="1"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
