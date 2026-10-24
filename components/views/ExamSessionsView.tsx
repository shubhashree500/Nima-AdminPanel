'use client';

import React, { useEffect, useState } from 'react';
import type { DBData, ExamSession, ExamSessionStatus, ExamType, ProgramKey } from '@/types';
import { PROG } from '@/types';

interface ExamSessionsViewProps {
  onSync?: () => Promise<void>;
  db: DBData;
  onSaveSetup: (college: string, max: number, pass: number) => Promise<boolean>;
  onAddSubject: (prog: ProgramKey, sem: number, name: string) => Promise<boolean>;
  onRemoveSubject: (prog: ProgramKey, sem: number, index: number) => Promise<boolean>;
  onCopySubjects: (prog: ProgramKey, sem: number) => Promise<boolean>;
  onResetDemo: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

const EMPTY_FORM = {
  academicYear: '2025-26',
  batch: '2025',
  program: 'UG',
  course: '',
  department: '',
  semester: '1',
  examType: 'Regular' as ExamType,
};

export function ExamSessionsView({
  onSync, db, onSaveSetup, onAddSubject, onRemoveSubject, onCopySubjects, onResetDemo, onClearAll,
}: ExamSessionsViewProps) {
  const [activeTab, setActiveTab] = useState<'sessions' | 'setup'>('sessions');
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const [message, setMessage] = useState<{
    text: string;
    type: 'ok' | 'bad';
  } | null>(null);

  const loadSessions = async () => {
    try {
      setLoading(true);

      const response = await fetch('/api/exam-sessions');

      const json = await response.json();

      if (json.success) {
        setSessions(json.sessions || []);
      } else {
        setMessage({
          text: json.error || 'Failed to load exam sessions.',
          type: 'bad',
        });
      }
    } catch (error) {
      console.error('Error loading exam sessions:', error);

      setMessage({
        text: 'Failed to load exam sessions.',
        type: 'bad',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const updateForm = (
    field: keyof typeof EMPTY_FORM,
    value: string
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setMessage(null);
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setMessage(null);
    setShowForm(true);
  };

  const handleEdit = (session: ExamSession) => {
    setForm({
      academicYear: session.academicYear,
      batch: String(session.batch),
      program: session.program === 'PG' ? 'PG' : 'UG',
      course: session.course || '',
      department: session.department || '',
      semester: String(session.semester),
      examType: session.examType,
    });

    setEditingId(session.id);
    setMessage(null);
    setShowForm(true);
  };

  const validateForm = () => {
    if (!form.academicYear.trim()) {
      setMessage({
        text: 'Academic year is required.',
        type: 'bad',
      });
      return false;
    }

    const batch = Number(form.batch);

    if (!Number.isInteger(batch) || batch < 2000) {
      setMessage({
        text: 'Enter a valid batch year.',
        type: 'bad',
      });
      return false;
    }

    if (form.program === 'UG' && !form.course.trim()) {
      setMessage({
        text: 'Course is required for UG.',
        type: 'bad',
      });
      return false;
    }

    if (form.program === 'PG' && !form.department.trim()) {
      setMessage({
        text: 'Department is required for PG.',
        type: 'bad',
      });
      return false;
    }

    const semester = Number(form.semester);
    const maxSemester = form.program === 'UG' ? 6 : 4;

    if (!Number.isInteger(semester) || semester < 1 || semester > maxSemester) {
      setMessage({
        text: `Enter a semester between 1 and ${maxSemester} for ${form.program}.`,
        type: 'bad',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        academicYear: form.academicYear.trim(),
        batch: Number(form.batch),
        program: form.program,
        course:
          form.program === 'UG'
            ? form.course.trim()
            : undefined,
        department:
          form.program === 'PG'
            ? form.department.trim()
            : undefined,
        semester: Number(form.semester),
        examType: form.examType,
      };

      const response = await fetch('/api/exam-sessions', {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          editingId
            ? {
                id: editingId,
                ...payload,
              }
            : payload
        ),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        setMessage({
          text: json.error || 'Failed to save exam session.',
          type: 'bad',
        });
        return;
      }

      if (editingId) {
        setSessions((current) =>
          current.map((session) =>
            session.id === editingId
              ? json.session
              : session
          )
        );

        setMessage({
          text: 'Exam session updated successfully.',
          type: 'ok',
        });
      } else {
        setSessions((current) => [
          ...current,
          json.session,
        ]);

        setMessage({
          text: 'Exam session created successfully.',
          type: 'ok',
        });
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);

      if (onSync) {
        await onSync();
      }
    } catch (error) {
      console.error('Error saving exam session:', error);

      setMessage({
        text: 'Failed to save exam session.',
        type: 'bad',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (
    session: ExamSession,
    status: ExamSessionStatus
  ) => {
    try {
      const response = await fetch('/api/exam-sessions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: session.id,
          status,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        setMessage({
          text: json.error || 'Failed to update status.',
          type: 'bad',
        });
        return;
      }

      setSessions((current) =>
        current.map((item) =>
          item.id === session.id
            ? json.session
            : item
        )
      );

      setMessage({
        text: 'Session status updated.',
        type: 'ok',
      });
    } catch (error) {
      console.error('Error updating status:', error);

      setMessage({
        text: 'Failed to update session status.',
        type: 'bad',
      });
    }
  };

  const handleDelete = async (session: ExamSession) => {
    const confirmed = window.confirm(
      `Delete "${getSessionTitle(session)}"?\n\nThis only deletes the examination session.`
    );

    if (!confirmed) return;

    try {
      const response = await fetch('/api/exam-sessions', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: session.id,
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        setMessage({
          text: json.error || 'Failed to delete session.',
          type: 'bad',
        });
        return;
      }

      setSessions((current) =>
        current.filter((item) => item.id !== session.id)
      );

      setMessage({
        text: 'Exam session deleted.',
        type: 'ok',
      });

      if (editingId === session.id) {
        resetForm();
      }
    } catch (error) {
      console.error('Error deleting exam session:', error);

      setMessage({
        text: 'Failed to delete exam session.',
        type: 'bad',
      });
    }
  };

  const getSessionTitle = (session: ExamSession) => {
    const courseOrDepartment =
      session.program === 'PG'
        ? session.department || 'PG'
        : session.course || 'UG';

    return `${session.academicYear} • ${courseOrDepartment} • Semester ${session.semester}`;
  };

  const getStatusClass = (status: ExamSessionStatus) => {
    switch (status) {
      case 'Published':
        return 'status published';

      case 'Verification':
        return 'status verification';

      case 'Processing':
        return 'status processing';

      case 'Marks Entry':
        return 'status marks-entry';

      case 'Closed':
        return 'status closed';

      default:
        return 'status draft';
    }
  };

  return (
    <div className="exam-management-view">
      <div className="exam-management-tabs" role="tablist" aria-label="Exam management" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
        <button type="button" role="tab" aria-selected={activeTab === 'sessions'} className={activeTab === 'sessions' ? 'btn primary' : 'btn'} onClick={() => setActiveTab('sessions')}>Exam Sessions</button>
        <button type="button" role="tab" aria-selected={activeTab === 'setup'} className={activeTab === 'setup' ? 'btn primary' : 'btn'} onClick={() => setActiveTab('setup')}>Exam Setup &amp; Subjects</button>
      </div>
      {activeTab === 'sessions' ? (
      <>
      <div className="view-header">
        <div>
          <h1>Exam Sessions</h1>

          <p className="sub">
            Create and manage examination sessions for different
            batches, courses, departments and semesters.
          </p>
        </div>

        <button
          className="btn primary"
          onClick={handleCreate}
        >
          + Create Exam Session
        </button>
      </div>

      {message && (
        <div className={`msg ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <h2 style={{ margin: 0 }}>
              {editingId
                ? 'Edit Exam Session'
                : 'Create Exam Session'}
            </h2>

            <button
              className="btn"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>

          <div className="row">
            <label>
              Academic Year
              <input
                placeholder="2025-26"
                value={form.academicYear}
                onChange={(e) =>
                  updateForm(
                    'academicYear',
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Batch
              <input
                type="number"
                min={2000}
                value={form.batch}
                onChange={(e) =>
                  updateForm(
                    'batch',
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Program
              <select
                value={form.program}
                onChange={(e) => {
                  const value = e.target.value;

                  updateForm('program', value);

                  if (value === 'UG') {
                    setForm((current) => ({
                      ...current,
                      program: 'UG',
                      department: '',
                    }));
                  } else {
                    setForm((current) => ({
                      ...current,
                      program: 'PG',
                      course: '',
                    }));
                  }
                }}
              >
                <option value="UG">
                  UG
                </option>

                <option value="PG">
                  PG
                </option>
              </select>
            </label>

            {form.program === 'UG' ? (
              <label>
                Course
                <input
                  placeholder="BBA / BCA / B.A / B.Sc"
                  value={form.course}
                  onChange={(e) =>
                    updateForm(
                      'course',
                      e.target.value
                    )
                  }
                />
              </label>
            ) : (
              <label>
                Department
                <input
                  placeholder="Chemistry"
                  value={form.department}
                  onChange={(e) =>
                    updateForm(
                      'department',
                      e.target.value
                    )
                  }
                />
              </label>
            )}

            <label>
              Semester
              <select
                value={form.semester}
                onChange={(e) =>
                  updateForm(
                    'semester',
                    e.target.value
                  )
                }
              >
                {Array.from(
                  { length: form.program === 'UG' ? 6 : 4 },
                  (_, index) => index + 1
                ).map((semester) => (
                  <option
                    key={semester}
                    value={semester}
                  >
                    Semester {semester}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Examination Type
              <select
                value={form.examType}
                onChange={(e) =>
                  updateForm(
                    'examType',
                    e.target.value
                  )
                }
              >
                <option value="Regular">
                  Regular
                </option>

                <option value="Back">
                  Back
                </option>

                <option value="Improvement">
                  Improvement
                </option>

                <option value="Special">
                  Special
                </option>
              </select>
            </label>
          </div>

          <div
            className="hint"
            style={{ marginTop: 12 }}
          >
            The session starts in <strong>Draft</strong>
            status. Students, papers, mark foils and result
            processing will be connected to this session later.
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              marginTop: 16,
            }}
          >
            <button
              className="btn primary"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving
                ? 'Saving...'
                : editingId
                  ? 'Update Session'
                  : 'Create Session'}
            </button>

            <button
              className="btn"
              onClick={resetForm}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Examination Sessions
            </h2>

            <p
              className="hint"
              style={{ margin: '4px 0 0' }}
            >
              {sessions.length} session
              {sessions.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            className="btn"
            onClick={loadSessions}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="empty">
            Loading exam sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="empty">
            No examination sessions created yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>
                    Academic Year
                  </th>

                  <th style={thStyle}>
                    Batch
                  </th>

                  <th style={thStyle}>
                    Program
                  </th>

                  <th style={thStyle}>
                    Course / Department
                  </th>

                  <th style={thStyle}>
                    Semester
                  </th>

                  <th style={thStyle}>
                    Exam Type
                  </th>

                  <th style={thStyle}>
                    Status
                  </th>

                  <th style={thStyle}>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td style={tdStyle}>
                      {session.academicYear}
                    </td>

                    <td style={tdStyle}>
                      {session.batch}
                    </td>

                    <td style={tdStyle}>
                      {session.program}
                    </td>

                    <td style={tdStyle}>
                      {session.program === 'PG'
                        ? session.department || '-'
                        : session.course || '-'}
                    </td>

                    <td style={tdStyle}>
                      Semester {session.semester}
                    </td>

                    <td style={tdStyle}>
                      {session.examType}
                    </td>

                    <td style={tdStyle}>
                      <select
                        value={session.status}
                        className={getStatusClass(
                          session.status
                        )}
                        onChange={(e) =>
                          handleStatusChange(
                            session,
                            e.target
                              .value as ExamSessionStatus
                          )
                        }
                      >
                        <option value="Draft">
                          Draft
                        </option>

                        <option value="Marks Entry">
                          Marks Entry
                        </option>

                        <option value="Processing">
                          Processing
                        </option>

                        <option value="Verification">
                          Verification
                        </option>

                        <option value="Published">
                          Published
                        </option>

                        <option value="Closed">
                          Closed
                        </option>
                      </select>
                    </td>

                    <td style={tdStyle}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <button
                          className="btn"
                          onClick={() =>
                            handleEdit(session)
                          }
                        >
                          Edit
                        </button>

                        <button
                          className="btn danger"
                          onClick={() =>
                            handleDelete(session)
                          }
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      ) : (
        <SetupView
          db={db}
          onSaveSetup={onSaveSetup}
          onAddSubject={onAddSubject}
          onRemoveSubject={onRemoveSubject}
          onCopySubjects={onCopySubjects}
          onResetDemo={onResetDemo}
          onClearAll={onClearAll}
        />
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 8px',
  borderBottom: '1px solid #ddd',
  fontSize: 13,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 8px',
  borderBottom: '1px solid #eee',
  fontSize: 14,
  verticalAlign: 'middle',
};


// Exam Setup is kept in this same file so both workflows live in one module.
interface SetupViewProps {
  db: DBData;
  onSaveSetup: (college: string, max: number, pass: number) => Promise<boolean>;
  onAddSubject: (prog: ProgramKey, sem: number, name: string) => Promise<boolean>;
  onRemoveSubject: (prog: ProgramKey, sem: number, index: number) => Promise<boolean>;
  onCopySubjects: (prog: ProgramKey, sem: number) => Promise<boolean>;
  onResetDemo: () => Promise<void>;
  onClearAll: () => Promise<void>;
}

type PaperGroupType = 'Major' | 'Minor' | 'MDC' | 'VAC' | 'Papers';
type ConfiguredPaperGroup = { id: string; type: PaperGroupType; papers: string[] };
type ConfiguredDepartment = {
  id: string;
  program: 'UG' | 'PG';
  semester: number;
  name: string;
  groups: ConfiguredPaperGroup[];
};

const UG_GROUPS: PaperGroupType[] = ['Major', 'Minor', 'MDC', 'VAC'];

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeConfiguredItem(program: 'UG' | 'PG', semester: number, name: string): ConfiguredDepartment {
  const groupTypes: PaperGroupType[] = program === 'UG' ? UG_GROUPS : ['Papers'];
  return {
    id: makeId(),
    program,
    semester,
    name,
    groups: groupTypes.map(type => ({ id: makeId(), type, papers: [] })),
  };
}

function SetupView({ db, onSaveSetup, onResetDemo, onClearAll }: SetupViewProps) {
  const [collegeName, setCollegeName] = useState(db.college);
  const [maxMarks, setMaxMarks] = useState(String(db.max));
  const [passMarks, setPassMarks] = useState(String(db.pass));
  const [cfgMsg, setCfgMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);
  const [program, setProgram] = useState<'UG' | 'PG'>('UG');
  const [semester, setSemester] = useState(1);
  const [configuredItems, setConfiguredItems] = useState<ConfiguredDepartment[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [loadingStructure, setLoadingStructure] = useState(true);
  const [savingStructure, setSavingStructure] = useState(false);
  const [structureMsg, setStructureMsg] = useState<{ text: string; type: 'ok' | 'bad' } | null>(null);
  const [confirmAction, setConfirmAction] = useState<'' | 'demo' | 'all'>('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCollegeName(db.college);
    setMaxMarks(String(db.max));
    setPassMarks(String(db.pass));
  }, [db.college, db.max, db.pass]);

  const loadStructure = async () => {
    try {
      setLoadingStructure(true);
      const response = await fetch('/api/exam-structure');
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Could not load exam structure.');
      const items = Array.isArray(json.items) ? json.items as ConfiguredDepartment[] : [];
      setConfiguredItems(items);
      setSelectedId(current => items.some(item => item.id === current) ? current : '');
    } catch (error) {
      setStructureMsg({ text: error instanceof Error ? error.message : 'Could not load exam structure.', type: 'bad' });
    } finally {
      setLoadingStructure(false);
    }
  };

  useEffect(() => { void loadStructure(); }, []);

  const visibleItems = configuredItems.filter(item => item.program === program && item.semester === semester);
  const selectedItem = visibleItems.find(item => item.id === selectedId) || null;

  useEffect(() => {
    if (!visibleItems.some(item => item.id === selectedId)) setSelectedId(visibleItems[0]?.id || '');
    // Selection is intentionally reconciled when program/semester changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program, semester, configuredItems]);

  const persistItems = async (next: ConfiguredDepartment[], successText = 'Exam structure saved.') => {
    setSavingStructure(true);
    setStructureMsg(null);
    try {
      const response = await fetch('/api/exam-structure', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: next }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Could not save exam structure.');
      const saved = Array.isArray(json.items) ? json.items as ConfiguredDepartment[] : next;
      setConfiguredItems(saved);
      setStructureMsg({ text: successText, type: 'ok' });
    } catch (error) {
      setStructureMsg({ text: error instanceof Error ? error.message : 'Could not save exam structure.', type: 'bad' });
    } finally {
      setSavingStructure(false);
    }
  };

  const addConfiguredItem = async () => {
    const name = newName.trim();
    if (!name) {
      setStructureMsg({ text: program === 'UG' ? 'Enter a department name.' : 'Enter a subject name.', type: 'bad' });
      return;
    }
    if (visibleItems.some(item => item.name.toLowerCase() === name.toLowerCase())) {
      setStructureMsg({ text: 'That name already exists for this program and semester.', type: 'bad' });
      return;
    }
    const item = makeConfiguredItem(program, semester, name);
    const next = [...configuredItems, item];
    await persistItems(next, `${program === 'UG' ? 'Department' : 'Subject'} added.`);
    setSelectedId(item.id);
    setNewName('');
  };

  const updateSelected = (updater: (item: ConfiguredDepartment) => ConfiguredDepartment, successText = 'Changes saved.') => {
    if (!selectedItem) return;
    const next = configuredItems.map(item => item.id === selectedItem.id ? updater(item) : item);
    void persistItems(next, successText);
  };

  const renameSelected = (name: string) => {
    if (!selectedItem) return;
    const clean = name.trim();
    if (!clean) { setStructureMsg({ text: 'Name cannot be empty.', type: 'bad' }); return; }
    if (visibleItems.some(item => item.id !== selectedItem.id && item.name.toLowerCase() === clean.toLowerCase())) {
      setStructureMsg({ text: 'Another item already uses that name.', type: 'bad' }); return;
    }
    updateSelected(item => ({ ...item, name: clean }), 'Name updated.');
  };

  const addPaper = (groupId: string) => updateSelected(item => ({
    ...item,
    groups: item.groups.map(group => group.id === groupId ? { ...group, papers: [...group.papers, ''] } : group),
  }), 'Paper field added. Enter its name and it will be saved.');

  const updatePaper = (groupId: string, index: number, value: string) => {
    if (!selectedItem) return;
    const next = configuredItems.map(item => item.id !== selectedItem.id ? item : ({
      ...item,
      groups: item.groups.map(group => group.id !== groupId ? group : ({
        ...group,
        papers: group.papers.map((paper, paperIndex) => paperIndex === index ? value : paper),
      })),
    }));
    setConfiguredItems(next);
  };

  const savePaperNames = async () => {
    if (!selectedItem) return;
    const next = configuredItems.map(item => item.id === selectedItem.id ? {
      ...item,
      groups: item.groups.map(group => ({ ...group, papers: group.papers.map(paper => paper.trim()) })),
    } : item);
    await persistItems(next, 'Paper names saved.');
  };

  const removePaper = (groupId: string, index: number) => updateSelected(item => ({
    ...item,
    groups: item.groups.map(group => group.id === groupId ? { ...group, papers: group.papers.filter((_, i) => i !== index) } : group),
  }), 'Paper removed.');

  const removeSelected = async () => {
    if (!selectedItem) return;
    if (!window.confirm(`Remove ${selectedItem.name} and its paper configuration from ${program} Semester ${semester}?`)) return;
    const next = configuredItems.filter(item => item.id !== selectedItem.id);
    await persistItems(next, `${program === 'UG' ? 'Department' : 'Subject'} removed.`);
    setSelectedId('');
  };

  const saveConfig = async () => {
    const m = Number(maxMarks), p = Number(passMarks);
    if (!Number.isFinite(m) || m <= 0 || !Number.isFinite(p) || p < 0 || p > m) {
      setCfgMsg({ text: 'Pass marks must be between 0 and full marks.', type: 'bad' }); return;
    }
    setBusy(true);
    try {
      const ok = await onSaveSetup(collegeName.trim() || 'Nimapara Autonomous College', m, p);
      setCfgMsg({ text: ok ? 'College and marks settings saved.' : 'Failed to save configuration.', type: ok ? 'ok' : 'bad' });
    } finally { setBusy(false); }
  };

  const runDangerAction = async (kind: 'demo' | 'all') => {
    if (confirmAction !== kind) { setConfirmAction(kind); return; }
    const finalConfirm = window.confirm(kind === 'demo'
      ? 'Reset the application to demo data? This may replace current demo-managed data.'
      : 'Delete all students and marks? This action cannot be undone.');
    setConfirmAction('');
    if (!finalConfirm) return;
    setBusy(true);
    try {
      if (kind === 'demo') { await onResetDemo(); setCfgMsg({ text: 'Reset to demo data completed.', type: 'ok' }); }
      else { await onClearAll(); setCfgMsg({ text: 'Student and mark data cleared.', type: 'ok' }); }
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="view-header">
        <div><h1>Exam Setup</h1><p className="sub">Configure college settings and define UG departments, PG subjects, paper groups and paper names.</p></div>
      </div>

      <div className="card">
        <h2>College and marks settings</h2>
        <p className="hint">These are the existing general settings. Program-specific UG/PG calculation engines remain unchanged.</p>
        <div className="row">
          <label>College name<input value={collegeName} onChange={e => { setCollegeName(e.target.value); setCfgMsg(null); }} /></label>
          <label>Full marks per subject<input type="number" min={1} value={maxMarks} onChange={e => { setMaxMarks(e.target.value); setCfgMsg(null); }} /></label>
          <label>Pass marks per subject<input type="number" min={0} value={passMarks} onChange={e => { setPassMarks(e.target.value); setCfgMsg(null); }} /></label>
          <button className="btn primary" onClick={saveConfig} disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button>
        </div>
        {cfgMsg && <div className={`msg ${cfgMsg.type}`} role="status">{cfgMsg.text}</div>}
      </div>

      <div className="card">
        <h2>Departments, subjects and papers</h2>
        <p className="hint">Choose UG or PG and a semester. UG uses Major, Minor, MDC and VAC groups. PG uses a configurable paper list for each subject.</p>
        <div className="row">
          <label>Program<select value={program} onChange={e => { setProgram(e.target.value as 'UG' | 'PG'); setSemester(1); setStructureMsg(null); setSelectedId(''); }}><option value="UG">UG</option><option value="PG">PG</option></select></label>
          <label>Semester<select value={semester} onChange={e => { setSemester(Number(e.target.value)); setStructureMsg(null); setSelectedId(''); }}>{Array.from({ length: PROG[program].sems }, (_, i) => i + 1).map(n => <option key={n} value={n}>Semester {n}</option>)}</select></label>
        </div>

        <div className="row" style={{ marginTop: 14 }}>
          <label>{program === 'UG' ? 'New department name' : 'New subject name'}<input placeholder={program === 'UG' ? 'e.g. Economics' : 'e.g. Odia'} value={newName} onChange={e => { setNewName(e.target.value); setStructureMsg(null); }} onKeyDown={e => { if (e.key === 'Enter') void addConfiguredItem(); }} /></label>
          <button className="btn primary" onClick={() => void addConfiguredItem()} disabled={savingStructure || loadingStructure}>{savingStructure ? 'Saving…' : program === 'UG' ? 'Add department' : 'Add subject'}</button>
          <button className="btn" onClick={() => void loadStructure()} disabled={loadingStructure || savingStructure}>{loadingStructure ? 'Loading…' : 'Refresh structure'}</button>
        </div>

        {structureMsg && <div className={`msg ${structureMsg.type}`} role="status">{structureMsg.text}</div>}
        {loadingStructure ? <div className="empty">Loading configured departments and subjects…</div> : (
          <>
            <div style={{ marginTop: 18 }}>
              <label>{program === 'UG' ? 'Configured departments' : 'Configured PG subjects'}
                <select value={selectedId} onChange={e => setSelectedId(e.target.value)} style={{ width: '100%', marginTop: 6 }}>
                  <option value="">Select {program === 'UG' ? 'a department' : 'a subject'}</option>
                  {visibleItems.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </label>
            </div>

            {!selectedItem ? <div className="empty" style={{ marginTop: 12 }}>No {program === 'UG' ? 'department' : 'subject'} configured for this semester. Add one above to define its papers.</div> : (
              <div style={{ marginTop: 18 }}>
                <div className="row" style={{ alignItems: 'end' }}>
                  <label>{program === 'UG' ? 'Department name' : 'Subject name'}<input key={selectedItem.id} defaultValue={selectedItem.name} onBlur={e => { if (e.target.value.trim() !== selectedItem.name) renameSelected(e.target.value); }} /></label>
                  <button className="btn danger" onClick={() => void removeSelected()} disabled={savingStructure}>Remove {program === 'UG' ? 'department' : 'subject'}</button>
                </div>

                <h3 style={{ marginTop: 20 }}>Paper configuration — {selectedItem.name}</h3>
                {selectedItem.groups.map(group => (
                  <div key={group.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <h4 style={{ margin: 0 }}>{group.type === 'Papers' ? 'Subject papers' : `${group.type} papers`}</h4>
                        <p className="hint" style={{ margin: '4px 0 0' }}>{group.papers.length} paper{group.papers.length === 1 ? '' : 's'} configured</p>
                      </div>
                      <button className="btn" onClick={() => addPaper(group.id)} disabled={savingStructure}>+ Add paper</button>
                    </div>
                    {group.papers.length === 0 ? <p className="empty">No papers added to this group yet.</p> : group.papers.map((paper, index) => (
                      <div key={`${group.id}-${index}`} className="row" style={{ marginTop: 10, alignItems: 'end' }}>
                        <label>{group.type === 'Papers' ? 'Paper' : group.type} {index + 1} name<input value={paper} placeholder={program === 'UG' && group.type === 'Major' ? `${selectedItem.name} Paper ${index + 1}` : `Enter ${group.type} paper name`} onChange={e => updatePaper(group.id, index, e.target.value)} /></label>
                        <button type="button" className="btn danger" onClick={() => removePaper(group.id, index)} disabled={savingStructure}>Remove</button>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn primary" onClick={() => void savePaperNames()} disabled={savingStructure}>{savingStructure ? 'Saving…' : 'Save paper names'}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Data maintenance</h2>
        <p className="hint">These actions affect student/mark data, not just the selected exam session. Use only when you intend to reset or clear data.</p>
        <div className="row">
          <button className="btn danger" disabled={busy} onClick={() => void runDangerAction('demo')}>{confirmAction === 'demo' ? 'Confirm reset…' : 'Reset demo data'}</button>
          <button className="btn danger" disabled={busy} onClick={() => void runDangerAction('all')}>{confirmAction === 'all' ? 'Confirm delete…' : 'Delete all students and marks'}</button>
          {confirmAction && <button className="btn" disabled={busy} onClick={() => setConfirmAction('')}>Cancel</button>}
        </div>
      </div>
    </>
  );
}
