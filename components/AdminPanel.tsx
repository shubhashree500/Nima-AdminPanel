'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DBData, Student, ProgramKey } from '@/types';
import { Sidebar, PageKey } from './Sidebar';
import { LandingPage, AuthUser } from './LandingPage';
import { OverviewView } from './views/OverviewView';
import { StudentsView } from './views/StudentsView';
import { MarksView } from './views/MarksView';
import { StudentResultsView } from './views/StudentResultsView';
import { SetupView } from './views/SetupView';
import { ExamSessionsView } from './views/ExamSessionsView';
import { ReportsView } from './views/ReportsView';
import { RecheckingView } from './views/RecheckingView';
import { ResultProcessingView } from './views/ResultProcessingView';
import { VerifyView } from './views/VerifyView';
import { PublishView } from './views/PublishView';

interface AdminPanelProps {
  initialData: DBData;
}

export function AdminPanel({ initialData }: AdminPanelProps) {
  const [db, setDb] = useState<DBData>(initialData);
  const [page, setPage] = useState<PageKey>('dash');
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isAuthChecked, setIsAuthChecked] = useState(false);

  // Check stored auth session - starting from localhost:3000 starts on landing page
  useEffect(() => {
    try {
      // Clear persistent storage so visiting localhost:3000 always starts from landing page
      localStorage.removeItem('result_erp_auth');
      const stored = sessionStorage.getItem('result_erp_auth');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}
    setIsAuthChecked(true);
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem('result_erp_auth');
      sessionStorage.removeItem('result_erp_auth');
    } catch {}
    setCurrentUser(null);
  };

  // Sync to localStorage as client-side backup
  useEffect(() => {
    try {
      localStorage.setItem(
        'result-panel-v1',
        JSON.stringify(db)
      );
    } catch (e) {}
  }, [db]);

  // Fetch latest from Node.js backend
  const refreshData = useCallback(async () => {
    try {
      setIsSyncing(true);

      const res = await fetch('/api/data');

      if (res.ok) {
        const json = await res.json();

        if (json.success && json.data) {
          setDb(json.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data from server:', error);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handlePageChange = (newPage: PageKey) => {
    setPage(newPage);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Add student
  const handleAddStudent = async (
    student: Student
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(student),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error adding student:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Update student
  const handleUpdateStudent = async (
    originalRoll: string,
    student: Student
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/students', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          originalRoll,
          ...student,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error updating student:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Delete student
  const handleDeleteStudent = async (
    roll: string
  ): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete student with roll "${roll}"? This action cannot be undone.`)) {
      return;
    }

    setIsSyncing(true);

    try {
      const res = await fetch(
        `/api/students?roll=${encodeURIComponent(roll)}&force=true`,
        { method: 'DELETE' }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      } else if (json.error) {
        alert(json.error);
      }
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Failed to delete student.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Import students
  const handleImportStudents = async (
    students: Student[]
  ): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ students }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error('Error importing students:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save marks for student
  const handleSaveMarks = async (
    roll: string,
    sem: number,
    marks: Record<string, number>
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/marks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roll, sem, marks }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      } else if (json.error) {
        alert(json.error);
      }
    } catch (error) {
      console.error('Error saving marks:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Import marks
  const handleImportMarks = async (
    sem: number,
    records: Array<{
      r: string;
      m: Record<string, number>;
    }>
  ): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/marks/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sem, records }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error('Error importing marks:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Save configuration
  const handleSaveSetup = async (
    college: string,
    max: number,
    pass: number
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ college, max, pass }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error saving setup:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Add subject
  const handleAddSubject = async (
    prog: ProgramKey,
    sem: number,
    name: string
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/subjects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prog, sem, name }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error adding subject:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Remove subject
  const handleRemoveSubject = async (
    prog: ProgramKey,
    sem: number,
    index: number
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch(
        `/api/subjects?prog=${prog}&sem=${sem}&index=${index}`,
        { method: 'DELETE' }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error removing subject:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Copy subjects to all semesters
  const handleCopySubjects = async (
    prog: ProgramKey,
    sem: number
  ): Promise<boolean> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/subjects', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prog, sem }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error('Error copying subjects:', error);
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Reset to demo data
  const handleResetDemo = async (): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/reset?force=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      } else if (json.error) {
        alert(json.error);
      }
    } catch (error) {
      console.error('Error resetting to demo data:', error);
      alert('Failed to reset demo data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear all data
  const handleClearAll = async (): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/clear?force=true', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      } else if (json.error) {
        alert(json.error);
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Failed to clear data. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Delete calculation
  const handleDeleteCalculation = async (calcId: string): Promise<boolean> => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/process?id=${encodeURIComponent(calcId)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success && json.data) {
        setDb(json.data);
        return true;
      } else if (json.error) {
        alert(json.error);
      }
    } catch (error) {
      console.error('Error deleting calculation:', error);
      alert('Failed to delete calculation.');
    } finally {
      setIsSyncing(false);
    }
    return false;
  };

  if (!currentUser) {
    return (
      <LandingPage
        collegeName={db.college}
        onLogin={(user) => setCurrentUser(user)}
      />
    );
  }

  return (
    <div className="app">
      <Sidebar
        collegeName={db.college}
        currentPage={page}
        onPageChange={handlePageChange}
        isSyncing={isSyncing}
        user={currentUser}
        onLogout={handleLogout}
      />

      <main id="view">
        {page === 'dash' && (
          <OverviewView
            db={db}
            onDeleteCalculation={handleDeleteCalculation}
          />
        )}

        {page === 'students' && (
          <StudentsView
            db={db}
            onAddStudent={handleAddStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
            onImportStudents={handleImportStudents}
          />
        )}

        {page === 'marks' && (
          <MarksView
            db={db}
            onSaveMarks={handleSaveMarks}
            onImportMarks={handleImportMarks}
          />
        )}

        {page === 'process' && <ResultProcessingView db={db} />}

        {page === 'verify' && <VerifyView />}

        {page === 'publish' && <PublishView />}

        {page === 'results' && <StudentResultsView />}

        {page === 'setup' && (
          <SetupView
            db={db}
            onSaveSetup={handleSaveSetup}
            onAddSubject={handleAddSubject}
            onRemoveSubject={handleRemoveSubject}
            onCopySubjects={handleCopySubjects}
            onResetDemo={handleResetDemo}
            onClearAll={handleClearAll}
          />
        )}

        {page === 'overview' && (
          <OverviewView
            db={db}
            onDeleteCalculation={handleDeleteCalculation}
          />
        )}

        {page === 'exam-sessions' && (
          <ExamSessionsView
            db={db}
            onSync={refreshData}
            onSaveSetup={handleSaveSetup}
            onAddSubject={handleAddSubject}
            onRemoveSubject={handleRemoveSubject}
            onCopySubjects={handleCopySubjects}
            onResetDemo={handleResetDemo}
            onClearAll={handleClearAll}
          />
        )}

        {page === 'grade-sheets' && (
          <ReportsView kind="grade-sheets" />
        )}

        {page === 'tabular-register' && (
          <ReportsView kind="tabular-register" />
        )}

        {page === 'statistics' && (
          <ReportsView kind="statistics" />
        )}

        {page === 'rechecking' && <RecheckingView />}

        {page === 'settings' && (
          <SetupView
            db={db}
            onSaveSetup={handleSaveSetup}
            onAddSubject={handleAddSubject}
            onRemoveSubject={handleRemoveSubject}
            onCopySubjects={handleCopySubjects}
            onResetDemo={handleResetDemo}
            onClearAll={handleClearAll}
          />
        )}
      </main>
    </div>
  );
}
