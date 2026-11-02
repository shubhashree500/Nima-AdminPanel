'use client';

import { useState } from 'react';
import { DBData } from '@/types';
import { ProcessView } from './ProcessView';
import { VerifyView } from './VerifyView';
import { PublishView } from './PublishView';

type ProcessingTab = 'process' | 'verify' | 'publish';

const tabs: { id: ProcessingTab; label: string; description: string }[] = [
  { id: 'process', label: '1. Calculate Result', description: 'Enter student marks (individual or bulk) and compute results' },
  { id: 'verify', label: '2. Verify Result', description: 'Review calculation accuracy, stats, and audit checks' },
  { id: 'publish', label: '3. Publish Result', description: 'Officially publish verified results to the database' },
];

export function ResultProcessingView({ db }: { db?: DBData }) {
  const [activeTab, setActiveTab] = useState<ProcessingTab>('process');

  return (
    <section style={{ width: '100%' }}>
      {/* Step Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: 700 }}>
          Result Processing Pipeline
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted, #6b7280)', fontSize: '14px' }}>
          Follow the 3-step autonomous result workflow: Ingest marks &rarr; Compute grades &rarr; Verify calculation &rarr; Publish officially to database.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Result processing steps"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px',
          marginBottom: '24px',
          padding: '8px',
          background: 'var(--bg-card, rgba(0,0,0,0.03))',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e5e7eb)',
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '12px 16px',
                borderRadius: '8px',
                border: active
                  ? '2px solid #2563eb'
                  : '1px solid var(--border-color, transparent)',
                background: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '15px' }}>
                {tab.label}
              </span>
              <span style={{
                fontSize: '12px',
                opacity: active ? 0.9 : 0.7,
                marginTop: '4px',
                lineHeight: 1.3,
              }}>
                {tab.description}
              </span>
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {activeTab === 'process' && (
          <ProcessView
            db={db}
            onProceedToVerify={() => setActiveTab('verify')}
          />
        )}
        {activeTab === 'verify' && <VerifyView />}
        {activeTab === 'publish' && <PublishView />}
      </div>
    </section>
  );
}
