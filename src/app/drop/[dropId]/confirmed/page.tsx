'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import styles from './page.module.css';

import { Suspense } from 'react';

function ConfirmedContent() {
 const params = useParams();
 const searchParams = useSearchParams();
 const dropId = params.dropId as string;
 const sessionId = searchParams.get('session_id');
 const [showConfetti, setShowConfetti] = useState(true);
 const [isMounted, setIsMounted] = useState(false);

 useEffect(() => {
    setIsMounted(true);
    const timer = setTimeout(() => setShowConfetti(false), 5000);

    // Verify session to confirm reservation in DB locally without relying on webhooks
    if (sessionId) {
      fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      }).catch(console.error);
    }

    return () => clearTimeout(timer);
 }, [sessionId]);

 return (
 <div className={styles.page}>
 {/* Confetti animation */}
 {isMounted && showConfetti && (
 <div className={styles.confettiContainer}>
 {Array.from({ length: 40 }).map((_, i) => (
 <div
 key={i}
 className={styles.confetti}
 style={{
 left: `${Math.random() * 100}%`,
 animationDelay: `${Math.random() * 2}s`,
 animationDuration: `${2 + Math.random() * 3}s`,
 backgroundColor: ['#f97316', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][
 Math.floor(Math.random() * 6)
 ],
 width: `${6 + Math.random() * 8}px`,
 height: `${6 + Math.random() * 8}px`,
 }}
 />
 ))}
 </div>
 )}

 <div className={styles.container}>
 <div className={styles.card}>
 {/* Success Icon */}
 <div className={styles.successIcon}>
 <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 </div>

 <h1 className={styles.title}>You&apos;re In! </h1>
 <p className={styles.subtitle}>
 Your spot has been confirmed and payment processed successfully.
 </p>

 {/* Order Details */}
 <div className={styles.details}>
 <div className={styles.detailRow}>
 <span className={styles.detailLabel}>Status</span>
 <span className="badge badge-live" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-success)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
 CONFIRMED
 </span>
 </div>
 <div className={styles.detailRow}>
 <span className={styles.detailLabel}>Drop ID</span>
 <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
 {dropId.slice(0, 16)}...
 </span>
 </div>
 {sessionId && (
 <div className={styles.detailRow}>
 <span className={styles.detailLabel}>Payment Ref</span>
 <span className="mono" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
 {sessionId.slice(0, 20)}...
 </span>
 </div>
 )}
 </div>

 {/* Actions */}
 <div className={styles.actions}>
 <Link href={`/drop/${dropId}/report`} className="btn btn-secondary">
 View Drop Report
 </Link>
 <Link href="/" className="btn btn-primary">
 Browse More Drops
 </Link>
 </div>
 </div>
 </div>
 </div>
 );
}

export default function ConfirmedPage() {
  return (
    <Suspense fallback={<div style={{ color: 'white', padding: '2rem', textAlign: 'center' }}>Loading...</div>}>
      <ConfirmedContent />
    </Suspense>
  );
}
