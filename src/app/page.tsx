'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fetchDrops } from '@/lib/hooks';
import type { Drop } from '@/lib/types';
import styles from './page.module.css';

function formatPrice(cents: number): string {
 return `$${(cents / 100).toFixed(0)}`;
}

function getTimeLabel(drop: Drop): string {
 const now = Date.now();
 const start = new Date(drop.scheduledStart).getTime();
 const diff = start - now;

 if (drop.status === 'live') return 'LIVE NOW';
 if (drop.status === 'sold_out') return 'SOLD OUT';
 if (drop.status === 'completed') return 'COMPLETED';

 if (diff <= 0) return 'Starting soon';
 if (diff < 60000) return `${Math.ceil(diff / 1000)}s`;
 if (diff < 3600000) return `${Math.ceil(diff / 60000)}m`;
 if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
 return `${Math.round(diff / 86400000)}d`;
}

/* ---- Featured Hero Drop (first live drop) ---- */
function FeaturedDrop({ drop }: { drop: Drop }) {
 return (
 <Link href={`/drop/${drop.dropId}`} className={styles.featured}>
 <div className={styles.featuredGlow} />
 <div className={styles.featuredImageWrap}>
 <img src={drop.imageUrl} alt={drop.title} className={styles.featuredImage} />
 <div className={styles.featuredImageOverlay} />
 </div>
 <div className={styles.featuredContent}>
 <div className={styles.featuredMeta}>
 <span className={`badge badge-live ${styles.featuredBadge}`}>
 <span className="live-dot" />
 LIVE NOW
 </span>
 <span className={styles.featuredInventory}>
 {drop.totalInventory} units
 </span>
 </div>
 <h2 className={styles.featuredTitle}>{drop.title}</h2>
 <p className={styles.featuredDesc}>{drop.description}</p>
 <div className={styles.featuredFooter}>
 <span className={styles.featuredPrice}>{formatPrice(drop.price)}</span>
 <span className={styles.featuredCTA}>
 Claim Your Spot →
 </span>
 </div>
 </div>
 </Link>
 );
}

/* ---- Compact Drop Card ---- */
function DropCard({ drop, index }: { drop: Drop; index: number }) {
 const statusClass = drop.status === 'live' ? styles.cardLive :
 drop.status === 'sold_out' ? styles.cardSoldOut :
 drop.status === 'upcoming' ? styles.cardUpcoming :
 styles.cardCompleted;

 const badgeClass = drop.status === 'live' ? 'badge-live' :
 drop.status === 'sold_out' ? 'badge-sold-out' :
 drop.status === 'upcoming' ? 'badge-upcoming' :
 'badge-completed';

 const href = drop.status === 'sold_out' || drop.status === 'completed'
 ? `/drop/${drop.dropId}/report`
 : `/drop/${drop.dropId}`;

 return (
 <Link href={href} className={`${styles.card} ${statusClass}`} style={{ animationDelay: `${index * 80}ms` }}>
 <div className={styles.cardImage}>
 <img
 src={drop.imageUrl}
 alt={drop.title}
 className={styles.cardImg}
 />
 <div className={styles.cardImageOverlay} />
 <div className={styles.cardBadgeWrap}>
 <span className={`badge ${badgeClass}`}>
 {drop.status === 'live' && <span className="live-dot" />}
 {getTimeLabel(drop)}
 </span>
 </div>
 </div>
 <div className={styles.cardBody}>
 <h3 className={styles.cardTitle}>{drop.title}</h3>
 <p className={styles.cardDescription}>{drop.description}</p>
 <div className={styles.cardFooter}>
 <span className={styles.cardPrice}>{formatPrice(drop.price)}</span>
 <span className={styles.cardInventory}>
 {drop.totalInventory} units
 </span>
 </div>
 </div>
 </Link>
 );
}

