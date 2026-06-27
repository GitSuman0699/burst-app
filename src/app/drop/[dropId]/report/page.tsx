'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fetchReport } from '@/lib/hooks';
import type { DropReport } from '@/lib/types';
import { REGIONS, type RegionCode } from '@/lib/regions';
import styles from './page.module.css';

export default function DropReportPage() {
 const params = useParams();
 const dropId = params.dropId as string;

 const [report, setReport] = useState<DropReport | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const loadReport = useCallback(async () => {
 try {
 const data = await fetchReport(dropId);
 setReport(data);
 } catch (err) {
 setError('Failed to load drop report');
 } finally {
 setLoading(false);
 }
 }, [dropId]);

 useEffect(() => {
 window.scrollTo(0, 0);
 loadReport();
 }, [loadReport]);

 if (loading) {
 return (
 <div className={styles.page}>
 <div className="container">
 {/* Header skeleton */}
 <div style={{ textAlign: 'center', marginBottom: 'var(--space-2xl)' }}>
 <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 'var(--radius-sm)', margin: '0 auto var(--space-md)' }} />
 <div className="skeleton" style={{ width: 300, height: 36, borderRadius: 'var(--radius-sm)', margin: '0 auto var(--space-sm)' }} />
 <div className="skeleton" style={{ width: 200, height: 16, borderRadius: 'var(--radius-sm)', margin: '0 auto' }} />
 </div>
 {/* KPI grid skeleton */}
 <div className={styles.grid}>
 {/* Full-width Fairness Score card */}
 <div className={`${styles.card} ${styles.colFull}`} style={{ pointerEvents: 'none' }}>
 <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }} />
 <div className="skeleton" style={{ width: 120, height: 48, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }} />
 <div className="skeleton" style={{ width: '100%', height: 8, borderRadius: 'var(--radius-full)', marginBottom: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: 250, height: 14, borderRadius: 'var(--radius-sm)' }} />
 </div>
 {/* 3 smaller KPI cards */}
 {[1, 2, 3].map(i => (
 <div key={i} className={styles.card} style={{ pointerEvents: 'none' }}>
 <div className="skeleton" style={{ width: 100, height: 14, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-md)' }} />
 <div className="skeleton" style={{ width: 80, height: 36, borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-sm)' }} />
 <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 'var(--radius-sm)' }} />
 </div>
 ))}
 </div>
 </div>
 </div>
 );
 }

 if (error || !report) {
 return (
 <div className={styles.page}>
 <div className="container" style={{ textAlign: 'center', padding: '4rem 0' }}>
 <h2>Report not available</h2>
 <p style={{ color: 'var(--text-secondary)', margin: '1rem 0 2rem' }}>
 This drop might not exist, or the report hasn't been generated yet.
 </p>
 <Link href="/" className="btn btn-secondary">Back to Drops</Link>
 </div>
 </div>
 );
 }

 return (
 <div className={styles.page}>
 <div className="container">
 {/* Header */}
 <header className={styles.header}>
 <div className={styles.headerTop}>
 <Link href={`/drop/${dropId}`} className={styles.backLink}>
 ← Back to Drop
 </Link>
 <span className="badge badge-completed">Verified Report</span>
 </div>
 <h1 className={styles.title}>Transparency Report</h1>
 <p className={styles.subtitle}>{report.title}</p>
 </header>

 <div className={styles.grid}>
 {/* Main KPI: Fairness Score */}
 <div className={`${styles.card} ${styles.cardPrimary} ${styles.colFull}`}>
 <div className={styles.cardHeader}>
 <h3>Fairness Score</h3>
 <span className={styles.tooltip}>Unique users ÷ Total attempts. 100% means 0 bot retries.</span>
 </div>
 <div className={styles.scoreContainer}>
 <div className={`${styles.scoreValue} mono`}>{report.fairnessScore}%</div>
 <div className={styles.scoreBar}>
 <div 
 className={styles.scoreBarFill} 
 style={{ width: `${report.fairnessScore}%`, background: report.fairnessScore > 90 ? 'var(--accent-success)' : 'var(--accent-warning)' }} 
 />
 </div>
 </div>
 <p className={styles.scoreLabel}>
 {report.uniqueUsers} unique users made {report.totalAttempts} total attempts
 </p>
 </div>

 {/* KPI: Sales Velocity */}
 <div className={styles.card}>
 <h3 className={styles.cardTitle}>Sales Velocity</h3>
 <div className={styles.kpiValue}>
 <span className="mono">{report.successfulClaims}</span>
 <span className={styles.kpiSuffix}>/{report.totalInventory}</span>
 </div>
 <p className={styles.kpiLabel}>Units claimed</p>
 </div>

 {/* KPI: Peak Traffic */}
 <div className={styles.card}>
 <h3 className={styles.cardTitle}>Peak Traffic</h3>
 <div className={styles.kpiValue}>
 <span className="mono">{report.peakSecond.attempts}</span>
 <span className={styles.kpiSuffix}>req/sec</span>
 </div>
 <p className={styles.kpiLabel}>
 At {new Date(report.peakSecond.timestamp).toLocaleTimeString()}
 </p>
 </div>

 {/* KPI: Blocks / Rejects */}
 <div className={styles.card}>
 <h3 className={styles.cardTitle}>Rejected Attempts</h3>
 <div className={styles.kpiValue}>
 <span className="mono" style={{ color: 'var(--accent-warning)' }}>
 {report.failedDuplicate + report.failedSoldOut}
 </span>
 </div>
 <ul className={styles.rejectList}>
 <li><span className="mono">{report.failedDuplicate}</span> duplicate blocks</li>
 <li><span className="mono">{report.failedSoldOut}</span> sold-out rejects</li>
 </ul>
 </div>

 {/* Geographic Breakdown */}
 <div className={`${styles.card} ${styles.colHalf}`}>
 <h3 className={styles.cardTitle}>Geographic Distribution</h3>
 <div className={styles.geoList}>
 {report.regionBreakdown.map(region => {
 const regionInfo = REGIONS[region.region as RegionCode] || { name: region.region, color: '#888', emoji: '' };
 return (
 <div key={region.region} className={styles.geoItem}>
 <div className={styles.geoLabel}>
 <span>{regionInfo.emoji}</span>
 <span>{regionInfo.name}</span>
 </div>
 <div className={styles.geoBarContainer}>
 <div className={styles.geoBar}>
 <div 
 className={styles.geoBarFill} 
 style={{ width: `${region.percentage}%`, backgroundColor: regionInfo.color }}
 />
 </div>
 <span className={`${styles.geoValue} mono`}>{region.percentage}%</span>
 </div>
 </div>
 );
 })}
 </div>
 </div>

 {/* Inventory Timeline */}
 <div className={`${styles.card} ${styles.colHalf}`}>
 <h3 className={styles.cardTitle}>Inventory Depletion Timeline</h3>
 <div className={styles.timeline}>
 <div className={styles.timelineGraph}>
 {report.inventoryTimeline.length > 0 ? (
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.svgGraph}>
 <polyline
 fill="none"
 stroke="var(--accent-primary)"
 strokeWidth="2"
 points={report.inventoryTimeline.map((pt, i, arr) => {
 const x = (i / (arr.length - 1 || 1)) * 100;
 const y = 100 - ((pt.remaining / report.totalInventory) * 100);
 return `${x},${y}`;
 }).join(' ')}
 />
 </svg>
 ) : (
 <div className={styles.timelineEmpty}>Not enough data to plot</div>
 )}
 </div>
 <div className={styles.timelineLabels}>
 <span>Drop Start</span>
 <span>Sold Out</span>
 </div>
 </div>
 </div>
 </div>

 {/* Verifiable Guarantee */}
 <div className={styles.guaranteeBox}>
 <h4> Verifiable Guarantee</h4>
 <p>
 This report is generated from raw DynamoDB TransactWriteItems logs. Every claim attempt represents an atomic transaction. 
 The system mathematically prevents overselling—when inventory hits 0, the database rejects the transaction at the infrastructure level.
 </p>
 </div>
 </div>
 </div>
 );
}
