'use client';

import dynamic from 'next/dynamic';

const OS = dynamic(() => import('@/os/OS'), {
  ssr: false,
  loading: () => (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }} />
  ),
});

export default function Home() {
  return <OS />;
}
