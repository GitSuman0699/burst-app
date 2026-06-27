'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from './Navbar.module.css';
import { Modal } from './Modal';

export function Navbar() {
 const pathname = usePathname();
 const { data: session, status } = useSession();

 const [dropdownOpen, setDropdownOpen] = useState(false);
 const [logoutModalOpen, setLogoutModalOpen] = useState(false);

 return (
 <nav className={styles.nav}>
 <div className={styles.container}>
 <Link href="/" className={styles.logo}>
 <span className={styles.logoIcon}></span>
 <span className={styles.logoText}>Burst</span>
 </Link>

 <div className={styles.links}>
 <Link
 href="/"
 className={`${styles.link} ${pathname === '/' ? styles.active : ''}`}
 >
 Drops
 </Link>
 <Link
 href="/create"
 className={`${styles.link} ${pathname === '/create' ? styles.active : ''}`}
 >
 Create
 </Link>
 <Link
 href="/admin"
 className={`${styles.link} ${pathname === '/admin' ? styles.active : ''}`}
 >
 Admin
 </Link>

 {/* Auth Section */}
 {status === 'loading' ? (
 <div className="skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-full)' }} />
 ) : session?.user ? (
 <div className={styles.userSection}>
 <button 
    className={styles.avatarButton} 
    onClick={() => setDropdownOpen(!dropdownOpen)}
    onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
  >
    {session.user.image ? (
    <img
    src={session.user.image}
    alt={session.user.name || ''}
    className={styles.avatar}
    />
    ) : (
    <div className={styles.avatarFallback}>
    {(session.user.name || session.user.email || 'U')[0].toUpperCase()}
    </div>
    )}
  </button>
  
  {dropdownOpen && (
    <div className={styles.dropdown}>
      <Link href="/orders" className={styles.dropdownItem}>
        Order History
      </Link>
      <button
        className={styles.dropdownItem}
        onClick={() => {
          setDropdownOpen(false);
          setLogoutModalOpen(true);
        }}
      >
        Sign Out
      </button>
    </div>
  )}
  </div>
 ) : (
 <Link
 href="/auth/signin"
 className={`btn btn-primary ${styles.signInBtn}`}
 >
 Sign In
 </Link>
 )}
 </div>
 </div>

 <Modal 
    isOpen={logoutModalOpen}
    onClose={() => setLogoutModalOpen(false)}
    onConfirm={() => signOut({ callbackUrl: '/' })}
    title="Sign Out"
    message="Are you sure you want to sign out?"
    type="confirm"
    confirmText="Sign Out"
  />
 </nav>
 );
}
