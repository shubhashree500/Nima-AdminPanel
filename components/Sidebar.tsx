'use client';

import { useState } from 'react';

export type PageKey =
  | 'dash'
  | 'setup'
  | 'students'
  | 'marks'
  | 'process'
  | 'results'
  | 'overview'
  | 'exam-sessions'
  | 'verify'
  | 'publish'
  | 'grade-sheets'
  | 'tabular-register'
  | 'statistics'
  | 'rechecking'
  | 'settings';

type SidebarProps = {
  collegeName?: string;
  currentPage: PageKey;
  onPageChange: (page: PageKey) => void;
  isSyncing?: boolean;
};

type MenuItem = {
  id: PageKey;
  label: string;
  icon: IconName;
};

type MenuSection = {
  id: string;
  label: string;
  icon: IconName;
  items: MenuItem[];
};

type IconName =
  | 'dashboard'
  | 'setup'
  | 'calendar'
  | 'students'
  | 'marks'
  | 'calculator'
  | 'verify'
  | 'publish'
  | 'results'
  | 'grade'
  | 'register'
  | 'statistics'
  | 'refresh'
  | 'settings';

function Icon({
  name,
  size = 18,
}: {
  name: IconName;
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );

    case 'setup':
      return (
        <svg {...common}>
          <path d="M12 3v3" />
          <path d="M12 18v3" />
          <path d="M3 12h3" />
          <path d="M18 12h3" />
          <path d="M5.6 5.6l2.1 2.1" />
          <path d="M16.3 16.3l2.1 2.1" />
          <path d="M18.4 5.6l-2.1 2.1" />
          <path d="M7.7 16.3l-2.1 2.1" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );

    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4" />
          <path d="M8 3v4" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
        </svg>
      );

    case 'students':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
          <path d="M16 5.5a3 3 0 0 1 0 5.8" />
          <path d="M17 15c2.4.3 4 1.8 4 4.5" />
        </svg>
      );

    case 'marks':
      return (
        <svg {...common}>
          <path d="M6 2h9l4 4v16H6z" />
          <path d="M15 2v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
          <path d="M9 9h2" />
        </svg>
      );

    case 'calculator':
      return (
        <svg {...common}>
          <rect x="5" y="2.5" width="14" height="19" rx="2" />
          <path d="M8 6h8" />
          <path d="M8 11h.01" />
          <path d="M12 11h.01" />
          <path d="M16 11h.01" />
          <path d="M8 15h.01" />
          <path d="M12 15h.01" />
          <path d="M16 15h.01" />
          <path d="M8 19h.01" />
          <path d="M12 19h.01" />
          <path d="M16 19h.01" />
        </svg>
      );

    case 'verify':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="m8 12 2.5 2.5L16 9" />
        </svg>
      );

    case 'publish':
      return (
        <svg {...common}>
          <path d="M12 16V4" />
          <path d="m7 9 5-5 5 5" />
          <path d="M5 14v5h14v-5" />
        </svg>
      );

    case 'results':
      return (
        <svg {...common}>
          <path d="M6 2h9l4 4v16H6z" />
          <path d="M15 2v5h5" />
          <path d="M9 13h6" />
          <path d="M9 17h4" />
          <path d="M9 9h2" />
        </svg>
      );

    case 'grade':
      return (
        <svg {...common}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />
        </svg>
      );

    case 'register':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 7h8" />
          <path d="M8 11h8" />
          <path d="M8 15h8" />
          <path d="M8 19h4" />
        </svg>
      );

    case 'statistics':
      return (
        <svg {...common}>
          <path d="M4 20V10" />
          <path d="M10 20V4" />
          <path d="M16 20v-7" />
          <path d="M22 20H2" />
        </svg>
      );

    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.8-4L3 10" />
          <path d="M3 5v5h5" />
          <path d="M4 13a8 8 0 0 0 14.8 4L21 14" />
          <path d="M21 19v-5h-5" />
        </svg>
      );

    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.5 1.5-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20h-2v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.5-1.5.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6v-2h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.5-1.5.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V6h2v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.5 1.5-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v2h-.2a1.7 1.7 0 0 0-1.6 1z" />
        </svg>
      );
  }
}

