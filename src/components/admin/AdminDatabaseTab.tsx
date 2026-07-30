import React, { useState, useEffect } from 'react';
import {
  fetchAdminCollection,
  saveAdminDocument,
  deleteAdminDocument,
} from '../../services/api';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Edit3,
  Copy,
  RefreshCw,
  ArrowUpDown,
  X,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface AdminDatabaseTabProps {
  isDarkMode: boolean;
  overview: any;
  showToast: (msg: string) => void;
  setDeleteConfirmItem: (item: any) => void;
  onRefreshOverview: () => void;
}

export const AdminDatabaseTab: React.FC<AdminDatabaseTabProps> = ({
  isDarkMode,
  overview,
  showToast,
  setDeleteConfirmItem,
  onRefreshOverview,
}) => {
  const [selectedCollection, setSelectedCollection] = useState<string>('users');
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // JSON Edit Modal state
  const [editingDoc, setEditingDoc] = useState<any | null>(null);
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string>('');
  const [isCreatingNew, setIsCreatingNew] = useState<boolean>(false);

  const loadCollectionDocs = async (collName: string, silent = false) => {
    try {
      if (!silent) setLoadingDocs(true);
      const res = await fetchAdminCollection(collName);
      setDocuments(res.documents || []);
    } catch (err) {
      console.error(`Failed to load collection ${collName}:`, err);
    } finally {
      if (!silent) setLoadingDocs(false);
    }
  };

  useEffect(() => {
    loadCollectionDocs(selectedCollection);
  }, [selectedCollection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortField(null);
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getCollectionColumns = (coll: string, docs: any[]): string[] => {
    const predefinedMap: Record<string, string[]> = {
      users: ['id', 'firstNameTh', 'lastNameTh', 'universityId', 'role', 'email'],
      courses: ['id', 'code', 'nameTh', 'academicYear', 'semester'],
      courseMembers: ['id', 'courseId', 'userId', 'role', 'status'],
      sessions: ['id', 'courseId', 'date', 'startTime', 'endTime', 'status'],
      attendanceRecords: ['id', 'studentNameTh', 'studentUniversityId', 'status', 'timestamp', 'checkinMethod'],
      teacherAttendanceRecords: ['id', 'teacherNameTh', 'status', 'timestamp'],
      leaveRequests: ['id', 'studentNameTh', 'leaveType', 'status', 'startDate', 'endDate'],
      quickEvents: ['id', 'title', 'code', 'status', 'checkinCount'],
      activeQRCodes: ['id', 'courseId', 'sessionId', 'expiresAt'],
    };

    if (predefinedMap[coll]) {
      return predefinedMap[coll];
    }

    const keySet = new Set<string>();
    keySet.add('id');
    docs.forEach((doc) => {
      if (doc && typeof doc === 'object') {
        Object.keys(doc).forEach((k) => {
          if (!['password', 'createdAt', 'updatedAt'].includes(k)) keySet.add(k);
        });
      }
    });
    return Array.from(keySet).slice(0, 6);
  };

  const renderTableCell = (doc: any, key: string) => {
    const val = doc[key];

    if (val === undefined || val === null || val === '') {
      return <span className={`italic text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>-</span>;
    }

    if (key === 'id') {
      return (
        <div className="flex items-center space-x-1.5 font-mono font-bold">
          <span className={`truncate max-w-[120px] ${isDarkMode ? 'text-purple-400' : 'text-purple-700 font-bold'}`}>{String(val)}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(String(val));
              showToast('คัดลอก ID แล้ว');
            }}
            className={`transition shrink-0 cursor-pointer p-0.5 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-800'}`}
            title="คัดลอก ID"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      );
    }

    if (key === 'role') {
      const roleStr = String(val);
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${
          roleStr === 'ADMIN'
            ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
            : roleStr === 'TEACHER'
            ? isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-100 text-sky-900 border-sky-300'
            : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
        }`}>
          {roleStr === 'ADMIN' ? '🛠️ ADMIN' : roleStr === 'TEACHER' ? '👨‍🏫 TEACHER' : '👨‍🎓 STUDENT'}
        </span>
      );
    }

    if (key === 'status') {
      const stStr = String(val);
      let badgeClass = isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-200 text-slate-900 border-slate-300 font-bold';
      if (['PRESENT', 'APPROVED', 'ACTIVE'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300 font-bold';
      } else if (['LATE', 'PENDING'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-amber-100 text-amber-950 border-amber-300 font-bold';
      } else if (['ABSENT', 'REJECTED', 'EXPIRED', 'CANCELLED'].includes(stStr)) {
        badgeClass = isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300 font-bold';
      }
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeClass}`}>
          {stStr}
        </span>
      );
    }

    if (typeof val === 'boolean') {
      return (
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
          val
            ? isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300'
            : isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300'
        }`}>
          {val ? 'TRUE' : 'FALSE'}
        </span>
      );
    }

    if (typeof val === 'object') {
      return (
        <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border block truncate max-w-[140px] ${
          isDarkMode ? 'text-slate-400 bg-slate-800/60 border-slate-700/50' : 'text-slate-900 bg-slate-100 border-slate-300 font-bold'
        }`} title={JSON.stringify(val)}>
          {JSON.stringify(val)}
        </span>
      );
    }

    return <span className={`truncate max-w-[180px] block ${isDarkMode ? 'text-slate-200 font-medium' : 'text-slate-900 font-bold'}`}>{String(val)}</span>;
  };

  const handleOpenEditDoc = (doc: any) => {
    setEditingDoc(doc);
    setRawJsonText(JSON.stringify(doc, null, 2));
    setJsonError('');
    setIsCreatingNew(false);
  };

  const handleOpenCreateDoc = () => {
    const templateDoc = {
      id: `${selectedCollection.slice(0, 3)}_${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    setEditingDoc(templateDoc);
    setRawJsonText(JSON.stringify(templateDoc, null, 2));
    setJsonError('');
    setIsCreatingNew(true);
  };

  const handleSaveDoc = async () => {
    try {
      setJsonError('');
      const parsed = JSON.parse(rawJsonText);
      if (!parsed.id) {
        setJsonError('เอกสารต้องมี field "id" ที่ไม่เป็นค่าว่าง');
        return;
      }
      await saveAdminDocument(selectedCollection, parsed);
      showToast(`บันทึกข้อมูลใน ${selectedCollection} สำเร็จ`);
      setEditingDoc(null);
      await loadCollectionDocs(selectedCollection);
      onRefreshOverview();
    } catch (err: any) {
      setJsonError(err.message || 'รูปแบบ JSON ไม่ถูกต้อง');
    }
  };

  const handleDeleteDoc = (docId: string) => {
    setDeleteConfirmItem({
      type: 'document',
      id: docId,
      title: `คุณต้องการลบเอกสาร ID "${docId}" ใช่หรือไม่?`,
      subtitle: `การลบเอกสารออกจากคอลเลกชัน ${selectedCollection} ถาวร`,
      action: async () => {
        await deleteAdminDocument(selectedCollection, docId);
        showToast(`ลบเอกสาร ${docId} เรียบร้อยแล้ว`);
        await loadCollectionDocs(selectedCollection);
        onRefreshOverview();
      },
    });
  };

  const columns = getCollectionColumns(selectedCollection, documents);

  const sortedAndFilteredDocs = documents
    .filter((doc) => {
      if (!searchQuery.trim()) return true;
      const term = searchQuery.toLowerCase();
      return JSON.stringify(doc).toLowerCase().includes(term);
    })
    .sort((a, b) => {
      if (!sortField) return 0;
      let valA = a[sortField];
      let valB = b[sortField];

      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortDirection === 'asc' ? -1 : 1;
      if (strA > strB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="space-y-4">
      {/* Collection Toolbar & Controls */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full md:w-auto">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <label className={`text-xs font-bold shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-700'}`}>Collection:</label>
            <select
              value={selectedCollection}
              onChange={(e) => {
                setSelectedCollection(e.target.value);
                setSortField(null);
              }}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="users">👤 users ({overview?.collections?.users || 0})</option>
              <option value="courses">📚 courses ({overview?.collections?.courses || 0})</option>
              <option value="courseMembers">🎓 courseMembers ({overview?.collections?.courseMembers || 0})</option>
              <option value="sessions">🗓️ sessions ({overview?.collections?.sessions || 0})</option>
              <option value="attendanceRecords">✅ attendanceRecords ({overview?.collections?.attendanceRecords || 0})</option>
              <option value="teacherAttendanceRecords">👨‍🏫 teacherAttendanceRecords ({overview?.collections?.teacherAttendanceRecords || 0})</option>
              <option value="leaveRequests">📄 leaveRequests ({overview?.collections?.leaveRequests || 0})</option>
              <option value="quickEvents">⚡ quickEvents ({overview?.collections?.quickEvents || 0})</option>
              <option value="activeQRCodes">🔐 activeQRCodes ({overview?.collections?.activeQRCodes || 0})</option>
            </select>
          </div>

          {/* Document Search Filter */}
          <div className="relative w-full sm:w-auto">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
            <input
              type="text"
              placeholder="ค้นหาข้อมูลทุก Field..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full sm:w-auto pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2 shrink-0 justify-end">
          <button
            onClick={() => loadCollectionDocs(selectedCollection)}
            disabled={loadingDocs}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
              isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
            <span>รีเฟรช</span>
          </button>

          <button
            onClick={handleOpenCreateDoc}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-600/30 transition flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>เพิ่มเอกสารใหม่</span>
          </button>
        </div>
      </div>

      {/* Documents Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 font-extrabold'}`}>
                {columns.map((col) => (
                  <th
                    key={col}
                    onClick={() => handleSort(col)}
                    className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none"
                  >
                    <div className="flex items-center space-x-1">
                      <span>{col}</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                    </div>
                  </th>
                ))}
                <th className="p-3.5 font-extrabold text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {loadingDocs ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-slate-400 font-semibold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                    กำลังโหลดข้อมูลในคอลเลกชัน {selectedCollection}...
                  </td>
                </tr>
              ) : sortedAndFilteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="p-8 text-center text-slate-400 font-semibold">
                    ไม่พบข้อมูลเอกสารใน {selectedCollection}
                  </td>
                </tr>
              ) : (
                sortedAndFilteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className={`transition ${isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'}`}
                  >
                    {columns.map((col) => (
                      <td key={col} className="p-3.5 whitespace-nowrap">
                        {renderTableCell(doc, col)}
                      </td>
                    ))}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleOpenEditDoc(doc)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isDarkMode
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-sky-400'
                              : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-sky-700'
                          }`}
                          title="แก้ไข Raw JSON"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteDoc(doc.id)}
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            isDarkMode
                              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-rose-400'
                              : 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-rose-700'
                          }`}
                          title="ลบเอกสาร"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-2xl p-6 space-y-4 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-purple-500/30 text-slate-100' : 'bg-white border-purple-200 text-slate-900'
          }`}>
            <button
              onClick={() => setEditingDoc(null)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-purple-500">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-purple-600 dark:text-purple-400">
                  {isCreatingNew ? `สร้างเอกสารใหม่ใน ${selectedCollection}` : `แก้ไข Raw JSON (${editingDoc.id})`}
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  แก้ไขข้อมูลฟีลด์รูปแบบ JSON โดยตรงและบันทึกไปยังฐานข้อมูล
                </p>
              </div>
            </div>

            <div>
              <textarea
                rows={14}
                value={rawJsonText}
                onChange={(e) => setRawJsonText(e.target.value)}
                className={`w-full p-4 rounded-2xl font-mono text-xs border leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-800 text-emerald-300'
                }`}
              />
            </div>

            {jsonError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-500 font-bold text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{jsonError}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-700/30">
              <button
                type="button"
                onClick={() => setEditingDoc(null)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveDoc}
                className="px-5 py-2 rounded-xl font-extrabold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                บันทึกเอกสาร
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
