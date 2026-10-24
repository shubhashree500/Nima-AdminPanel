
'use client';

import { useState } from 'react';
import { ProcessView } from './ProcessView';
import { VerifyView } from './VerifyView';
import { PublishView } from './PublishView';

type ProcessingTab = 'process' | 'verify' | 'publish';

const tabs: { id: ProcessingTab; label: string }[] = [
  { id: 'process', label: 'Calculate Result' },
  { id: 'verify', label: 'Verify Result' },
  { id: 'publish', label: 'Publish Result' },
];

export function ResultProcessingView() {
  const [activeTab, setActiveTab] =
    useState<ProcessingTab>('process');

  return (
    <section style={{ width: '100%' }}>
      <div
        role="tablist"
        aria-label="Result processing steps"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '10px',
          marginBottom: '24px',
          padding: '12px',
          borderBottom: '1px solid var(--border-color, #e5e7eb)',
        }}
      >
        {tabs.map((tab, index) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '11px 18px',
                borderRadius: '8px',
                border: active
                  ? '1px solid #2563eb'
                  : '1px solid var(--border-color, #d1d5db)',
                background: active ? '#2563eb' : 'transparent',
                color: active ? '#ffffff' : 'inherit',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              {index + 1}. {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {activeTab === 'process' && <ProcessView />}
        {activeTab === 'verify' && <VerifyView />}
        {activeTab === 'publish' && <PublishView />}
      </div>
    </section>
  );
}
