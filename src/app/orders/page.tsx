'use client';

import { useEffect, useState } from 'react';
import { useUserId } from '@/lib/hooks';
import Link from 'next/link';
import type { Reservation, Drop } from '@/lib/types';
import styles from './page.module.css';

type OrderItem = Reservation & { drop: Drop | null };

export default function OrdersPage() {
  const userId = useUserId();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!userId) return;

    fetch(`/api/orders?userId=${encodeURIComponent(userId)}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch orders');
        return res.json();
      })
      .then(data => {
        setOrders(data.orders);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load your orders.');
        setLoading(false);
      });
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <h1 className={styles.title}>Order History</h1>
          <div className="skeleton" style={{ height: 100, width: '100%', borderRadius: 'var(--radius-lg)' }} />
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(orders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedOrders = orders.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Order History</h1>
        
        {error && <div className={styles.error}>{error}</div>}

        {orders.length === 0 && !error ? (
          <div className={styles.emptyState}>
            <p>You haven&apos;t claimed any drops yet.</p>
            <Link href="/" className="btn btn-primary">
              Browse Drops
            </Link>
          </div>
        ) : (
          <div className={styles.orderList}>
            {paginatedOrders.map(order => {
              const isConfirmed = order.status === 'confirmed';
              return (
                <div key={order.reservationId} className={styles.orderCard}>
                  {order.drop && (
                    <img 
                      src={order.drop.imageUrl} 
                      alt={order.drop.title} 
                      className={styles.orderImage} 
                    />
                  )}
                  <div className={styles.orderDetails}>
                    <h2 className={styles.orderTitle}>
                      {order.drop ? order.drop.title : 'Unknown Drop'}
                    </h2>
                    <p className={styles.orderMeta}>
                      <span>Reservation ID:</span> {order.reservationId.slice(0, 8)}...
                    </p>
                    <p className={styles.orderMeta}>
                      <span>Date:</span> {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={styles.orderStatusContainer}>
                    <span className={`${styles.statusBadge} ${isConfirmed ? styles.statusConfirmed : styles.statusPending}`}>
                      {isConfirmed ? 'Paid & Confirmed' : 'Payment Pending'}
                    </span>
                    <Link href={`/drop/${order.dropId}`} className="btn btn-secondary">
                      View Drop
                    </Link>
                  </div>
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button 
                  className="btn btn-secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {totalPages}
                </span>
                <button 
                  className="btn btn-secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
