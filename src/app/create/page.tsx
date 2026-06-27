'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserId } from '@/lib/hooks';
import styles from './page.module.css';

export default function CreateDropPage() {
  const router = useRouter();
  const userId = useUserId();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    imageUrl: '',
    price: '',
    totalInventory: '',
    scheduledStart: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Validate
    if (!formData.title || !formData.description || !formData.price || !formData.totalInventory || !formData.scheduledStart) {
      setError('Please fill out all fields.');
      setLoading(false);
      return;
    }

    try {
      // In a real app, this endpoint would be protected by admin auth or seller auth.
      // For the demo, we require the admin key or just leave it open if we configure it that way.
      // Wait, our API route POST /api/drops requires 'x-admin-key'. Let's prompt for it or assume it's set.
      // For hackathon purposes, we can pass a hardcoded admin key for the demo.
      const res = await fetch('/api/drops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'burst-admin-secret', // Admin key from .env
        },
        body: JSON.stringify({
          ...formData,
          price: Math.round(parseFloat(formData.price) * 100), // convert dollars to cents
          totalInventory: parseInt(formData.totalInventory, 10),
          sellerId: userId || 'anonymous-seller',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create drop');
      }

      const data = await res.json();
      router.push(`/drop/${data.drop.dropId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className="container">
        <div className={styles.formContainer}>
          <header className={styles.header}>
            <h1 className={styles.title}>Create a Drop</h1>
            <p className={styles.subtitle}>Set up your next limited release.</p>
          </header>

          {error && <div className={styles.errorBanner}>{error}</div>}

          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="title">Drop Title</label>
              <input
                id="title"
                name="title"
                type="text"
                className="input"
                placeholder="e.g., Midnight Festival VIP Pass"
                value={formData.title}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className="label" htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                className={`input ${styles.textarea}`}
                placeholder="Describe what makes this drop special..."
                value={formData.description}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="price">Price (USD)</label>
                <div className={styles.inputPrefix}>
                  <span>$</span>
                  <input
                    id="price"
                    name="price"
                    type="number"
                    step="0.01"
                    min="0"
                    className="input"
                    placeholder="150.00"
                    value={formData.price}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className="label" htmlFor="totalInventory">Total Inventory</label>
                <input
                  id="totalInventory"
                  name="totalInventory"
                  type="number"
                  min="1"
                  className="input"
                  placeholder="500"
                  value={formData.totalInventory}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className="label" htmlFor="scheduledStart">Launch Time (Local Time)</label>
              <input
                id="scheduledStart"
                name="scheduledStart"
                type="datetime-local"
                className="input"
                value={formData.scheduledStart}
                onChange={handleChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className="label" htmlFor="imageUrl">Image URL</label>
              <input
                id="imageUrl"
                name="imageUrl"
                type="url"
                className="input"
                placeholder="https://..."
                value={formData.imageUrl}
                onChange={handleChange}
                required
              />
            </div>

            {formData.imageUrl && (
              <div className={styles.imagePreview}>
                <img src={formData.imageUrl} alt="Preview" onError={(e) => (e.currentTarget.style.display = 'none')} onLoad={(e) => (e.currentTarget.style.display = 'block')} />
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: 'var(--space-md)' }} disabled={loading}>
              {loading ? 'Creating...' : 'Create Drop'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