export default function HomePage() {
 const [drops, setDrops] = useState<Drop[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadDrops = useCallback(async () => {
 try {
 const data = await fetchDrops();
 setDrops(data);
 setError(null);
 } catch (err) {
 setError('Failed to load drops');
 console.error(err);
 } finally {
 setLoading(false);
 }
 }, []);

 useEffect(() => {
 loadDrops();
 const interval = setInterval(loadDrops, 10000);
 return () => clearInterval(interval);
 }, [loadDrops]);

 const liveDrops = drops.filter(d => d.status === 'live');
 const upcomingDrops = drops.filter(d => d.status === 'upcoming');
 const pastDrops = drops.filter(d => d.status === 'sold_out' || d.status === 'completed');

 const featuredDrop = liveDrops[0];
 const otherLiveDrops = liveDrops.slice(1);

 return (
 <div className={styles.page}>
 {/* Ambient background elements */}
 <div className={styles.bgOrb1} />
 <div className={styles.bgOrb2} />
 <div className={styles.bgOrb3} />

 {/* Hero Section */}
 <section className={styles.hero}>
 <div className="container">
 <div className={styles.heroContent}>
 <div className={styles.heroBadge}>
 <span className={styles.heroBadgeDot} />
 <span>Powered by DynamoDB TransactWriteItems</span>
 </div>
 <h1 className={styles.heroTitle}>
 Every drop.<br />
 <span className="text-gradient">Transparent.</span><br />
 Fair. Real-time.
 </h1>
 <p className={styles.heroSubtitle}>
 The only drop platform that shows you exactly what happened.
 Live inventory, real-time queue position, and full transparency reports.
 </p>
 <div className={styles.heroActions}>
 <Link href={featuredDrop ? `/drop/${featuredDrop.dropId}` : '/create'} className={`btn btn-primary btn-lg ${styles.heroCTA}`}>
 {featuredDrop ? ' View Live Drop' : '+ Create First Drop'}
 </Link>
 <Link href="#how-it-works" className={`btn btn-secondary btn-lg ${styles.heroSecondary}`}>
 How It Works
 </Link>
 </div>
 </div>

 {/* Stats Strip */}
 <div className={styles.statsStrip}>
 <div className={styles.statCard}>
 <span className={`${styles.statValue} mono`}>0%</span>
 <span className={styles.statLabel}>Oversell rate</span>
 </div>
 <div className={styles.statCard}>
 <span className={`${styles.statValue} mono`}>{'<'}1s</span>
 <span className={styles.statLabel}>Claim latency</span>
 </div>
 <div className={styles.statCard}>
 <span className={`${styles.statValue} mono`}>100%</span>
 <span className={styles.statLabel}>Transparent</span>
 </div>
 <div className={styles.statCard}>
 <span className={`${styles.statValue} mono`}>{drops.length}</span>
 <span className={styles.statLabel}>Total drops</span>
 </div>
 </div>
 </div>
 </section>

 {/* Featured Live Drop — Large Hero Card */}
 {featuredDrop && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.sectionHeader}>
 <h2 className={styles.sectionTitle}>
 <span className="live-dot" />
 Featured Drop
 </h2>
 <p className={styles.sectionSubtitle}>Don&apos;t miss this — claim your spot now</p>
 </div>
 <FeaturedDrop drop={featuredDrop} />
 </div>
 </section>
 )}

 {/* Other Live Drops */}
 {otherLiveDrops.length > 0 && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.sectionHeader}>
 <div className={styles.sectionTitleRow}>
 <h2 className={styles.sectionTitle}>
 <span className="live-dot" />
 Live Now
 </h2>
 <span className={styles.dropCount}>{otherLiveDrops.length} active</span>
 </div>
 <p className={styles.sectionSubtitle}>Active drops — claim your spot before they sell out</p>
 </div>
 <div className={styles.grid}>
 {otherLiveDrops.map((drop, i) => (
 <DropCard key={drop.dropId} drop={drop} index={i} />
 ))}
 </div>
 </div>
 </section>
 )}

 {/* Upcoming Drops */}
 {upcomingDrops.length > 0 && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.sectionHeader}>
 <div className={styles.sectionTitleRow}>
 <h2 className={styles.sectionTitle}> Upcoming Drops</h2>
 <span className={styles.dropCount}>{upcomingDrops.length} scheduled</span>
 </div>
 <p className={styles.sectionSubtitle}>Get ready — these go live soon</p>
 </div>
 <div className={styles.grid}>
 {upcomingDrops.map((drop, i) => (
 <DropCard key={drop.dropId} drop={drop} index={i} />
 ))}
 </div>
 </div>
 </section>
 )}

 {/* Past Drops (with Drop Reports) */}
 {pastDrops.length > 0 && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.sectionHeader}>
 <div className={styles.sectionTitleRow}>
 <h2 className={styles.sectionTitle}> Drop Reports</h2>
 <span className={styles.dropCount}>{pastDrops.length} completed</span>
 </div>
 <p className={styles.sectionSubtitle}>Full transparency — see exactly what happened</p>
 </div>
 <div className={styles.grid}>
 {pastDrops.map((drop, i) => (
 <DropCard key={drop.dropId} drop={drop} index={i} />
 ))}
 </div>
 </div>
 </section>
 )}

 {/* Loading State — Shimmer Skeletons */}
 {loading && (
 <section className={styles.section}>
 <div className="container">
 <div className="skeleton" style={{ width: 180, height: 24, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-lg)' }} />
 <div className={styles.grid}>
 {[1, 2, 3].map(i => (
 <div key={i} className={styles.card} style={{ overflow: 'hidden', pointerEvents: 'none' }}>
 <div className={styles.cardImage}>
 <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 0 }} />
 </div>
 <div className={styles.cardBody}>
 <div className="skeleton" style={{ width: '40%', height: 14, borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: '85%', height: 18, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: '55%', height: 14, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }} />
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div className="skeleton" style={{ width: '30%', height: 20, borderRadius: 'var(--radius-sm)' }} />
 <div className="skeleton" style={{ width: '25%', height: 14, borderRadius: 'var(--radius-sm)' }} />
 </div>
 </div>
 </div>
 ))}
 </div>
 </div>
 </section>
 )}

 {/* Error State */}
 {error && !loading && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.errorState}>
 <p> {error}</p>
 <button className="btn btn-secondary" onClick={loadDrops}>Try Again</button>
 </div>
 </div>
 </section>
 )}

 {/* Empty State */}
 {!loading && !error && drops.length === 0 && (
 <section className={styles.section}>
 <div className="container">
 <div className={styles.emptyState}>
 <div className={styles.emptyIcon}></div>
 <h3>No drops yet</h3>
 <p>Check back soon or create your first drop.</p>
 <Link href="/create" className="btn btn-primary">
 Create a Drop
 </Link>
 </div>
 </div>
 </section>
 )}

 {/* How It Works */}
 <section className={styles.section} id="how-it-works">
 <div className="container">
 <div className={styles.sectionHeader} style={{ textAlign: 'center' }}>
 <h2 className={styles.sectionTitle} style={{ justifyContent: 'center' }}>How Burst Works</h2>
 <p className={styles.sectionSubtitle}>Fair by design, not by promise</p>
 </div>
 <div className={styles.howItWorks}>
 <div className={styles.step}>
 <div className={styles.stepIcon}></div>
 <div className={styles.stepNumber}>01</div>
 <h4>Drop Goes Live</h4>
 <p>Inventory counter starts. You see exactly how many units remain in real-time.</p>
 </div>
 <div className={styles.stepConnector}>
 <div className={styles.stepConnectorLine} />
 </div>
 <div className={styles.step}>
 <div className={styles.stepIcon}></div>
 <div className={styles.stepNumber}>02</div>
 <h4>Claim Your Spot</h4>
 <p>One atomic transaction checks inventory, reserves your unit, and assigns your queue position — all in under 1 second.</p>
 </div>
 <div className={styles.stepConnector}>
 <div className={styles.stepConnectorLine} />
 </div>
 <div className={styles.step}>
 <div className={styles.stepIcon}></div>
 <div className={styles.stepNumber}>03</div>
 <h4>Transparency Report</h4>
 <p>After every drop, see exactly how inventory moved, where buyers were, and how many bot attempts were blocked.</p>
 </div>
 </div>
 </div>
 </section>

 {/* Tech Stack Footer */}
 <section className={styles.techFooter}>
 <div className="container">
 <div className={styles.techGrid}>
 <div className={styles.techItem}>
 <span className={styles.techIcon}>▲</span>
 <span>Next.js 15</span>
 </div>
 <div className={styles.techItem}>
 <span className={styles.techIcon}></span>
 <span>DynamoDB</span>
 </div>
 <div className={styles.techItem}>
 <span className={styles.techIcon}></span>
 <span>NextAuth</span>
 </div>
 <div className={styles.techItem}>
 <span className={styles.techIcon}></span>
 <span>Stripe</span>
 </div>
 </div>
 </div>
 </section>
 </div>
 );
}
