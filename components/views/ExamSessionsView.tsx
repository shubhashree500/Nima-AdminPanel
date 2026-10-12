'use client';

import React, { useEffect, useState } from 'react';
import type {
  ExamSession,
  ExamSessionStatus,
  ExamType,
} from '@/types';

interface ExamSessionsViewProps {
  onSync?: () => Promise<void>;
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
  onSync,
}: ExamSessionsViewProps) {
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
                  { length: 8 },
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