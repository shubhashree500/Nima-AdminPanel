import { NextResponse } from 'next/server';
import { getDB, saveDB } from '@/lib/db';

type Program = 'UG' | 'PG';
type GroupType = 'Major' | 'Minor' | 'MDC' | 'VAC' | 'Papers';
type PaperGroup = { id: string; type: GroupType; papers: string[] };
type StructureItem = {
  id: string;
  program: Program;
  semester: number;
  name: string;
  groups: PaperGroup[];
};

const GROUP_TYPES: GroupType[] = ['Major', 'Minor', 'MDC', 'VAC', 'Papers'];

function normalizeItems(value: unknown): StructureItem[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;

  const normalized: StructureItem[] = [];
  const seenIds = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== 'object') return null;
    const item = raw as Record<string, unknown>;
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    const program = item.program;
    const semester = Number(item.semester);
    const name = typeof item.name === 'string' ? item.name.trim() : '';

    if (!id || id.length > 100 || seenIds.has(id)) return null;
    if (program !== 'UG' && program !== 'PG') return null;
    if (!Number.isInteger(semester) || semester < 1 || semester > (program === 'UG' ? 6 : 4)) return null;
    if (!name || name.length > 150) return null;
    if (!Array.isArray(item.groups) || item.groups.length > 10) return null;

    seenIds.add(id);
    const groups: PaperGroup[] = [];
    const seenGroupIds = new Set<string>();

    for (const rawGroup of item.groups) {
      if (!rawGroup || typeof rawGroup !== 'object') return null;
      const group = rawGroup as Record<string, unknown>;
      const groupId = typeof group.id === 'string' ? group.id.trim() : '';
      const type = group.type;
      if (!groupId || groupId.length > 100 || seenGroupIds.has(groupId)) return null;
      if (typeof type !== 'string' || !GROUP_TYPES.includes(type as GroupType)) return null;
      if (!Array.isArray(group.papers) || group.papers.length > 100) return null;

      const papers: string[] = [];
      for (const paper of group.papers) {
        if (typeof paper !== 'string' || paper.length > 250) return null;
        papers.push(paper.trim());
      }
      seenGroupIds.add(groupId);
      groups.push({ id: groupId, type: type as GroupType, papers });
    }

    // UG configurations must have the four standard groups; PG has one paper list.
    if (program === 'UG') {
      for (const type of ['Major', 'Minor', 'MDC', 'VAC'] as GroupType[]) {
        if (!groups.some(group => group.type === type)) {
          groups.push({ id: `${id}-${type.toLowerCase()}`, type, papers: [] });
        }
      }
    } else if (!groups.some(group => group.type === 'Papers')) {
      groups.push({ id: `${id}-papers`, type: 'Papers', papers: [] });
    }

    normalized.push({ id, program, semester, name, groups });
  }

  // Prevent ambiguous duplicate department/subject names within the same program/semester.
  const uniqueNames = new Set<string>();
  for (const item of normalized) {
    const key = `${item.program}|${item.semester}|${item.name.toLocaleLowerCase()}`;
    if (uniqueNames.has(key)) return null;
    uniqueNames.add(key);
  }

  return normalized;
}

export async function GET() {
  try {
    const db = await getDB();
    const items = Array.isArray((db as any).examStructure) ? (db as any).examStructure : [];
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Failed to load exam structure:', error);
    return NextResponse.json({ success: false, error: 'Failed to load exam structure.' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const items = normalizeItems(body?.items);
    if (!items) {
      return NextResponse.json({ success: false, error: 'Invalid exam structure. Check names, semesters, groups and paper counts.' }, { status: 400 });
    }

    const db = await getDB();
    (db as any).examStructure = items;
    await saveDB(db);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('Failed to save exam structure:', error);
    return NextResponse.json({ success: false, error: 'Failed to save exam structure.' }, { status: 500 });
  }
}
