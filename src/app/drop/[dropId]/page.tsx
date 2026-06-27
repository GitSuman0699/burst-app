'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useUserId, useAuthStatus, fetchDrop, fetchInventory, claimDrop } from '@/lib/hooks';
import { detectUserRegion } from '@/lib/regions';
import type { Drop, Inventory, Reservation } from '@/lib/types';
import styles from './page.module.css';

function formatPrice(cents: number): string {
 return `$${(cents / 100).toFixed(2)}`;
}

function formatCountdown(ms: number): string {
 if (ms <= 0) return '00:00:00';
 const hours = Math.floor(ms / 3600000);
 const minutes = Math.floor((ms % 3600000) / 60000);
 const seconds = Math.floor((ms % 60000) / 1000);
 return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function getProgressColor(percent: number): string {
 if (percent > 50) return 'var(--accent-success)';
 if (percent > 20) return 'var(--accent-warning)';
 return 'var(--accent-danger)';
}

type DropState = 'loading' | 'upcoming' | 'live' | 'claiming' | 'claimed' | 'confirmed' | 'sold_out' | 'expired' | 'error';

export default function DropPage() {
 const params = useParams();
 const dropId = params.dropId as string;
 const userId = useUserId();
 const { isAuthenticated, isLoading: authLoading } = useAuthStatus();
 const region = useRef<string>('NA');

 const [dropState, setDropState] = useState<DropState>('loading');
 const [drop, setDrop] = useState<Drop | null>(null);
 const [inventory, setInventory] = useState<Inventory | null>(null);
 const [reservation, setReservation] = useState<Reservation | null>(null);
 const [claimError, setClaimError] = useState<string | null>(null);
 const [countdown, setCountdown] = useState<number>(0);
 const [reservationCountdown, setReservationCountdown] = useState<number>(0);
 const prevInventoryRef = useRef<number | null>(null);
 const [inventoryDelta, setInventoryDelta] = useState(0);
 const [checkoutLoading, setCheckoutLoading] = useState(false);

 // Detect region on mount
 useEffect(() => {
 region.current = detectUserRegion();
 }, []);

 // Load drop data
 const loadDrop = useCallback(async () => {
 try {
 const data = await fetchDrop(dropId, userId);
 setDrop(data.drop);
 setInventory(data.inventory);

 if (data.drop.scheduledStart) {
   const diff = new Date(data.drop.scheduledStart).getTime() - Date.now();
   setCountdown(Math.max(0, diff));
 }

 // Track inventory changes for animation
 if (prevInventoryRef.current !== null && data.inventory.available < prevInventoryRef.current) {
 setInventoryDelta(prevInventoryRef.current - data.inventory.available);
 setTimeout(() => setInventoryDelta(0), 1000);
 }
 prevInventoryRef.current = data.inventory.available;

 let nextState: DropState = data.drop.status;
 if (data.inventory.available === 0 && data.drop.status !== 'upcoming') nextState = 'sold_out';
 if (data.drop.status === 'completed') nextState = 'sold_out';

 if (data.reservation) {
   if (data.reservation.status === 'confirmed') {
     nextState = 'confirmed';
   } else if (data.reservation.status === 'reserved') {
     const remainingMs = data.reservation.expiresAt * 1000 - Date.now();
     if (remainingMs > 0) {
       setReservation(data.reservation);
       setReservationCountdown(remainingMs);
       nextState = 'claimed';
     }
   }
 }

 setDropState(prev => {
 if (prev === 'claiming' || prev === 'error') return prev;
 return nextState;
 });
 } catch (err) {
 setDropState('error');
 console.error(err);
 }
 }, [dropId, userId]); // Include userId so it fetches reservation when user loads

 // Initial load — runs exactly once
 useEffect(() => {
 loadDrop();
 }, [loadDrop]);

 // Poll inventory during live drops
 useEffect(() => {
 if (dropState !== 'live' && dropState !== 'claimed' && dropState !== 'claiming' && dropState !== 'expired') return;

 const interval = setInterval(async () => {
 try {
 const inv = await fetchInventory(dropId);
 setInventory(inv);

 if (prevInventoryRef.current !== null && inv.available < prevInventoryRef.current) {
 setInventoryDelta(prevInventoryRef.current - inv.available);
 setTimeout(() => setInventoryDelta(0), 1000);
 }
 prevInventoryRef.current = inv.available;

 if (inv.available === 0) {
 setDropState(prev => prev === 'claimed' ? prev : 'sold_out');
 }
 } catch { }
 }, 1000);

 return () => clearInterval(interval);
 }, [dropId, dropState]);

 // Countdown for upcoming drops
 useEffect(() => {
 if (dropState !== 'upcoming' || !drop) return;
 let fired = false;

 const tick = async () => {
   const diff = new Date(drop.scheduledStart).getTime() - Date.now();
   setCountdown(Math.max(0, diff));

   // When countdown expires, auto-activate the drop and transition to live
   if (diff <= 0 && !fired) {
     fired = true;
     setDropState('live'); // Transition UI instantly
     
     // Auto-activate: set DB status to 'live'
     try {
       await fetch(`/api/drops/${dropId}/activate`, {
         method: 'POST',
         headers: { 'x-admin-key': 'burst-admin-secret' },
       });
     } catch {}

     // Background reload to sync
     loadDrop();
   }
 };

 // Run immediately, then set interval
 tick();
 const interval = setInterval(tick, 1000);
 return () => clearInterval(interval);
 }, [dropState, drop, loadDrop, dropId]);

 // Countdown for reservation TTL
 useEffect(() => {
 if (dropState !== 'claimed' || !reservation) return;
 const interval = setInterval(() => {
 const remaining = reservation.expiresAt * 1000 - Date.now();
 const newRemaining = Math.max(0, remaining);
 setReservationCountdown(newRemaining);

 if (newRemaining === 0) {
 setDropState('expired');
 clearInterval(interval);
 
 // Auto-release the spot on the backend
 fetch(`/api/drops/${dropId}/release`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ reservationId: reservation.reservationId }),
 }).catch(console.error);
 }
 }, 1000);
 return () => clearInterval(interval);
 }, [dropState, reservation]);

 // Handle claim
 const handleClaim = async () => {
 if (!userId) return;
 setDropState('claiming');
 setClaimError(null);

 try {
 const result = await claimDrop(dropId, userId, region.current);

 if (result.success) {
 setReservation(result.reservation);
 setDropState('claimed');
 setReservationCountdown(result.reservation.timeRemainingMs);
 } else {
 if (result.error === 'SOLD_OUT') {
 setDropState('sold_out');
 } else if (result.error === 'ALREADY_CLAIMED') {
 setClaimError('You already claimed this drop!');
 setDropState('live');
 } else {
 setClaimError(result.message || 'Something went wrong');
 setDropState('live');
 }
 }
 } catch {
 setClaimError('Network error. Please try again.');
 setDropState('live');
 }
 };

 if (dropState === 'loading' || !drop || !inventory) {
 return (
 <div className={styles.page}>
 <div className={styles.layout}>
 {/* Image skeleton */}
 <div className={styles.imageColumn}>
 <div className="skeleton" style={{ width: '100%', aspectRatio: '1', borderRadius: 'var(--radius-xl)' }} />
 </div>
 {/* Info skeleton */}
 <div className={styles.infoColumn}>
 <div className="skeleton" style={{ width: 80, height: 22, borderRadius: 'var(--radius-full)' }} />
 <div className="skeleton" style={{ width: '80%', height: 28, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: '100%', height: 14, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: '60%', height: 14, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-xs)' }} />
 <div className="skeleton" style={{ width: 120, height: 32, borderRadius: 'var(--radius-sm)', marginTop: 'var(--space-md)' }} />
 {/* Inventory skeleton */}
 <div style={{ padding: 'var(--space-lg)', background: 'var(--bg-card)', border: 'var(--border-subtle)', borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-md)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-md)' }}>
 <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 'var(--radius-sm)' }} />
 <div className="skeleton" style={{ width: 80, height: 24, borderRadius: 'var(--radius-sm)' }} />
 </div>
 <div className="skeleton" style={{ width: '100%', height: 8, borderRadius: 'var(--radius-full)' }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-sm)' }}>
 <div className="skeleton" style={{ width: 100, height: 12, borderRadius: 'var(--radius-sm)' }} />
 <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 'var(--radius-sm)' }} />
 </div>
 </div>
 {/* Button skeleton */}
 <div className="skeleton" style={{ width: '100%', height: 56, borderRadius: 'var(--radius-lg)', marginTop: 'var(--space-md)' }} />
 </div>
 </div>
 </div>
 );
 }

 if (dropState === 'error') {
 return (
 <div className={styles.page}>
 <div className={styles.errorContainer}>
 <h2>Drop not found</h2>
 <Link href="/" className="btn btn-secondary">Back to Drops</Link>
 </div>
 </div>
 );
 }

 return (
 <div className={styles.page}>
 <div className={styles.layout}>
 {/* Left: Product Image */}
 <div className={styles.imageColumn}>
 <div className={styles.imageWrapper}>
 <img src={drop.imageUrl} alt={drop.title} className={styles.productImage} />
 {dropState === 'sold_out' && (
 <div className={styles.soldOutOverlay}>
 <span>SOLD OUT</span>
 </div>
 )}
 </div>
 </div>

 {/* Right: Drop Info + Action */}
 <div className={styles.infoColumn}>
 {/* Status Badge — uses dropState for consistency with actions */}
 <div className={styles.statusRow}>
 {dropState === 'live' && (
 <span className="badge badge-live">
 <span className="live-dot" /> LIVE
 </span>
 )}
 {dropState === 'upcoming' && (
 <span className="badge badge-upcoming">UPCOMING</span>
 )}
 {(dropState === 'sold_out') && (
 <span className="badge badge-sold-out">SOLD OUT</span>
 )}
 </div>

 <h1 className={styles.title}>{drop.title}</h1>
 <p className={styles.description}>{drop.description}</p>
 <p className={styles.price}>{formatPrice(drop.price)}</p>

 {/* Inventory Bar */}
 <div className={styles.inventorySection}>
 <div className={styles.inventoryHeader}>
 <span className={styles.inventoryLabel}>
 {inventory.available > 0 ? 'Available' : 'Sold Out'}
 </span>
 <span className={`${styles.inventoryCount} mono`}>
 {inventory.available}
 <span className={styles.inventoryTotal}> / {inventory.total}</span>
 {inventoryDelta > 0 && (
 <span className={styles.inventoryDelta}>-{inventoryDelta}</span>
 )}
 </span>
 </div>
 <div className="progress-bar">
 <div
 className="progress-bar-fill"
 style={{
 width: `${inventory.percentRemaining}%`,
 backgroundColor: getProgressColor(inventory.percentRemaining),
 }}
 />
 </div>
 <div className={styles.inventoryMeta}>
 <span className={`mono ${styles.inventoryPercent}`} style={{ color: getProgressColor(inventory.percentRemaining) }}>
 {inventory.percentRemaining}% remaining
 </span>
 <span className={`mono ${styles.inventoryReserved}`}>
 {inventory.reserved} claimed
 </span>
 </div>
 </div>

 {/* Upcoming Countdown */}
 {dropState === 'upcoming' && (
 <div className={styles.countdownSection}>

 <p className={`${styles.countdownTimer} mono`}>{formatCountdown(countdown)}</p>

 </div>
 )}

 {/* Claim Button */}
 {dropState === 'live' && (
 <div className={styles.claimSection}>
 {authLoading ? (
 <button
 className={`${styles.claimButton} btn btn-primary btn-lg`}
 disabled
 >
 <span className="skeleton" style={{ width: 120, height: 20, borderRadius: 'var(--radius-sm)' }} />
 </button>
 ) : isAuthenticated ? (
 <button
 className={`${styles.claimButton} btn btn-primary btn-lg`}
 onClick={handleClaim}
 disabled={!userId}
 >
 Claim My Spot
 </button>
 ) : (
 <Link
 href={`/auth/signin?callbackUrl=/drop/${dropId}`}
 className={`${styles.claimButton} btn btn-primary btn-lg`}
 style={{ textAlign: 'center', textDecoration: 'none' }}
 >
 Sign in to Claim
 </Link>
 )}
 {claimError && (
 <p className={styles.claimError}>{claimError}</p>
 )}
 </div>
 )}

 {/* Claiming State */}
 {dropState === 'claiming' && (
 <div className={styles.claimSection}>
 <button className={`${styles.claimButton} btn btn-primary btn-lg`} disabled>
 <span className={styles.loadingSpinnerSmall} />
 Securing your spot...
 </button>
 </div>
 )}

 {/* Claimed Success */}
 {dropState === 'claimed' && reservation && (
 <div className={styles.claimedSection}>
 <div className={styles.claimedBadge}>
 <span className={styles.checkmark}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 </span>
 <span>Spot Secured!</span>
 </div>
 <div className={styles.reservationInfo}>
 <div className={styles.reservationRow}>
 <span>Queue Position</span>
 <span className={`mono ${styles.queuePosition}`}>
 #{reservation.queuePosition}
 </span>
 </div>
 <div className={styles.reservationRow}>
 <span>Reservation ID</span>
 <span className="mono">{reservation.reservationId.slice(0, 12)}...</span>
 </div>
 <div className={styles.reservationRow}>
 <span>Payment Window</span>
 <span className={`mono ${styles.paymentTimer}`}>
 {formatCountdown(reservationCountdown)}
 </span>
 </div>
 </div>
 {/* Stripe Checkout Button */}
 <button
 className={`btn btn-primary btn-lg`}
 style={{ width: '100%', fontSize: '1.1rem' }}
 disabled={checkoutLoading}
 onClick={async () => {
 setCheckoutLoading(true);
 try {
 const res = await fetch('/api/checkout', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 reservationId: reservation.reservationId,
 dropId,
 }),
 });
 const data = await res.json();
 if (data.checkoutUrl) {
 window.location.href = data.checkoutUrl;
 } else {
 setClaimError(data.error || 'Failed to start checkout');
 setCheckoutLoading(false);
 }
 } catch {
 setClaimError('Failed to start checkout');
 setCheckoutLoading(false);
 }
 }}
 >
 {checkoutLoading ? 'Redirecting to payment...' : ` Complete Purchase — ${formatPrice(drop.price)}`}
 </button>
 <p className={styles.reservationNote}>
 Complete payment within 10 minutes to confirm your purchase.
 </p>
 </div>
 )}

 {/* Confirmed Success (User already paid) */}
 {dropState === 'confirmed' && (
 <div className={styles.claimedSection}>
 <div className={styles.claimedBadge}>
 <span className={styles.checkmark}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="20 6 9 17 4 12" />
 </svg>
 </span>
 <span>Purchase Confirmed!</span>
 </div>
 <div style={{ marginTop: '1rem', textAlign: 'center' }}>
 <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>You have successfully secured and paid for your spot in this drop.</p>
 <Link href={`/drop/${dropId}/confirmed`} className="btn btn-secondary" style={{ width: '100%' }}>
   View Confirmation Receipt
 </Link>
 </div>
 </div>
 )}

 {/* Sold Out */}
 {dropState === 'sold_out' && (
 <div className={styles.soldOutSection}>
 <div className={styles.soldOutMessage}>
 <h3>You just missed it! </h3>
 <p>All {drop.totalInventory} units have been claimed.</p>
 </div>
 <Link
 href={`/drop/${dropId}/report`}
 className="btn btn-secondary"
 >
 View Drop Report
 </Link>
 </div>
 )}

 {/* Expired */}
 {dropState === 'expired' && (
 <div className={styles.expiredSection}>
 <div className={styles.expiredIcon}>️</div>
 <h3>Reservation Expired</h3>
 <p>You didn't complete payment within the 10-minute window, so your spot was released.</p>
 <Link href="/" className="btn btn-secondary" style={{ marginTop: 'var(--space-md)' }}>
 Back to Drops
 </Link>
 </div>
 )}

 {/* Report Link (always visible for completed/sold out) */}
 {(drop.status === 'sold_out' || drop.status === 'completed') && dropState !== 'sold_out' && (
 <Link
 href={`/drop/${dropId}/report`}
 className="btn btn-secondary"
 style={{ marginTop: 'var(--space-md)' }}
 >
 View Drop Report
 </Link>
 )}
 </div>
 </div>
 </div>
 );
}
