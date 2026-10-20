'use client';

import { useCallback, useEffect, useState } from 'react';

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
  createdAt?: string;
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
  applied?: boolean;
};

const STATUSES = ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Completed'] as const;

export function RecheckingView() {
  const [activeTab, setActiveTab] = useState<'recheck' | 'applications' | 'history'>('recheck');

  // Calculations & Applications
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [selectedCalcId, setSelectedCalcId] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
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

  // Preview & Processing state
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [processing, setProcessing] = useState(false);

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
    const [verRes, recRes] = await Promise.all([
      fetch('/api/verify', { cache: 'no-store' }),
      fetch('/api/rechecking', { cache: 'no-store' }),
    ]);

    const verJson = await verRes.json();
    const recJson = await recRes.json();

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

  // Handle Preview
  const handlePreviewRecalculation = async () => {
    if (!selectedCalcId || !studentRoll.trim() || !selectedPaperCode || newMark === '' || !updateReason.trim()) {
      setMessage({ text: 'Please fill in student roll, paper, component, new mark, and reason.', ok: false });
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
          paperCode: selectedPaperCode,
          component: selectedComponent,
          newValue: Number(newMark),
          reason: updateReason.trim(),
          applicationId: linkedAppId || undefined,
          apply: false,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Preview recalculation failed.');
      }

      setPreview(json);
      setMessage({ text: 'Recalculation preview generated. Review the revised results below.', ok: true });
    } catch (err: any) {
      setPreview(null);
      setMessage({ text: err.message || 'Preview failed.', ok: false });
    } finally {
      setProcessing(false);
    }
  };

  // Handle Apply Mark Update

