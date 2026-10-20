'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DBData, Student, ProgramKey } from '@/types';
import { Sidebar, PageKey } from './Sidebar';
import { OverviewView } from './views/OverviewView';
import { StudentsView } from './views/StudentsView';
import { MarksView } from './views/MarksView';
import { StudentResultsView } from './views/StudentResultsView';
import { SetupView } from './views/SetupView';
import { ProcessView } from './views/ProcessView';
import { VerifyView } from './views/VerifyView';
import { ExamSessionsView } from './views/ExamSessionsView';
import { PublishView } from './views/PublishView';
import { ReportsView } from './views/ReportsView';
import { RecheckingView } from './views/RecheckingView';
import { MasterDataView } from './views/MasterDataView';

interface AdminPanelProps {
  initialData: DBData;
}

export function AdminPanel({ initialData }: AdminPanelProps) {
  const [db, setDb] = useState<DBData>(initialData);
  const [page, setPage] = useState<PageKey>('dash');
  const [isSyncing, setIsSyncing] = useState(false);

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
      console.error(
        'Error fetching data from server:',
        error
      );
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
      console.error(
        'Error adding student:',
        error
      );
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Delete student
  const handleDeleteStudent = async (
    roll: string
  ): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch(
        `/api/students?roll=${encodeURIComponent(roll)}`,
        {
          method: 'DELETE',
        }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error(
        'Error deleting student:',
        error
      );
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
      const res = await fetch(
        '/api/students/import',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ students }),
        }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error(
        'Error importing students:',
        error
      );
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
        body: JSON.stringify({
          roll,
          sem,
          marks,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error(
        'Error saving marks:',
        error
      );
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
      const res = await fetch(
        '/api/marks/import',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sem,
            records,
          }),
        }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error(
        'Error importing marks:',
        error
      );
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
        body: JSON.stringify({
          college,
          max,
          pass,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error(
        'Error saving setup:',
        error
      );
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
        body: JSON.stringify({
          prog,
          sem,
          name,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error(
        'Error adding subject:',
        error
      );
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
        {
          method: 'DELETE',
        }
      );

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error(
        'Error removing subject:',
        error
      );
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
        body: JSON.stringify({
          prog,
          sem,
        }),
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
        return true;
      }
    } catch (error) {
      console.error(
        'Error copying subjects:',
        error
      );
    } finally {
      setIsSyncing(false);
    }

    return false;
  };

  // Reset to demo data
  const handleResetDemo = async (): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/reset', {
        method: 'POST',
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error(
        'Error resetting to demo data:',
        error
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // Clear all data
  const handleClearAll = async (): Promise<void> => {
    setIsSyncing(true);

    try {
      const res = await fetch('/api/clear', {
        method: 'POST',
      });

      const json = await res.json();

      if (json.success && json.data) {
        setDb(json.data);
      }
    } catch (error) {
      console.error(
        'Error clearing data:',
        error
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="app">
      <Sidebar
        collegeName={db.college}
        currentPage={page}
        onPageChange={handlePageChange}
        isSyncing={isSyncing}
      />

      <main id="view">
        {/* Existing working pages */}

        {page === 'dash' && (
          <OverviewView db={db} />
        )}

        {page === 'students' && (
          <StudentsView
            db={db}
            onAddStudent={handleAddStudent}
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

        {page === 'process' && (
          <ProcessView />
        )}

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

        {/* New universal-system pages */}

        {page === 'overview' && (
          <OverviewView db={db} />
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

        {page === 'subjects' && <MasterDataView kind="subjects" db={db} onRefresh={refreshData} />}
        {page === 'verify' && <VerifyView />}
        {page === 'publish' && <PublishView />}
        {page === 'grade-sheets' && <ReportsView kind="grade-sheets" />}
        {page === 'tabular-register' && <ReportsView kind="tabular-register" />}
        {page === 'statistics' && <ReportsView kind="statistics" />}
        {page === 'rechecking' && <RecheckingView />}
        {page === 'courses' && <MasterDataView kind="courses" db={db} onRefresh={refreshData} />}
        {page === 'departments' && <MasterDataView kind="departments" db={db} onRefresh={refreshData} />}
        {page === 'master-subjects' && <MasterDataView kind="master-subjects" db={db} onRefresh={refreshData} />}
        {page === 'batches' && <MasterDataView kind="batches" db={db} onRefresh={refreshData} />}
        {page === 'rules' && <MasterDataView kind="rules" db={db} onRefresh={refreshData} />}
        {page === 'settings' && <SetupView db={db} onSaveSetup={handleSaveSetup} onAddSubject={handleAddSubject} onRemoveSubject={handleRemoveSubject} onCopySubjects={handleCopySubjects} onResetDemo={handleResetDemo} onClearAll={handleClearAll} />}
      </main>
    </div>
  );
}