const sections: MenuSection[] = [
  {
    id: 'examination',
    label: 'Examination',
    icon: 'calendar',
    items: [
      { id: 'exam-sessions', label: 'Exam Setup & Sessions', icon: 'calendar' },
      { id: 'students', label: 'Students', icon: 'students' },
    ],
  },
  {
    id: 'processing',
    label: 'Result Processing',
    icon: 'calculator',
    items: [
      { id: 'process', label: 'Calculate Result', icon: 'calculator' },
      { id: 'verify', label: 'Verify Result', icon: 'verify' },
      { id: 'publish', label: 'Publish Result', icon: 'publish' },
    ],
  },
  {
    id: 'results',
    label: 'Results & Reports',
    icon: 'results',
    items: [
      { id: 'results', label: 'Student Results', icon: 'results' },
      { id: 'grade-sheets', label: 'Grade Sheets', icon: 'grade' },
      {
        id: 'tabular-register',
        label: 'Tabular Register',
        icon: 'register',
      },
      {
        id: 'statistics',
        label: 'Result Statistics',
        icon: 'statistics',
      },
    ],
  },
  {
    id: 'rechecking',
    label: 'Rechecking & Revaluation',
    icon: 'refresh',
    items: [
      {
        id: 'rechecking',
        label: 'Applications',
        icon: 'refresh',
      },
    ],
  },
];

export function Sidebar({
  collegeName = 'College',
  currentPage,
  onPageChange,
  isSyncing = false,
}: SidebarProps) {
  const [openSections, setOpenSections] = useState<
    Record<string, boolean>
  >({
    examination: true,
    processing: true,
    results: true,
    rechecking: false,
  });

  const toggleSection = (sectionId: string) => {
    setOpenSections((current) => ({
      ...current,
      [sectionId]: !current[sectionId],
    }));
  };

  const isActive = (page: PageKey) => {
    if (page === 'overview') {
      return currentPage === 'dash' || currentPage === 'overview';
    }

    return currentPage === page;
  };

  return (
    <aside className="admin-sidebar">
      <div className="sidebar-brand">
        <button
          type="button"
          className="brand-block"
          onClick={() => onPageChange('dash')}
        >
          <span className="brand-mark">RA</span>

          <span className="brand-copy">
            <strong>Result Admin</strong>
            <small>University ERP</small>
          </span>
        </button>

        <div className="college-name" title={collegeName}>
          {collegeName}
        </div>
      </div>

      <div className="sidebar-scroll">
        <div className="sidebar-label">Workspace</div>

        <button
          type="button"
          onClick={() => onPageChange('dash')}
          className={`sidebar-main-link ${
            isActive('dash') ? 'active' : ''
          }`}
        >
          <span className="sidebar-icon">
            <Icon name="dashboard" />
          </span>

          <span>Dashboard</span>
        </button>

        <div className="sidebar-sections">
          {sections.map((section) => {
            const isOpen = openSections[section.id];

            return (
              <div className="sidebar-section" key={section.id}>
                <button
                  type="button"
                  className={`sidebar-section-title ${
                    isOpen ? 'expanded' : ''
                  }`}
                  onClick={() => toggleSection(section.id)}
                >
                  <span className="section-title-left">
                    <span className="sidebar-icon">
                      <Icon name={section.icon} size={16} />
                    </span>

                    <span>{section.label}</span>
                  </span>

                  <span
                    className={`section-chevron ${
                      isOpen ? 'open' : ''
                    }`}
                  >
                    ›
                  </span>
                </button>

                <div
                  className={`sidebar-items ${
                    isOpen ? 'visible' : ''
                  }`}
                >
                  {section.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => onPageChange(item.id)}
                      className={`sidebar-item ${
                        isActive(item.id) ? 'active' : ''
                      }`}
                    >
                      <span className="sidebar-item-icon">
                        <Icon name={item.icon} size={16} />
                      </span>

                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="system-status">
          <span
            className={`system-dot ${
              isSyncing ? 'syncing' : ''
            }`}
          />

          <span>
            {isSyncing ? 'Synchronizing' : 'System online'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onPageChange('settings')}
          className={`sidebar-settings ${
            isActive('settings') ? 'active' : ''
          }`}
        >
          <Icon name="settings" size={17} />
          <span>Settings</span>
        </button>

        <div className="sidebar-version">
          Result Management System
          <span>v1.0</span>
        </div>
      </div>
    </aside>
  );
}