const handleApplyMarkUpdate = async () => {
  if (
    !selectedCalcId ||
    !studentRoll.trim() ||
    !selectedPaperCode ||
    newMark === '' ||
    !updateReason.trim()
  ) {
    setMessage({
      text: 'Missing required parameters to apply mark update.',
      ok: false,
    });
    return;
  }

  if (!linkedAppId) {
    setMessage({
      text: 'Select an approved rechecking application before applying a mark correction.',
      ok: false,
    });
    return;
  }

  const confirm = window.confirm(
    `Apply mark correction for ${studentRoll} in paper ${selectedPaperCode} (${selectedComponent}: ${currentComponentVal ?? '—'} → ${newMark})?\n\nThe original published result will remain unchanged. The revised result will be stored separately for updated reports.`
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
        paperCode: selectedPaperCode,
        component: selectedComponent,
        newValue: Number(newMark),
        reason: updateReason.trim(),
        applicationId: linkedAppId,
        apply: true,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      throw new Error(json.error || 'Mark correction failed.');
    }

    setPreview(json);
    setMessage({
      text: 'Mark correction applied successfully. The original published result remains unchanged.',
      ok: true,
    });

    await loadStudentData(selectedCalcId, studentRoll);
    await loadInitialData();
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
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'recheck'
                    ? 'bg-blue-700 text-white shadow'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                }`}
              >
                Subject-Wise Mark Update
              </button>
              <button
                onClick={() => setActiveTab('applications')}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeTab === 'applications'
                    ? 'bg-blue-700 text-white shadow'
                    : 'bg-white border text-gray-700 hover:bg-gray-100'
                }`}
              >
                Applications ({applications.length})
              </button>
            </div>
          </div>
        </header>

        {message && (
          <div
            className={`rounded-xl border p-4 text-sm font-medium ${
              message.ok
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

                {linkedAppId && (
                  <div className="flex flex-col justify-end">
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                      Linked to Application: <strong>{linkedAppId}</strong>
                      <button
                        onClick={() => setLinkedAppId('')}
                        className="ml-2 font-bold text-red-600 hover:underline"
                      >
                        [Unlink]
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
                          className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
                            studentDetails.status === 'PASS'
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
                                className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                                  ['F', 'AB', 'M'].includes(paper.grade)
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-green-100 text-green-800'
                                }`}
                              >
                                {paper.grade} ({paper.gradePoint})
                              </span>
                            </td>
                            <td className="border p-2.5 text-center">{paper.creditPoint}</td>
                            <td className="border p-2.5 text-center">
                              <button
                                onClick={() => {
                                  setSelectedPaperCode(paper.code);
                                  setNewMark('');
                                  setPreview(null);
                                }}
                                className={`rounded px-3 py-1 text-xs font-semibold ${
                                  isSelected
                                    ? 'bg-blue-700 text-white'
                                    : 'border bg-white text-gray-700 hover:bg-gray-100'
                                }`}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </button>
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
                    <label className="text-sm font-medium text-gray-700">Target Paper</label>
                    <div className="mt-1 font-semibold text-gray-900 p-2.5 rounded-lg border bg-gray-50">
                      {currentPaper.code} — {currentPaper.title}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Mark Component</label>
                    <select
                      className="mt-1 w-full rounded-lg border p-2.5 text-sm font-medium"
                      value={selectedComponent}
                      onChange={(e) => {
                        setSelectedComponent(e.target.value as any);
                        setNewMark('');
                        setPreview(null);
                      }}
                    >
                      <option value="sem">Semester / Endsem Mark (Max: {currentPaper.components.sem.max})</option>
                      <option value="midsem">Midsem Mark (Max: {currentPaper.components.midsem.max})</option>
                      <option value="practical">Practical Mark (Max: {currentPaper.components.practical.max})</option>
                      <option value="attendance">Attendance Mark (Max: {currentPaper.components.attendance.max})</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">
                      Current Value vs Max
                    </label>
                    <div className="mt-1 p-2.5 rounded-lg border bg-gray-50 text-sm">
                      Current: <strong>{currentComponentVal ?? 'None'}</strong> | Max: <strong>{currentComponentMax}</strong>
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
                      placeholder="e.g. Scrutiny re-addition of Question 3 marks (+4) approved by Controller of Examinations"
                      value={updateReason}
                      onChange={(e) => setUpdateReason(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handlePreviewRecalculation}
                    disabled={processing || newMark === '' || !updateReason.trim()}
                    className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {processing ? 'Processing…' : 'Preview Recalculation'}
                  </button>

                  <button
                    onClick={handleApplyMarkUpdate}
                    disabled={processing || newMark === '' || !updateReason.trim()}
                    className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50"
                  >
                    {processing ? 'Saving…' : 'Apply Mark Update & Revise Result'}
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
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      preview.correction.status === 'applied'
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
                    {applications.map((app) => (
                      <tr key={app.id}>
                        <td className="border p-2.5 font-semibold text-blue-900">
                          {app.id}
                          <div className="text-xs text-gray-400 font-normal">
                            {app.createdAt ? new Date(app.createdAt).toLocaleDateString() : ''}
                          </div>
                        </td>
                        <td className="border p-2.5">
                          <div className="font-semibold">{app.studentName}</div>
                          <div className="text-xs text-gray-500">{app.studentRoll}</div>
                        </td>
                        <td className="border p-2.5">
                          {app.program} Sem {app.semester} (Batch {app.batch || '-'})
                          <div className="text-xs font-bold text-gray-600">{app.paperCode || 'All papers'}</div>
                        </td>
                        <td className="border p-2.5 max-w-xs">{app.reason}</td>
                        <td className="border p-2.5 text-center font-medium">{app.requestedMarks ?? '—'}</td>
                        <td className="border p-2.5 text-center">
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
                        <td className="border p-2.5">
                          <input
                            className="w-44 rounded border p-1 text-xs"
                            value={notes[app.id] ?? app.decisionNotes ?? ''}
                            disabled={app.status === 'Completed'}
                            onChange={(e) => setNotes((p) => ({ ...p, [app.id]: e.target.value }))}
                            placeholder="Add decision note…"
                          />
                        </td>
                        <td className="border p-2.5 text-center">
                          <div className="flex items-center justify-center gap-2">
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
                          </div>
                        </td>
                      </tr>
                    ))}
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
      </div>
    </section>
  );
}
