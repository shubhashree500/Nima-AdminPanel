'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';

type Application = {
  id: string;
  studentRoll: string;
  studentName: string;
  program: 'UG' | 'PG';
  semester: number;
  batch?: string;
  paperCode?: string;
  reason: string;
  requestedMarks?: number | null;
  status: string;
  decisionNotes?: string;
  correctionId?: string | null;
  originalCalculationId?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Calculation = {
  id: string;
  program: string;
  semester: number;
  batch?: string | number;
  course?: string;
  department?: string;
  count?: number;
  status?: string;
  createdAt?: string;
};

type PaperComponentData = {
  code: string;
  title: string;
  category: string;
  type: string;
  credit: number;
  fullMark: number;
  marks: number;
  grade: string;
  gradePoint: number;
  creditPoint: number;
  grace: number;
  components: {
    midsem: { value: number | null; max: number };
    sem: { value: number | null; max: number };
    practical: { value: number | null; max: number };
    attendance: { value: number | null; max: number };
  };
};

type StudentDetails = {
  roll: string;
  name: string;
  department: string;
  course: string;
  program: string;
  semester: number;
  batch: number;
  sgpa: number | string;
  percentage: number | string;
  totalCredits: number | string;
  totalCreditPoints: number | string;
  status: string;
  isRevised?: boolean;
};

type StagedChange = {
  paperCode: string;
  paperTitle: string;
  component: 'sem' | 'midsem' | 'practical' | 'attendance';
  oldValue: number | null;
  newValue: number;
  reason: string;
  maxMark: number;
};

type PreviewResult = {
  correction: {
    id: string;
    status: string;
    paperCode: string;
    paperTitle: string;
    component: string;
    oldValue: number | null;
    newValue: number;
    reason: string;
    originalPaperResult: any;
    revisedPaperResult: any;
    originalStudentResult: any;
    revisedStudentResult: any;
  };
  corrections?: any[];
  application?: any;
  applied?: boolean;
};

const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'] as const;

export function RecheckingView() {
  const [activeTab, setActiveTab] = useState<'recheck' | 'applications' | 'history'>('recheck');

  // Calculations & Applications
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'applied' | 'preview'>('all');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Student details in selected calculation
  const [studentRoll, setStudentRoll] = useState('');
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [studentPapers, setStudentPapers] = useState<PaperComponentData[]>([]);
  const [loadingStudent, setLoadingStudent] = useState(false);

  // Mark update form
  const [selectedPaperCode, setSelectedPaperCode] = useState('');
  const [selectedComponent, setSelectedComponent] = useState<'sem' | 'midsem' | 'practical' | 'attendance'>('sem');
  const [newMark, setNewMark] = useState<string>('');
  const [updateReason, setUpdateReason] = useState('');
  const [linkedAppId, setLinkedAppId] = useState<string>('');
  const [stagedChanges, setStagedChanges] = useState<StagedChange[]>([]);

  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  const linkedApplication = applications.find(
    (app) => app.id === linkedAppId
  );

  const linkedApplicationStatus = linkedApplication?.status ?? '';

  // Preview & Processing state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [processing, setProcessing] = useState(false);

  const canPreviewCorrection = Boolean(
    stagedChanges.length > 0 || (selectedPaperCode && newMark !== '')
  );

  const canApplyCorrection = Boolean(
    stagedChanges.length > 0 || (selectedPaperCode && newMark !== '') || (preview !== null && Boolean(preview?.correction))
  );

  // Applications Form
  const [appForm, setAppForm] = useState({
    studentRoll: '',
    studentName: '',
    program: 'UG',
    semester: '1',
    batch: '2025',
    paperCode: '',
    reason: '',
    requestedMarks: '',
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingApp, setSavingApp] = useState(false);

  // Load calculations and applications

  const loadInitialData = useCallback(async () => {
    setLoading(true);

    try {
      const [verRes, recRes, corrRes] = await Promise.all([
        fetch('/api/verify', { cache: 'no-store' }),
        fetch('/api/rechecking', { cache: 'no-store' }),
        fetch('/api/result-corrections?includeAll=true', { cache: 'no-store' }),
      ]);

      const verJson = await verRes.json();
      const recJson = await recRes.json();
      const corrJson = await corrRes.json();

      if (!verRes.ok || !verJson.success) {
        throw new Error(
          verJson.error || 'Could not load published examinations.'
        );
      }

      // Accept supported response shapes and normalize status.
      const allCalculations = Array.isArray(verJson.data)
        ? verJson.data
        : Array.isArray(verJson.calculations)
          ? verJson.calculations
          : [];

      const publishedCalcs = allCalculations.filter(
        (calculation: any) =>
          String(calculation.status || '').trim().toLowerCase() ===
          'published'
      );

      setCalculations(publishedCalcs);

      // Keep the current selection if it still exists.
      // Otherwise, select the first published calculation.
      setSelectedCalcId((currentId) => {
        if (
          currentId &&
          publishedCalcs.some((c: any) => c.id === currentId)
        ) {
          return currentId;
        }

        return publishedCalcs[0]?.id || '';
      });

      if (recJson.success) {
        setApplications(recJson.applications || []);
      }

      if (corrJson.success) {
        setCorrections(Array.isArray(corrJson.data) ? corrJson.data : []);
      }

      if (publishedCalcs.length === 0) {
        setMessage({
          text: 'No published examinations found. Verify that a result has been published in Result Processing.',
          ok: false,
        });
      }
    } catch (error) {
      console.error('Failed to load rechecking data:', error);

      setCalculations([]);
      setSelectedCalcId('');
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Failed to load examinations.',
        ok: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Load student papers and components
  const loadStudentData = async (calcId: string, roll: string) => {
    if (!calcId || !roll.trim()) return;
    setLoadingStudent(true);
    setPreview(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/rechecking/preview?calculationId=${encodeURIComponent(calcId)}&studentRoll=${encodeURIComponent(roll.trim())}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Could not load student papers.');
      }
      setStudentDetails(json.student);
      setStudentPapers(json.papers || []);
      if (json.papers && json.papers.length > 0) {
        setSelectedPaperCode(json.papers[0].code);
      }
    } catch (err: any) {
      setStudentDetails(null);
      setStudentPapers([]);
      setMessage({ text: err.message || 'Student not found.', ok: false });
    } finally {
      setLoadingStudent(false);
    }
  };

  // Currently selected paper data
  const currentPaper = studentPapers.find(
    (p) => p.code.toLowerCase() === selectedPaperCode.toLowerCase()
  );

  // Max mark for selected component
  const currentComponentMax = currentPaper?.components?.[selectedComponent]?.max ?? 100;
  const currentComponentVal = currentPaper?.components?.[selectedComponent]?.value;

  // Stage Paper Mark Change (allows adding multiple papers before applying)
  const handleStagePaperChange = () => {
    if (!selectedPaperCode || newMark === '') {
      setMessage({ text: 'Please select a paper and enter a valid new mark.', ok: false });
      return;
    }

    const val = Number(newMark);
    if (!Number.isFinite(val) || val < 0 || val > currentComponentMax) {
      setMessage({ text: `New mark must be a valid number between 0 and ${currentComponentMax}.`, ok: false });
      return;
    }

    const paper = studentPapers.find(
      (p) => p.code.toLowerCase() === selectedPaperCode.toLowerCase()
    );

    const existingIdx = stagedChanges.findIndex(
      (c) =>
        c.paperCode.toLowerCase() === selectedPaperCode.toLowerCase() &&
        c.component === selectedComponent
    );

    const entry: StagedChange = {
      paperCode: selectedPaperCode,
      paperTitle: paper?.title || selectedPaperCode,
      component: selectedComponent,
      oldValue: currentComponentVal ?? null,
      newValue: val,
      reason: updateReason.trim() || 'Rechecking mark update',
      maxMark: currentComponentMax,
    };

    if (existingIdx >= 0) {
      setStagedChanges((prev) => {
        const copy = [...prev];
        copy[existingIdx] = entry;
        return copy;
      });
    } else {
      setStagedChanges((prev) => [...prev, entry]);
    }

    setNewMark('');
    setPreview(null);
    setMessage({
      text: `✓ Mark for ${selectedPaperCode} (${selectedComponent}: ${val}) added to pending list. You can select another paper to add more marks, or preview/apply below.`,
      ok: true,
    });
  };

  const handleRemoveStagedChange = (paperCode: string, component: string) => {
    setStagedChanges((prev) =>
      prev.filter(
        (c) =>
          !(c.paperCode.toLowerCase() === paperCode.toLowerCase() && c.component === component)
      )
    );
    setPreview(null);
  };

  // Handle Preview
  const handlePreviewRecalculation = async () => {
    if (!selectedCalcId || !studentRoll.trim()) {
      setMessage({ text: 'Please select examination and student roll.', ok: false });
      return;
    }

    let changesToSend: any[] = [];
    if (stagedChanges.length > 0) {
      changesToSend = stagedChanges.map((sc) => ({
        paperCode: sc.paperCode,
        component: sc.component,
        newValue: sc.newValue,
        reason: sc.reason,
      }));
      // If user also has an unsaved mark in the inputs, add it too
      if (selectedPaperCode && newMark !== '') {
        const val = Number(newMark);
        if (Number.isFinite(val) && val >= 0 && val <= currentComponentMax) {
          const alreadyStaged = changesToSend.some(
            (c) =>
              c.paperCode.toLowerCase() === selectedPaperCode.toLowerCase() &&
              c.component === selectedComponent
          );
          if (!alreadyStaged) {
            changesToSend.push({
              paperCode: selectedPaperCode,
              component: selectedComponent,
              newValue: val,
              reason: updateReason.trim() || 'Rechecking mark update',
            });
          }
        }
      }
    } else if (selectedPaperCode && newMark !== '') {
      changesToSend = [
        {
          paperCode: selectedPaperCode,
          component: selectedComponent,
          newValue: Number(newMark),
          reason: updateReason.trim() || 'Rechecking mark update',
        },
      ];
    }

    if (changesToSend.length === 0) {
      setMessage({
        text: 'Please enter a new mark or stage at least one paper correction.',
        ok: false,
      });
      return;
    }

    setProcessing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rechecking/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCalculationId: selectedCalcId,
          studentRoll: studentRoll.trim(),
          changes: changesToSend,
          reason: updateReason.trim() || undefined,
          applicationId: linkedAppId || undefined,
          apply: false,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Preview recalculation failed.');
      }

      setPreview(json);
      setMessage({
        text: `Recalculation preview generated for ${changesToSend.length} paper(s). Review the revised results below.`,
        ok: true,
      });
    } catch (err: any) {
      setPreview(null);
      setMessage({ text: err.message || 'Preview failed.', ok: false });
    } finally {
      setProcessing(false);
    }
  };

  // Handle Apply Mark Update
  const handleApplyMarkUpdate = async () => {
    if (!selectedCalcId || !studentRoll.trim()) {
      setMessage({
        text: 'Missing examination selection or student roll.',
        ok: false,
      });
      return;
    }

    let changesToSend: any[] = [];
    if (stagedChanges.length > 0) {
      changesToSend = stagedChanges.map((sc) => ({
        paperCode: sc.paperCode,
        component: sc.component,
        newValue: sc.newValue,
        reason: sc.reason,
      }));
      if (selectedPaperCode && newMark !== '') {
        const val = Number(newMark);
        if (Number.isFinite(val) && val >= 0 && val <= currentComponentMax) {
          const alreadyStaged = changesToSend.some(
            (c) =>
              c.paperCode.toLowerCase() === selectedPaperCode.toLowerCase() &&
              c.component === selectedComponent
          );
          if (!alreadyStaged) {
            changesToSend.push({
              paperCode: selectedPaperCode,
              component: selectedComponent,
              newValue: val,
              reason: updateReason.trim() || 'Rechecking mark update',
            });
          }
        }
      }
    } else if (selectedPaperCode && newMark !== '') {
      changesToSend = [
        {
          paperCode: selectedPaperCode,
          component: selectedComponent,
          newValue: Number(newMark),
          reason: updateReason.trim() || 'Rechecking mark update',
        },
      ];
    }

    if (changesToSend.length === 0) {
      setMessage({
        text: 'No paper mark updates to apply.',
        ok: false,
      });
      return;
    }

    const paperSummary = changesToSend
      .map((c) => `${c.paperCode} (${c.component}: ${c.newValue})`)
      .join(', ');

    const confirm = window.confirm(
      `Apply mark correction for ${studentRoll} across ${changesToSend.length} paper(s):\n${paperSummary}\n\nThe original published result will remain unchanged. The revised result will be stored separately for updated reports.`
    );

    if (!confirm) return;

    setProcessing(true);
    setMessage(null);

    try {
      const res = await fetch('/api/rechecking/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalCalculationId: selectedCalcId,
          studentRoll: studentRoll.trim(),
          changes: changesToSend,
          reason: updateReason.trim() || undefined,
          applicationId: linkedAppId || undefined,
          apply: true,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Mark correction failed.');
      }

      setPreview(json);
      setStagedChanges([]);
      setNewMark('');

      // Show successful alert popup
      alert(
        `✅ Mark correction applied successfully for ${changesToSend.length} paper(s)!\n\nStudent: ${studentRoll}\nPapers: ${paperSummary}\n\nThe updated result has been stored and recorded under Applications.`
      );

      await loadStudentData(selectedCalcId, studentRoll);
      await loadInitialData();

      // Automatically navigate to Applications tab and expand this applicant
      setActiveTab('applications');
      if (json.application?.id) {
        setExpandedAppId(json.application.id);
      } else if (json.correction?.applicationId) {
        setExpandedAppId(json.correction.applicationId);
      }
    } catch (err: any) {
      setMessage({
        text: err.message || 'Mark correction failed.',
        ok: false,
      });
    } finally {
      setProcessing(false);
    }
  };

    // Register New Application
  const handleRegisterApp = async () => {
    if (!appForm.studentRoll.trim() || !appForm.studentName.trim() || !appForm.reason.trim()) {
      setMessage({ text: 'Enter student roll, student name, and reason.', ok: false });
      return;
    }

    setSavingApp(true);
    setMessage(null);
    try {
      const res = await fetch('/api/rechecking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...appForm,
          semester: Number(appForm.semester),
          requestedMarks: appForm.requestedMarks === '' ? null : Number(appForm.requestedMarks),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Unable to save application.');
      }

      setApplications((prev) => [json.application, ...prev]);
      setAppForm({
        studentRoll: '',
        studentName: '',
        program: 'UG',
        semester: '1',
        batch: '2025',
        paperCode: '',
        reason: '',
        requestedMarks: '',
      });
      setMessage({ text: 'Application registered successfully.', ok: true });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to register application.', ok: false });
    } finally {
      setSavingApp(false);
    }
  };

  // Update Application Status/Notes
  const handleUpdateApp = async (app: Application, changes: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/rechecking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: app.id, ...changes }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Unable to update application.');
      }
      setApplications((prev) => prev.map((item) => (item.id === app.id ? json.application : item)));
      setMessage({ text: 'Application updated.', ok: true });
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to update application.', ok: false });
    }
  };

  // Quick process from application table
  const startRecheckingFromApp = (app: Application) => {
    setActiveTab('recheck');
    setStudentRoll(app.studentRoll);
    setLinkedAppId(app.id);
    if (app.paperCode) setSelectedPaperCode(app.paperCode);
    if (app.requestedMarks !== null && app.requestedMarks !== undefined) {
      setNewMark(String(app.requestedMarks));
    }
    setUpdateReason(`Rechecking application ${app.id}: ${app.reason}`);

    // Try matching calculation
    const match = calculations.find(
      (c) =>
        c.program === app.program &&
        Number(c.semester) === Number(app.semester) &&
        String(c.batch || '') === String(app.batch || '')
    );
    if (match) {
      setSelectedCalcId(match.id);
      void loadStudentData(match.id, app.studentRoll);
    } else if (selectedCalcId) {
      void loadStudentData(selectedCalcId, app.studentRoll);
    }
  };

  return (
    <section className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Rechecking & Revaluation System
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                Subject-wise per paper verification: Semester Mark, Midsem, Practical, and Attendance. Mark updates, recalculated results, and revised reports.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('recheck')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'recheck'
                    ? 'bg-blue-700 text-white shadow'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
              >
                Subject-Wise Mark Update
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'applications'
                    ? 'bg-blue-700 text-white shadow'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
              >
                Applications ({applications.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${activeTab === 'history'
                    ? 'bg-blue-700 text-white shadow'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                  }`}
              >
                Correction History ({corrections.length})
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div
            className={`rounded-xl border p-4 text-sm font-medium ${message.ok
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
              }`}
          >
            {message.text}
          </div>
        )}

        {/* TAB 1: SUBJECT-WISE MARK UPDATE & RECALCULATION */}
        {activeTab === 'recheck' && (
          <div className="space-y-6">
            {/* Step 1: Select Calculation & Student */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">
                1. Select Examination & Student
              </h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  Published Examination
                  <select
                    className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                    value={selectedCalcId}
                    onChange={(e) => {
                      setSelectedCalcId(e.target.value);
                      if (studentRoll.trim()) void loadStudentData(e.target.value, studentRoll);
                    }}
                  >
                    <option value="">-- Select Examination --</option>
                    {calculations.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.program} Sem {c.semester} (Batch {c.batch || '-'}) · {c.department || c.course || 'All'}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Student Roll Number
                  <div className="mt-1 flex gap-2">
                    <input
                      type="text"
                      className="w-full rounded-lg border p-2.5 text-sm uppercase"
                      placeholder="e.g. BBA24-001 or NACPG25001"
                      value={studentRoll}
                      onChange={(e) => setStudentRoll(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void loadStudentData(selectedCalcId, studentRoll);
                      }}
                    />
                    <button
                      onClick={() => void loadStudentData(selectedCalcId, studentRoll)}
                      disabled={loadingStudent || !selectedCalcId || !studentRoll.trim()}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {loadingStudent ? 'Loading…' : 'Find'}
                    </button>
                  </div>
                </label>

                <label className="text-sm font-medium text-gray-700">
                  Link Rechecking Application
                  <select
                    className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                    value={linkedAppId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setLinkedAppId(id);
                      const app = applications.find((a) => a.id === id);
                      if (app) {
                        if (app.paperCode) setSelectedPaperCode(app.paperCode);
                        if (app.requestedMarks !== null && app.requestedMarks !== undefined) {
                          setNewMark(String(app.requestedMarks));
                        }
                        setUpdateReason(`Rechecking application ${app.id}: ${app.reason}`);
                      }
                    }}
                  >
                    <option value="">-- Select Approved Application --</option>
                    {applications
                      .filter((a) => !studentRoll.trim() || a.studentRoll.toLowerCase() === studentRoll.trim().toLowerCase())
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.id} · {a.paperCode || 'Paper'} · {a.status} (Req: {a.requestedMarks ?? '—'})
                        </option>
                      ))}
                  </select>
                </label>

                {linkedAppId && (
                  <div className="flex flex-col justify-end">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <div>
                        Linked to Application: <strong>{linkedAppId}</strong>
                      </div>

                      <div className="mt-1 font-semibold">
                        Status: {linkedApplicationStatus || 'Application not found'}
                      </div>

                      {linkedApplicationStatus === 'Completed' && (
                        <div className="mt-1 font-semibold text-green-800">
                          Mark correction has already been completed. Further changes are disabled.
                        </div>
                      )}

                      {linkedApplicationStatus !== 'Approved' &&
                        linkedApplicationStatus !== 'Completed' && (
                          <div className="mt-1">
                            The application must be approved before you can preview or apply a correction.
                          </div>
                        )}

                      <button
                        type="button"
                        onClick={() => {
                          setLinkedAppId('');
                          setPreview(null);
                        }}
                        className="mt-2 font-bold text-red-600 hover:underline"
                      >
                        Unlink Application
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Student Header Summary */}
              {studentDetails && (
                <div className="mt-5 rounded-lg bg-blue-50/70 border border-blue-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wider text-blue-700 font-bold">
                        {studentDetails.program} Sem {studentDetails.semester} · Batch {studentDetails.batch}
                      </span>
                      <h3 className="text-lg font-bold text-gray-900">
                        {studentDetails.name} ({studentDetails.roll})
                      </h3>
                      <p className="text-xs text-gray-600">
                        Department / Course: <strong>{studentDetails.department || studentDetails.course}</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-xs text-gray-500">Current SGPA</div>
                        <div className="text-xl font-bold text-gray-900">{studentDetails.sgpa}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Percentage</div>
                        <div className="text-xl font-bold text-gray-900">{studentDetails.percentage}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Status</div>
                        <span
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${studentDetails.status === 'PASS'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {studentDetails.status}
                        </span>
                      </div>
                      {studentDetails.isRevised && (
                        <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
                          Revised
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Subject-Wise Per Papers Breakdown Table */}
            {studentDetails && studentPapers.length > 0 && (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-900">
                    2. Subject-Wise Papers Mark Breakdown
                  </h2>
                  <span className="text-xs text-gray-500">
                    Select a paper below to modify its component marks
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        <th className="border p-2.5">Paper Code</th>
                        <th className="border p-2.5">Subject Title</th>
                        <th className="border p-2.5">Type</th>
                        <th className="border p-2.5 text-center">Sem / Endsem Mark</th>
                        <th className="border p-2.5 text-center">Midsem Mark</th>
                        <th className="border p-2.5 text-center">Practical Mark</th>
                        <th className="border p-2.5 text-center">Attendance</th>
                        <th className="border p-2.5 text-center">Total Marks</th>
                        <th className="border p-2.5 text-center">Grade (GP)</th>
                        <th className="border p-2.5 text-center">Credit Points</th>
                        <th className="border p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentPapers.map((paper) => {
                        const isSelected = selectedPaperCode.toLowerCase() === paper.code.toLowerCase();
                        const stagedForPaper = stagedChanges.find((sc) => sc.paperCode.toLowerCase() === paper.code.toLowerCase());
                        return (
                          <tr
                            key={paper.code}
                            className={`transition ${isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-gray-50'}`}
                          >
                            <td className="border p-2.5 font-semibold text-blue-900">{paper.code}</td>
                            <td className="border p-2.5">{paper.title}</td>
                            <td className="border p-2.5 capitalize text-xs text-gray-500">{paper.type}</td>
                            <td className="border p-2.5 text-center">
                              {paper.components.sem.value ?? '—'}
                              <span className="text-xs text-gray-400">/{paper.components.sem.max}</span>
                            </td>
                            <td className="border p-2.5 text-center">
                              {paper.components.midsem.value ?? '—'}
                              <span className="text-xs text-gray-400">/{paper.components.midsem.max}</span>
                            </td>
                            <td className="border p-2.5 text-center">
                              {paper.components.practical.value !== null ? (
                                <>
                                  {paper.components.practical.value}
                                  <span className="text-xs text-gray-400">/{paper.components.practical.max}</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="border p-2.5 text-center">
                              {paper.components.attendance.value !== null ? (
                                <>
                                  {paper.components.attendance.value}
                                  <span className="text-xs text-gray-400">/{paper.components.attendance.max}</span>
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="border p-2.5 text-center font-bold">
                              {paper.marks} / {paper.fullMark}
                              {paper.grace > 0 && (
                                <span className="ml-1 text-xs text-amber-600 font-semibold">(+{paper.grace} Grace)</span>
                              )}
                            </td>
                            <td className="border p-2.5 text-center">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${['F', 'AB', 'M'].includes(paper.grade)
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                  }`}
                              >
                                {paper.grade} ({paper.gradePoint})
                              </span>
                            </td>
                            <td className="border p-2.5 text-center">{paper.creditPoint}</td>
                            <td className="border p-2.5 text-center">
                              <div className="flex flex-col items-center gap-1">
                                {stagedForPaper ? (
                                  <span className="rounded bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                                    Staged: {stagedForPaper.component.toUpperCase()} {stagedForPaper.oldValue ?? '—'} → {stagedForPaper.newValue}
                                  </span>
                                ) : null}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setSelectedPaperCode(paper.code);
                                      if (stagedForPaper) {
                                        setSelectedComponent(stagedForPaper.component);
                                        setNewMark(String(stagedForPaper.newValue));
                                      } else {
                                        setNewMark('');
                                      }
                                      setPreview(null);
                                    }}
                                    className={`rounded px-2.5 py-1 text-xs font-semibold ${isSelected
                                        ? 'bg-blue-700 text-white'
                                        : 'border bg-white text-gray-700 hover:bg-gray-100'
                                      }`}
                                  >
                                    {isSelected ? 'Editing' : stagedForPaper ? 'Modify' : 'Select'}
                                  </button>
                                  {stagedForPaper && (
                                    <button
                                      onClick={() => handleRemoveStagedChange(paper.code, stagedForPaper.component)}
                                      className="rounded border border-red-200 bg-red-50 px-1.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100"
                                      title="Remove from staged changes"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Step 3: Rechecking Form & Component Selection */}
            {studentDetails && currentPaper && (
              <div className="rounded-xl border bg-white p-5 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">
                  3. Select Paper Component & Enter Revised Mark
                </h2>

                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Target Paper
                    </label>
                    <div className="mt-1 rounded-lg border bg-gray-50 p-2.5 font-semibold text-gray-900">
                      {currentPaper.code} — {currentPaper.title}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Mark Component
                    </label>
                    <select
                      className="mt-1 w-full rounded-lg border p-2.5 text-sm font-medium"
                      value={selectedComponent}
                      onChange={(e) => {
                        setSelectedComponent(e.target.value as any);
                        setNewMark('');
                        setPreview(null);
                      }}
                    >
                      <option value="sem">
                        Semester / Endsem Mark (Max: {currentPaper.components.sem.max})
                      </option>
                      <option value="midsem">
                        Midsem Mark (Max: {currentPaper.components.midsem.max})
                      </option>
                      <option value="practical">
                        Practical Mark (Max: {currentPaper.components.practical.max})
                      </option>
                      <option value="attendance">
                        Attendance Mark (Max: {currentPaper.components.attendance.max})
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Current Value vs Max
                    </label>
                    <div className="mt-1 rounded-lg border bg-gray-50 p-2.5 text-sm">
                      Current: <strong>{currentComponentVal ?? 'None'}</strong> | Max:{' '}
                      <strong>{currentComponentMax}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      New Mark (0 to {currentComponentMax})
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={currentComponentMax}
                      className="mt-1 w-full rounded-lg border p-2.5 text-sm font-bold text-blue-900"
                      placeholder={`0 - ${currentComponentMax}`}
                      value={newMark}
                      onChange={(e) => setNewMark(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 lg:col-span-4">
                    <label className="text-sm font-medium text-gray-700">
                      Reason / Justification for Mark Update
                    </label>
                    <textarea
                      rows={2}
                      className="mt-1 w-full rounded-lg border p-2.5 text-sm"
                      placeholder="Enter the approved reason for the mark update"
                      value={updateReason}
                      onChange={(e) => setUpdateReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleStagePaperChange}
                    disabled={processing || newMark === ''}
                    className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-800 shadow-sm disabled:opacity-50"
                  >
                    + Save / Stage Mark for this Paper
                  </button>

                  <button
                    type="button"
                    onClick={handlePreviewRecalculation}
                    disabled={processing || !canPreviewCorrection}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? 'Processing…' : stagedChanges.length > 0 ? `Preview Recalculation (${stagedChanges.length + (newMark !== '' ? 1 : 0)} papers)` : 'Preview Recalculation'}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyMarkUpdate}
                    disabled={processing || !canApplyCorrection}
                    className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {processing ? 'Saving…' : stagedChanges.length > 0 ? `Apply Mark Update (${stagedChanges.length + (newMark !== '' ? 1 : 0)} papers)` : 'Apply Mark Update & Revise Result'}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3.5: Pending / Staged Corrections Summary Table */}
            {stagedChanges.length > 0 && (
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50/60 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-amber-950 flex items-center gap-2">
                      <span>📋 Staged Paper Corrections</span>
                      <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-extrabold text-amber-900">
                        {stagedChanges.length} paper{stagedChanges.length > 1 ? 's' : ''} ready to apply
                      </span>
                    </h2>
                    <p className="text-xs text-amber-800 mt-0.5">
                      You can select another paper above to add more marks. When ready, click Apply to save all updates together into Applications.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setStagedChanges([]);
                      setPreview(null);
                    }}
                    className="text-xs font-bold text-red-600 hover:underline"
                  >
                    Clear All Staged
                  </button>
                </div>

                <div className="mt-3 overflow-x-auto rounded-lg border border-amber-200 bg-white">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-100/70 text-amber-950 font-bold border-b border-amber-200">
                        <th className="p-2.5 text-center">#</th>
                        <th className="p-2.5 text-left">Paper Code</th>
                        <th className="p-2.5 text-left">Subject Title</th>
                        <th className="p-2.5 text-center">Component</th>
                        <th className="p-2.5 text-center">Original Mark</th>
                        <th className="p-2.5 text-center">New Mark</th>
                        <th className="p-2.5 text-left">Reason</th>
                        <th className="p-2.5 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stagedChanges.map((sc, idx) => (
                        <tr key={`${sc.paperCode}-${sc.component}`} className="border-b hover:bg-amber-50/40">
                          <td className="p-2.5 text-center font-medium text-gray-500">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-blue-900">{sc.paperCode}</td>
                          <td className="p-2.5 text-gray-800">{sc.paperTitle}</td>
                          <td className="p-2.5 text-center uppercase font-semibold text-gray-700">{sc.component}</td>
                          <td className="p-2.5 text-center text-gray-600">{sc.oldValue ?? '—'}</td>
                          <td className="p-2.5 text-center font-bold text-green-700 text-sm">{sc.newValue}</td>
                          <td className="p-2.5 text-gray-600 max-w-xs">{sc.reason}</td>
                          <td className="p-2.5 text-center">
                            <button
                              onClick={() => handleRemoveStagedChange(sc.paperCode, sc.component)}
                              className="text-red-600 font-bold hover:underline"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePreviewRecalculation}
                    disabled={processing}
                    className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm"
                  >
                    {processing ? 'Processing…' : `Preview Recalculation (${stagedChanges.length} papers)`}
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyMarkUpdate}
                    disabled={processing}
                    className="rounded-lg bg-green-700 px-6 py-2 text-sm font-bold text-white hover:bg-green-800 shadow-md"
                  >
                    {processing ? 'Applying…' : `⚡ Apply All Updates & Revise Result (${stagedChanges.length} papers)`}
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Recalculation Preview Comparison */}
            {preview && preview.correction && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-indigo-950">
                    4. Recalculation Comparison: Original vs Revised
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${preview.correction.status === 'applied'
                        ? 'bg-green-200 text-green-900'
                        : 'bg-amber-200 text-amber-900'
                      }`}
                  >
                    {preview.correction.status === 'applied' ? 'Applied & Saved' : 'Preview Only'}
                  </span>
                </div>

                <div className="mt-4 grid gap-6 md:grid-cols-2">
                  {/* Paper Comparison */}
                  <div className="rounded-lg border bg-white p-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">
                      Paper: {preview.correction.paperCode}
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Component Changed</div>
                        <div className="font-semibold capitalize">{preview.correction.component}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Mark Delta</div>
                        <div className="font-bold text-indigo-700">
                          {preview.correction.oldValue ?? '—'} → {preview.correction.newValue}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Original Total & Grade</div>
                        <div className="font-medium">
                          {preview.correction.originalPaperResult?.marks ?? 0} (Grade: {preview.correction.originalPaperResult?.grade})
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Revised Total & Grade</div>
                        <div className="font-bold text-green-700">
                          {preview.correction.revisedPaperResult?.marks ?? 0} (Grade: {preview.correction.revisedPaperResult?.grade})
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Student Overall Comparison */}
                  <div className="rounded-lg border bg-white p-4">
                    <h3 className="font-semibold text-gray-900 border-b pb-2">
                      Overall Student Result
                    </h3>
                    <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Original SGPA</div>
                        <div className="text-lg font-semibold">{preview.correction.originalStudentResult?.sgpa ?? '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Revised SGPA</div>
                        <div className="text-lg font-bold text-green-700">
                          {preview.correction.revisedStudentResult?.sgpa ?? '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Original Percentage</div>
                        <div>{preview.correction.originalStudentResult?.percentage ?? '—'}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Revised Percentage</div>
                        <div className="font-semibold text-green-700">
                          {preview.correction.revisedStudentResult?.percentage ?? '—'}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Action in Step 4 */}
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleApplyMarkUpdate}
                    disabled={processing}
                    className="rounded-lg bg-green-700 px-6 py-2.5 text-sm font-bold text-white hover:bg-green-800 shadow-md"
                  >
                    {processing ? 'Applying…' : '⚡ Confirm & Apply Mark Update to Result'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLICATIONS LIST & REGISTRATION */}
        {activeTab === 'applications' && (
          <div className="space-y-6">
            {/* New Application Form */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-gray-900">Register Rechecking / Revaluation Application</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">
                  College / Autonomous Roll
                  <input
                    className="mt-1 w-full rounded-lg border p-2.5 uppercase"
                    value={appForm.studentRoll}
                    onChange={(e) => setAppForm((p) => ({ ...p, studentRoll: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Student Name
                  <input
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.studentName}
                    onChange={(e) => setAppForm((p) => ({ ...p, studentName: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Batch
                  <input
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.batch}
                    onChange={(e) => setAppForm((p) => ({ ...p, batch: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Program
                  <select
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.program}
                    onChange={(e) => setAppForm((p) => ({ ...p, program: e.target.value }))}
                  >
                    <option value="UG">UG</option>
                    <option value="PG">PG</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Semester
                  <input
                    type="number"
                    min={1}
                    max={6}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.semester}
                    onChange={(e) => setAppForm((p) => ({ ...p, semester: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Paper Code
                  <input
                    className="mt-1 w-full rounded-lg border p-2.5 uppercase"
                    placeholder="e.g. CC-101 or 1.1"
                    value={appForm.paperCode}
                    onChange={(e) => setAppForm((p) => ({ ...p, paperCode: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Requested Mark (Optional)
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.requestedMarks}
                    onChange={(e) => setAppForm((p) => ({ ...p, requestedMarks: e.target.value }))}
                  />
                </label>
                <label className="text-sm font-medium text-gray-700 sm:col-span-2">
                  Reason for Rechecking / Revaluation
                  <input
                    className="mt-1 w-full rounded-lg border p-2.5"
                    value={appForm.reason}
                    onChange={(e) => setAppForm((p) => ({ ...p, reason: e.target.value }))}
                  />
                </label>
              </div>
              <button
                onClick={() => void handleRegisterApp()}
                disabled={savingApp}
                className="mt-4 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingApp ? 'Registering…' : 'Register Application'}
              </button>
            </div>

            {/* Applications Table */}
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-gray-900">
                  Registered Applications ({applications.length})
                </h2>
                <button
                  onClick={() => void loadInitialData()}
                  disabled={loading}
                  className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="border p-2.5">App ID</th>
                      <th className="border p-2.5">Student</th>
                      <th className="border p-2.5">Exam / Paper</th>
                      <th className="border p-2.5">Reason</th>
                      <th className="border p-2.5 text-center">Req. Mark</th>
                      <th className="border p-2.5 text-center">Status</th>
                      <th className="border p-2.5">Decision Notes</th>
                      <th className="border p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => {
                      const isExpanded = expandedAppId === app.id;
                      const appCorrections = corrections.filter(
                        (c) =>
                          c.applicationId === app.id ||
                          c.id === app.correctionId ||
                          (String(c.studentRoll || '').trim().toLowerCase() === String(app.studentRoll || '').trim().toLowerCase() &&
                            (c.originalCalculationId === app.originalCalculationId || !app.originalCalculationId))
                      );

                      const papersUpdatedList: any[] = Array.isArray((app as any).papersUpdated) && (app as any).papersUpdated.length > 0
                        ? (app as any).papersUpdated
                        : appCorrections.map((c) => ({
                            paperCode: c.paperCode,
                            paperTitle: c.paperTitle || c.paperCode,
                            component: c.component || 'sem',
                            oldValue: c.oldValue,
                            newValue: c.newValue,
                            originalMarks: c.originalPaperResult?.marks ?? '—',
                            revisedMarks: c.revisedPaperResult?.marks ?? '—',
                            originalGrade: c.originalPaperResult?.grade ?? '—',
                            revisedGrade: c.revisedPaperResult?.grade ?? '—',
                            appliedAt: c.appliedAt,
                          }));

                      const totalPapersDone = (app as any).papersCount || papersUpdatedList.length || 1;

                      return (
                        <Fragment key={app.id}>
                          <tr
                            className={`transition-colors cursor-pointer ${
                              isExpanded ? 'bg-indigo-50/80 font-medium' : 'hover:bg-blue-50/50'
                            }`}
                            onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                          >
                            <td className="border p-2.5 font-semibold text-blue-900">
                              {app.id}
                              <div className="text-xs text-gray-400 font-normal">
                                {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}
                              </div>
                            </td>
                            <td className="border p-2.5">
                              <div className="font-semibold flex items-center gap-1.5">
                                <span>{app.studentName}</span>
                                {appCorrections.length > 0 && (
                                  <span className="rounded bg-indigo-100 text-indigo-800 text-[10px] font-bold px-1.5 py-0.5">
                                    Revised
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">{app.studentRoll}</div>
                            </td>
                            <td className="border p-2.5">
                              <div className="font-medium text-gray-800">
                                {app.program} Sem {app.semester} (Batch {app.batch || '-'})
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="rounded bg-slate-100 text-slate-800 text-[10px] font-extrabold px-1.5 py-0.5 border">
                                  📄 {totalPapersDone} Paper{totalPapersDone > 1 ? 's' : ''} Done
                                </span>
                                <span className="text-xs font-bold text-blue-900">{app.paperCode || 'All papers'}</span>
                              </div>
                            </td>
                            <td className="border p-2.5 max-w-xs">{app.reason}</td>
                            <td className="border p-2.5 text-center font-medium">{app.requestedMarks ?? '—'}</td>
                            <td className="border p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <select
                                className="rounded border p-1 text-xs font-semibold"
                                value={app.status}
                                disabled={app.status === 'Completed'}
                                onChange={(e) => void handleUpdateApp(app, { status: e.target.value })}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="border p-2.5" onClick={(e) => e.stopPropagation()}>
                              <input
                                className="w-44 rounded border p-1 text-xs"
                                value={notes[app.id] ?? app.decisionNotes ?? ''}
                                disabled={app.status === 'Completed'}
                                onChange={(e) => setNotes((p) => ({ ...p, [app.id]: e.target.value }))}
                                placeholder="Add decision note…"
                              />
                            </td>
                            <td className="border p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <button
                                  className="rounded border px-2 py-1 text-xs"
                                  disabled={app.status === 'Completed'}
                                  onClick={() => void handleUpdateApp(app, { decisionNotes: notes[app.id] ?? app.decisionNotes ?? '' })}
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => startRecheckingFromApp(app)}
                                  className="rounded bg-blue-700 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                                >
                                  Update Marks
                                </button>
                                <button
                                  onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                                  className={`rounded px-2 py-1 text-xs font-bold ${
                                    isExpanded
                                      ? 'bg-indigo-700 text-white'
                                      : 'border border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                                  }`}
                                  title="View changes and correction history"
                                >
                                  {isExpanded ? 'Hide History' : '📜 History'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Correction History Details */}
                          {isExpanded && (
                            <tr key={`history-${app.id}`}>
                              <td colSpan={8} className="border bg-indigo-50/40 p-4">
                                <div className="rounded-xl border-2 border-indigo-200 bg-white p-5 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                                    <div>
                                      <h3 className="text-base font-bold text-gray-900">
                                        📜 Correction History &amp; Audit Trail: {app.studentName} ({app.studentRoll})
                                      </h3>
                                      <p className="text-xs text-gray-500">
                                        Summary of updated papers, mark adjustments, and recalculated SGPA.
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-900 border border-blue-200">
                                        {totalPapersDone} Paper{totalPapersDone > 1 ? 's' : ''} Corrected
                                      </span>
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                                          app.status === 'Completed'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-amber-100 text-amber-800'
                                        }`}
                                      >
                                        Status: {app.status}
                                      </span>
                                    </div>
                                  </div>

                                  {papersUpdatedList.length > 0 ? (
                                    <div className="mt-4 space-y-4">
                                      {/* Multi-Paper Breakdown Table */}
                                      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                                        <table className="w-full text-xs border-collapse">
                                          <thead>
                                            <tr className="bg-gray-100 text-gray-800 font-bold border-b">
                                              <th className="p-2.5 text-center">#</th>
                                              <th className="p-2.5 text-left">Paper Code</th>
                                              <th className="p-2.5 text-left">Subject Title</th>
                                              <th className="p-2.5 text-center">Component</th>
                                              <th className="p-2.5 text-center">Mark Delta</th>
                                              <th className="p-2.5 text-center">Subject Total &amp; Grade</th>
                                              <th className="p-2.5 text-center">Date Applied</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {papersUpdatedList.map((p: any, pIdx: number) => (
                                              <tr key={`${p.paperCode}-${pIdx}`} className="border-b hover:bg-gray-50">
                                                <td className="p-2.5 text-center font-medium text-gray-500">{pIdx + 1}</td>
                                                <td className="p-2.5 font-bold text-blue-900">{p.paperCode}</td>
                                                <td className="p-2.5 text-gray-800">{p.paperTitle || p.paperCode}</td>
                                                <td className="p-2.5 text-center uppercase font-semibold text-gray-700">{p.component || 'sem'}</td>
                                                <td className="p-2.5 text-center">
                                                  <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                                    {p.oldValue ?? '—'} → {p.newValue}
                                                  </span>
                                                </td>
                                                <td className="p-2.5 text-center">
                                                  <div className="flex items-center justify-center gap-1.5">
                                                    <span className="text-gray-500">{p.originalMarks} ({p.originalGrade})</span>
                                                    <span>→</span>
                                                    <span className="font-bold text-green-700">{p.revisedMarks} ({p.revisedGrade})</span>
                                                  </div>
                                                </td>
                                                <td className="p-2.5 text-center text-gray-500 text-[11px]">
                                                  {p.appliedAt ? new Date(p.appliedAt).toLocaleString() : (app.updatedAt ? new Date(app.updatedAt).toLocaleString() : '—')}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>

                                      {/* Overall Student Result Changes */}
                                      {((app as any).originalStudentResult || appCorrections[0]?.originalStudentResult) && (
                                        <div className="grid gap-4 md:grid-cols-2">
                                          <div className="rounded-lg border border-gray-200 p-3.5 bg-gray-50/50">
                                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Overall SGPA &amp; Percentage</div>
                                            <div className="mt-2 flex items-center justify-between text-sm">
                                              <div>
                                                <span className="text-gray-500">Original:</span>{' '}
                                                <strong>SGPA {((app as any).originalStudentResult ?? appCorrections[0]?.originalStudentResult)?.sgpa ?? '—'}</strong> ({((app as any).originalStudentResult ?? appCorrections[0]?.originalStudentResult)?.percentage ?? '—'}%)
                                              </div>
                                              <div className="font-bold text-green-700">
                                                <span className="text-gray-500">Revised:</span>{' '}
                                                SGPA {((app as any).revisedStudentResult ?? appCorrections[0]?.revisedStudentResult)?.sgpa ?? '—'} ({((app as any).revisedStudentResult ?? appCorrections[0]?.revisedStudentResult)?.percentage ?? '—'}%)
                                              </div>
                                            </div>
                                          </div>

                                          <div className="rounded-lg border border-gray-200 p-3.5 bg-gray-50/50">
                                            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">Result Status</div>
                                            <div className="mt-2 flex items-center justify-between text-sm">
                                              <div>
                                                <span className="text-gray-500">Original Status:</span>{' '}
                                                <strong>{((app as any).originalStudentResult ?? appCorrections[0]?.originalStudentResult)?.status ?? 'PASS'}</strong>
                                              </div>
                                              <div className="font-bold text-green-700">
                                                <span className="text-gray-500">Revised Status:</span>{' '}
                                                {((app as any).revisedStudentResult ?? appCorrections[0]?.revisedStudentResult)?.status ?? 'PASS'}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {/* Justification & Notes */}
                                      <div className="rounded-lg bg-amber-50/70 border border-amber-200 p-3 text-xs text-amber-900">
                                        <div><strong>Reason / Justification:</strong> {app.reason || 'Mark update approved through rechecking'}</div>
                                        {app.decisionNotes && (
                                          <div className="mt-1 font-medium">Notes: {app.decisionNotes}</div>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="mt-3 p-4 text-center text-sm text-gray-500">
                                      {app.status === 'Completed'
                                        ? 'Mark update completed for this student.'
                                        : 'Application registered. Click "Update Marks" on the right to preview and apply the correction.'}
                                      {app.decisionNotes && (
                                        <div className="mt-2 text-xs text-gray-700 font-medium">Notes: {app.decisionNotes}</div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                    {!loading && applications.length === 0 && (
                      <tr>
                        <td colSpan={8} className="border p-5 text-center text-gray-500">
                          No applications registered yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CORRECTION HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-6">
            <div className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    Approved Mark Corrections History
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Comprehensive audit trail of mark modifications. Original published results remain untouched while revised versions are preserved.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search by roll, name, paper…"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="rounded-lg border p-2 text-xs"
                  />
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => setHistoryStatusFilter(e.target.value as any)}
                    className="rounded-lg border p-2 text-xs font-semibold"
                  >
                    <option value="all">All Records ({corrections.length})</option>
                    <option value="applied">
                      Applied ({corrections.filter((c) => c.status === 'applied').length})
                    </option>
                    <option value="preview">
                      Preview Only ({corrections.filter((c) => c.status === 'preview').length})
                    </option>
                  </select>
                  <button
                    onClick={() => void loadInitialData()}
                    disabled={loading}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg bg-gray-50 p-3 text-center">
                  <div className="text-xs text-gray-500">Total Recorded</div>
                  <div className="text-lg font-bold text-gray-800">{corrections.length}</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3 text-center">
                  <div className="text-xs text-green-700">Applied Corrections</div>
                  <div className="text-lg font-bold text-green-800">
                    {corrections.filter((c) => c.status === 'applied').length}
                  </div>
                </div>
                <div className="rounded-lg bg-amber-50 p-3 text-center">
                  <div className="text-xs text-amber-700">Preview Checks</div>
                  <div className="text-lg font-bold text-amber-800">
                    {corrections.filter((c) => c.status === 'preview').length}
                  </div>
                </div>
                <div className="rounded-lg bg-blue-50 p-3 text-center">
                  <div className="text-xs text-blue-700">Published Original</div>
                  <div className="text-lg font-bold text-blue-800">Preserved</div>
                </div>
              </div>

              {/* History Table */}
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      <th className="border p-2.5">Correction ID</th>
                      <th className="border p-2.5">Applied / Created</th>
                      <th className="border p-2.5">Student</th>
                      <th className="border p-2.5">Exam Scope</th>
                      <th className="border p-2.5">Paper & Component</th>
                      <th className="border p-2.5 text-center">Mark Modification</th>
                      <th className="border p-2.5 text-center">Status</th>
                      <th className="border p-2.5">Reason & Audit Trail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {corrections
                      .filter((c) => {
                        if (historyStatusFilter !== 'all' && c.status !== historyStatusFilter) return false;
                        if (!historySearch.trim()) return true;
                        const q = historySearch.trim().toLowerCase();
                        return (
                          String(c.studentRoll || '').toLowerCase().includes(q) ||
                          String(c.studentName || '').toLowerCase().includes(q) ||
                          String(c.paperCode || '').toLowerCase().includes(q) ||
                          String(c.id || '').toLowerCase().includes(q)
                        );
                      })
                      .map((c) => {
                        const diff =
                          c.newValue !== null && c.oldValue !== null && c.newValue !== undefined && c.oldValue !== undefined
                            ? Number(c.newValue) - Number(c.oldValue)
                            : null;

                        return (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="border p-2.5 font-bold text-blue-900">
                              {c.id}
                              {c.applicationId && (
                                <div className="text-[10px] text-gray-400 font-normal">
                                  App: {c.applicationId}
                                </div>
                              )}
                            </td>
                            <td className="border p-2.5 text-gray-600">
                              {c.appliedAt
                                ? new Date(c.appliedAt).toLocaleString()
                                : c.createdAt
                                  ? new Date(c.createdAt).toLocaleString()
                                  : '—'}
                            </td>
                            <td className="border p-2.5">
                              <div className="font-semibold text-gray-900">{c.studentName || '—'}</div>
                              <div className="font-mono text-gray-500">{c.studentRoll}</div>
                            </td>
                            <td className="border p-2.5">
                              {c.program} Sem {c.semester} (Batch {c.batch || '-'})
                              <div className="text-gray-400">{c.department || c.course || 'All'}</div>
                            </td>
                            <td className="border p-2.5">
                              <div className="font-semibold text-gray-800">{c.paperCode}</div>
                              <div className="text-gray-500">{c.paperTitle || ''}</div>
                              <span className="inline-block rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                                {c.component}
                              </span>
                            </td>
                            <td className="border p-2.5 text-center">
                              <div className="font-bold">
                                <span className="text-gray-500">{c.oldValue ?? '—'}</span>
                                <span className="mx-1 text-gray-400">→</span>
                                <span className="text-blue-700">{c.newValue}</span>
                              </div>
                              {diff !== null && (
                                <div
                                  className={`text-[10px] font-bold ${
                                    diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-500'
                                  }`}
                                >
                                  {diff > 0 ? `+${diff}` : diff}
                                </div>
                              )}
                            </td>
                            <td className="border p-2.5 text-center">
                              {c.status === 'applied' ? (
                                <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                                  Applied
                                </span>
                              ) : (
                                <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                                  Preview Only
                                </span>
                              )}
                            </td>
                            <td className="border p-2.5">
                              <div className="font-medium text-gray-800">{c.reason || '—'}</div>
                              {Array.isArray(c.history) && c.history.length > 0 && (
                                <div className="mt-1 space-y-0.5 border-t pt-1 text-[10px] text-gray-500">
                                  {c.history.map((h: any, i: number) => (
                                    <div key={i}>
                                      • {h.action}{' '}
                                      <span className="text-gray-400">
                                        ({h.at ? new Date(h.at).toLocaleTimeString() : ''})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    {corrections.length === 0 && (
                      <tr>
                        <td colSpan={8} className="border p-5 text-center text-gray-500">
                          No correction history records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
