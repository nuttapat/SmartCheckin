import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, MasterDepartment } from '../../types';
import {
  fetchAdminCollection,
  adminResetUserPassword,
  adminUpdateUserDetails,
  adminToggleUserStatus,
  adminDeleteUser,
  adminBulkUserRole,
  adminBulkUserStatus,
  adminBulkDeleteUsers,
  adminBulkResetDevices,
  resetUserDevice,
  fetchMasterDepartments,
} from '../../services/api';
import {
  Users,
  Search,
  Filter,
  RefreshCw,
  Edit3,
  Key,
  Lock,
  Unlock,
  Trash2,
  Smartphone,
  Shield,
  ArrowUpDown,
  X,
  ShieldAlert,
  CheckSquare,
  Square,
  UserCheck,
  UserX,
  Download,
  ArrowUp,
  ArrowDown,
  Sliders,
  Eye,
  EyeOff,
  Globe,
  Mail,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AdminUsersTabProps {
  isDarkMode: boolean;
  showToast: (msg: string) => void;
  setDeleteConfirmItem: (item: any) => void;
  onRefreshOverview: () => void;
}

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  isDarkMode,
  showToast,
  setDeleteConfirmItem,
  onRefreshOverview,
}) => {
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(false);
  const [masterDeps, setMasterDeps] = useState<MasterDepartment[]>([]);

  // User Management filters
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('ALL');
  const [hideDemoUsers, setHideDemoUsers] = useState<boolean>(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [lastSelectedUserIndex, setLastSelectedUserIndex] = useState<number | null>(null);
  const [bulkActionProcessing, setBulkActionProcessing] = useState<boolean>(false);

  // Pagination State
  const [userPageSize, setUserPageSize] = useState<number>(15);
  const [userCurrentPage, setUserCurrentPage] = useState<number>(1);

  // Reset pagination on filter change
  useEffect(() => {
    setUserCurrentPage(1);
  }, [userSearchQuery, userRoleFilter, userStatusFilter, userDeptFilter, hideDemoUsers]);

  // Sorting
  const [userTableSortField, setUserTableSortField] = useState<'name' | 'email' | 'authProvider' | 'role' | 'department' | 'status' | 'createdAt' | null>(null);
  const [userTableSortDir, setUserTableSortDir] = useState<'asc' | 'desc'>('asc');

  // Column Visibility State
  const [userVisibleCols, setUserVisibleCols] = useState<{ [key: string]: boolean }>({
    select: true,
    index: true,
    name: true,
    email: true,
    authProvider: false,
    role: true,
    department: false,
    createdAt: false,
    status: true,
    actions: true,
  });
  const [showUserColPicker, setShowUserColPicker] = useState<boolean>(false);

  const USER_COLUMN_CONFIG: { key: string; label: string }[] = [
    { key: 'select', label: 'กล่องเลือก (Select)' },
    { key: 'index', label: 'ลำดับ (#)' },
    { key: 'name', label: 'ชื่อ - นามสกุล / รหัส' },
    { key: 'email', label: 'อีเมล' },
    { key: 'authProvider', label: 'การเชื่อมบัญชี (Google Auth)' },
    { key: 'role', label: 'สิทธิ์ (Role)' },
    { key: 'department', label: 'สาขา / ภาควิชา' },
    { key: 'createdAt', label: 'สร้างเมื่อ (Created At)' },
    { key: 'status', label: 'สถานะบัญชี' },
    { key: 'actions', label: 'จัดการ' },
  ];

  // Column Widths for Users Table
  const [userColWidths, setUserColWidths] = useState<{ [key: string]: number }>({
    select: 40,
    index: 45,
    name: 200,
    email: 210,
    authProvider: 155,
    role: 130,
    department: 160,
    createdAt: 130,
    status: 140,
    actions: 120,
  });

  const handleMouseDownResizeUser = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = userColWidths[colKey] || 100;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(35, startWidth + deltaX);
      setUserColWidths((prev) => ({
        ...prev,
        [colKey]: newWidth,
      }));
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Modals state
  const [editingUserProfile, setEditingUserProfile] = useState<User | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    title: '',
    firstNameTh: '',
    lastNameTh: '',
    firstNameEn: '',
    lastNameEn: '',
    universityId: '',
    email: '',
    role: UserRole.STUDENT,
    department: '',
  });

  const [resetPasswordTargetUser, setResetPasswordTargetUser] = useState<User | null>(null);
  const [resetPasswordInput, setResetPasswordInput] = useState<string>('');

  const [suspendTargetUser, setSuspendTargetUser] = useState<User | null>(null);
  const [suspendReasonInput, setSuspendReasonInput] = useState<string>('');

  const loadUsersData = async (silent = false) => {
    try {
      if (!silent) setLoadingUsers(true);
      const [res, depsData] = await Promise.all([
        fetchAdminCollection('users'),
        fetchMasterDepartments().catch(() => []),
      ]);
      setUsersList(res.documents || []);
      setMasterDeps(depsData);
    } catch (err) {
      console.error('Failed to load users data:', err);
    } finally {
      if (!silent) setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsersData();
  }, []);

  const handleUserTableSort = (field: 'name' | 'email' | 'authProvider' | 'role' | 'department' | 'status' | 'createdAt') => {
    if (userTableSortField === field) {
      if (userTableSortDir === 'asc') setUserTableSortDir('desc');
      else {
        setUserTableSortField(null);
        setUserTableSortDir('asc');
      }
    } else {
      setUserTableSortField(field);
      setUserTableSortDir('asc');
    }
  };

  const handleToggleSelectUser = (id: string, index?: number, e?: React.MouseEvent) => {
    if (e?.shiftKey && lastSelectedUserIndex !== null && index !== undefined && lastSelectedUserIndex !== index) {
      const start = Math.min(lastSelectedUserIndex, index);
      const end = Math.max(lastSelectedUserIndex, index);
      const rangeIds = paginatedUsers.slice(start, end + 1).map((u) => u.id);

      const isTargetSelected = selectedUserIds.includes(id);

      setSelectedUserIds((prev) => {
        if (!isTargetSelected) {
          return Array.from(new Set([...prev, ...rangeIds]));
        } else {
          return prev.filter((prevId) => !rangeIds.includes(prevId));
        }
      });
    } else {
      setSelectedUserIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    }
    if (index !== undefined) {
      setLastSelectedUserIndex(index);
    }
  };

  const handleSelectAllVisibleUsers = (visibleUsers: User[]) => {
    const visibleIds = visibleUsers.map((u) => u.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedUserIds.includes(id));
    if (allSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      const merged = Array.from(new Set([...selectedUserIds, ...visibleIds]));
      setSelectedUserIds(merged);
    }
  };

  const handleExecuteBulkRole = async (role: string) => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`ยืนยันการเปลี่ยนบทบาทของผู้ใช้จำนวน ${selectedUserIds.length} รายการเป็น ${role}?`)) return;

    setBulkActionProcessing(true);
    try {
      const res = await adminBulkUserRole(selectedUserIds, role);
      showToast(res.message || 'เปลี่ยนบทบาทเรียบร้อยแล้ว');
      setSelectedUserIds([]);
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนบทบาทแบบกลุ่ม');
    } finally {
      setBulkActionProcessing(false);
    }
  };

  const handleExecuteBulkStatus = async (isSuspended: boolean) => {
    if (selectedUserIds.length === 0) return;
    const actionLabel = isSuspended ? 'ระงับการใช้งาน' : 'ปลดการระงับ';
    if (!confirm(`ยืนยันการ${actionLabel}ผู้ใช้จำนวน ${selectedUserIds.length} รายการ?`)) return;

    setBulkActionProcessing(true);
    try {
      const res = await adminBulkUserStatus(selectedUserIds, isSuspended, isSuspended ? 'ระงับการใช้งานแบบกลุ่มโดย Admin' : '');
      showToast(res.message || 'อัปเดตสถานะผู้ใช้เรียบร้อยแล้ว');
      setSelectedUserIds([]);
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการอัปเดตสถานะแบบกลุ่ม');
    } finally {
      setBulkActionProcessing(false);
    }
  };

  const handleExecuteBulkResetDevices = async () => {
    if (selectedUserIds.length === 0) return;
    if (!confirm(`ยืนยันการปลดล็อกอุปกรณ์ของผู้ใช้จำนวน ${selectedUserIds.length} รายการ?`)) return;

    setBulkActionProcessing(true);
    try {
      const res = await adminBulkResetDevices(selectedUserIds);
      showToast(res.message || 'ปลดล็อกอุปกรณ์เรียบร้อยแล้ว');
      setSelectedUserIds([]);
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการปลดล็อกอุปกรณ์');
    } finally {
      setBulkActionProcessing(false);
    }
  };

  const handleExecuteBulkDelete = () => {
    if (selectedUserIds.length === 0) return;
    setDeleteConfirmItem({
      title: `ลบบัญชีผู้ใช้แบบกลุ่ม (${selectedUserIds.length} บัญชี)`,
      subtitle: `คุณกำลังจะลบบัญชีผู้ใช้จำนวน ${selectedUserIds.length} บัญชีออกจากระบบอย่างถาวร`,
      action: async () => {
        setBulkActionProcessing(true);
        try {
          const res = await adminBulkDeleteUsers(selectedUserIds);
          showToast(res.message || 'ลบบัญชีผู้ใช้สำเร็จ');
          setSelectedUserIds([]);
          loadUsersData();
          onRefreshOverview();
        } catch (err: any) {
          alert(err.message || 'เกิดข้อผิดพลาดในการลบบัญชีแบบกลุ่ม');
        } finally {
          setBulkActionProcessing(false);
        }
      },
    });
  };

  const handleOpenEditUserModal = (user: User) => {
    setEditingUserProfile(user);
    setEditUserForm({
      title: user.title || 'นาย',
      firstNameTh: user.firstNameTh || '',
      lastNameTh: user.lastNameTh || '',
      firstNameEn: user.firstNameEn || '',
      lastNameEn: user.lastNameEn || '',
      universityId: user.universityId || '',
      email: user.email || '',
      role: user.role || UserRole.STUDENT,
      department: user.department || '',
    });
  };

  const handleSaveEditUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUserProfile) return;
    try {
      await adminUpdateUserDetails(editingUserProfile.id, editUserForm);
      showToast(`อัปเดตข้อมูลผู้ใช้ (${editUserForm.firstNameTh}) สำเร็จ`);
      setEditingUserProfile(null);
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูลผู้ใช้');
    }
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTargetUser || !resetPasswordInput.trim()) return;
    try {
      await adminResetUserPassword(resetPasswordTargetUser.id, resetPasswordInput.trim());
      showToast(`รีเซ็ตรหัสผ่านของผู้ใช้ (${resetPasswordTargetUser.firstNameTh}) เรียบร้อยแล้ว`);
      setResetPasswordTargetUser(null);
      setResetPasswordInput('');
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน');
    }
  };

  const handleSaveSuspendStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendTargetUser) return;
    const isSuspending = !suspendTargetUser.isSuspended;
    try {
      await adminToggleUserStatus(suspendTargetUser.id, isSuspending, suspendReasonInput.trim());
      showToast(isSuspending ? `ระงับการใช้งานบัญชี (${suspendTargetUser.firstNameTh}) เรียบร้อยแล้ว` : `ปลดการระงับบัญชี (${suspendTargetUser.firstNameTh}) เรียบร้อยแล้ว`);
      setSuspendTargetUser(null);
      setSuspendReasonInput('');
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการเปลี่ยนสถานะการใช้งาน');
    }
  };

  const handleSingleUserDelete = (user: User) => {
    setDeleteConfirmItem({
      title: `ลบบัญชีผู้ใช้ "${user.firstNameTh} ${user.lastNameTh}"`,
      subtitle: `คำเตือน: การลบบัญชีผู้ใช้ (ID: ${user.universityId || user.id}) จะส่งผลให้ผู้ใช้รายนี้ไม่สามารถเข้าสู่ระบบได้อีกต่อไป`,
      action: async () => {
        await adminDeleteUser(user.id);
        showToast(`ลบบัญชีผู้ใช้งาน ${user.firstNameTh} สำเร็จ`);
        loadUsersData();
        onRefreshOverview();
      },
    });
  };

  const handleResetDeviceSingle = async (userId: string, name: string) => {
    try {
      await resetUserDevice(userId);
      showToast(`ปลดล็อกอุปกรณ์ของ ${name} เรียบร้อยแล้ว`);
      loadUsersData();
    } catch (err: any) {
      alert(err.message || 'เกิดข้อผิดพลาดในการปลดล็อกอุปกรณ์');
    }
  };

  const filteredAndSortedUsers = useMemo(() => {
    return usersList
      .filter((u) => {
        const isDemo = u.isDemo || ['usr_teacher_1', 'usr_teacher_2', 'usr_student_1', 'usr_student_2', 'usr_admin_1'].includes(u.id);
        if (hideDemoUsers && isDemo) return false;

        if (userRoleFilter !== 'ALL' && u.role !== userRoleFilter) return false;
        if (userStatusFilter === 'ACTIVE' && u.isSuspended) return false;
        if (userStatusFilter === 'SUSPENDED' && !u.isSuspended) return false;
        if (userDeptFilter === 'MISSING' && u.department) return false;
        if (userDeptFilter !== 'ALL' && userDeptFilter !== 'MISSING' && u.department !== userDeptFilter) return false;

        if (!userSearchQuery.trim()) return true;

        const q = userSearchQuery.toLowerCase().trim();
        const fullName = `${u.title || ''}${u.firstNameTh || ''} ${u.lastNameTh || ''}`.toLowerCase();
        const id = (u.id || '').toLowerCase();
        const uniId = (u.universityId || '').toLowerCase();
        const email = (u.email || '').toLowerCase();

        return fullName.includes(q) || id.includes(q) || uniId.includes(q) || email.includes(q);
      })
      .sort((a, b) => {
        if (!userTableSortField) return 0;
        let valA = '';
        let valB = '';

        if (userTableSortField === 'name') {
          valA = `${a.firstNameTh || ''} ${a.lastNameTh || ''}`;
          valB = `${b.firstNameTh || ''} ${b.lastNameTh || ''}`;
        } else if (userTableSortField === 'email') {
          valA = a.email || '';
          valB = b.email || '';
        } else if (userTableSortField === 'authProvider') {
          valA = a.authProvider || (a.id && a.id.startsWith('usr_g_') ? 'google' : 'email');
          valB = b.authProvider || (b.id && b.id.startsWith('usr_g_') ? 'google' : 'email');
        } else if (userTableSortField === 'role') {
          valA = a.role || '';
          valB = b.role || '';
        } else if (userTableSortField === 'department') {
          valA = a.department || '';
          valB = b.department || '';
        } else if (userTableSortField === 'status') {
          valA = a.isSuspended ? 'SUSPENDED' : 'ACTIVE';
          valB = b.isSuspended ? 'SUSPENDED' : 'ACTIVE';
        } else if (userTableSortField === 'createdAt') {
          valA = a.createdAt || '';
          valB = b.createdAt || '';
        }

        if (valA < valB) return userTableSortDir === 'asc' ? -1 : 1;
        if (valA > valB) return userTableSortDir === 'asc' ? 1 : -1;
        return 0;
      });
  }, [usersList, userRoleFilter, userStatusFilter, userDeptFilter, hideDemoUsers, userSearchQuery, userTableSortField, userTableSortDir]);

  const totalUserItems = filteredAndSortedUsers.length;
  const totalUserPages = userPageSize === -1 ? 1 : Math.ceil(totalUserItems / userPageSize) || 1;

  const paginatedUsers = useMemo(() => {
    if (userPageSize === -1) return filteredAndSortedUsers;
    const start = (userCurrentPage - 1) * userPageSize;
    return filteredAndSortedUsers.slice(start, start + userPageSize);
  }, [filteredAndSortedUsers, userCurrentPage, userPageSize]);

  const allVisibleSelected = paginatedUsers.length > 0 && paginatedUsers.every((u) => selectedUserIds.includes(u.id));

  const handleExportUsersCSV = () => {
    const usersToExport = selectedUserIds.length > 0
      ? filteredAndSortedUsers.filter((u) => selectedUserIds.includes(u.id))
      : filteredAndSortedUsers;

    if (usersToExport.length === 0) {
      showToast('ไม่มีข้อมูลผู้ใช้ที่จะส่งออก');
      return;
    }

    const headers = ['ลำดับ', 'ID', 'รหัสประจำตัว/นักศึกษา', 'คำนำหน้า', 'ชื่อ (TH)', 'นามสกุล (TH)', 'อีเมล', 'การเชื่อมบัญชี', 'สิทธิ์ (Role)', 'สาขา/ภาควิชา', 'สร้างเมื่อ', 'บัญชี Demo', 'สถานะบัญชี'];
    const rows = usersToExport.map((u, idx) => {
      const isDemo = u.isDemo || ['usr_teacher_1', 'usr_teacher_2', 'usr_student_1', 'usr_student_2', 'usr_admin_1'].includes(u.id);
      const isGoogle = u.authProvider === 'google' || (u.id && u.id.startsWith('usr_g_'));
      const formattedCreated = u.createdAt ? new Date(u.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';
      return [
        idx + 1,
        u.id || '',
        u.universityId || '',
        u.title || '',
        u.firstNameTh || '',
        u.lastNameTh || '',
        u.email || '',
        isGoogle ? 'Google Account' : 'Email / Password',
        u.role || '',
        u.department || 'ไม่ระบุ',
        formattedCreated,
        isDemo ? 'ใช่ (DEMO)' : 'ทั่วไป',
        u.isSuspended ? 'ถูกระงับ (Suspended)' : 'ปกติ (Active)'
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `admin_users_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`ส่งออก CSV สำเร็จ (${usersToExport.length} บัญชี)`);
  };

  return (
    <div className="space-y-4">
      {/* Filters & Control Toolbar */}
      <div className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Search */}
            <div className="relative min-w-0 sm:min-w-[200px] w-full sm:w-auto">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-2.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`} />
              <input
                type="text"
                placeholder="ค้นชื่อ, รหัสประจำตัว, อีเมล..."
                value={userSearchQuery}
                onChange={(e) => setUserSearchQuery(e.target.value)}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
            </div>

            {/* Role Filter */}
            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">สิทธิ์ทั้งหมด (Roles: ALL)</option>
              <option value="STUDENT">👨‍🎓 นักศึกษา (Student)</option>
              <option value="TEACHER">👨‍🏫 อาจารย์ (Teacher)</option>
              <option value="ADMIN">🛠️ ผู้ดูแลระบบ (Admin)</option>
            </select>

            {/* Status Filter */}
            <select
              value={userStatusFilter}
              onChange={(e) => setUserStatusFilter(e.target.value)}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">สถานะทั้งหมด (Status: ALL)</option>
              <option value="ACTIVE">🟢 ปกติ (Active)</option>
              <option value="SUSPENDED">🔴 ถูกระงับการใช้งาน (Suspended)</option>
            </select>

            {/* Department Filter */}
            <select
              value={userDeptFilter}
              onChange={(e) => setUserDeptFilter(e.target.value)}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
              }`}
            >
              <option value="ALL">สาขา/ภาควิชาทั้งหมด</option>
              <option value="MISSING">⚠️ ยังไม่ได้ระบุสาขา</option>
              {masterDeps.map((d) => (
                <option key={d.id} value={d.code}>
                  {d.nameTh} ({d.code})
                </option>
              ))}
            </select>

            {/* Hide Demo Users Toggle */}
            <button
              type="button"
              onClick={() => setHideDemoUsers(!hideDemoUsers)}
              className={`w-full sm:w-auto px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap active:scale-95 ${
                hideDemoUsers
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 shadow-xs'
                  : isDarkMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
              title="ซ่อนหรือแสดงบัญชีทดลองระบบ (Demo Accounts)"
            >
              {hideDemoUsers ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span>ซ่อนบัญชี Demo</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>แสดง Demo ทั้งหมด</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:items-center gap-2 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
            {/* Column Settings Button & Popover */}
            <div className="relative w-full">
              <button
                type="button"
                onClick={() => setShowUserColPicker(!showUserColPicker)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center space-x-1.5 border whitespace-nowrap active:scale-95 ${
                  showUserColPicker
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                    : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300 shadow-xs'
                }`}
                title="เลือกคอลัมน์ที่จะแสดง"
              >
                <Sliders className="w-3.5 h-3.5 shrink-0" />
                <span>ตั้งค่าคอลัมน์</span>
              </button>

              {showUserColPicker && (
                <div
                  className={`absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 p-3 rounded-2xl shadow-xl border z-30 transition-all ${
                    isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                    <span className="text-xs font-black flex items-center space-x-1.5">
                      <Sliders className="w-3.5 h-3.5 text-purple-500" />
                      <span>แสดง/ซ่อน คอลัมน์</span>
                    </span>
                    <button
                      onClick={() => setShowUserColPicker(false)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                    {USER_COLUMN_CONFIG.map((col) => (
                      <label
                        key={col.key}
                        className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer text-xs font-bold transition select-none"
                      >
                        <span className="text-slate-700 dark:text-slate-300">{col.label}</span>
                        <input
                          type="checkbox"
                          checked={!!userVisibleCols[col.key]}
                          onChange={(e) =>
                            setUserVisibleCols((prev) => ({
                              ...prev,
                              [col.key]: e.target.checked,
                            }))
                          }
                          className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-200 dark:border-slate-800 mt-2 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() =>
                        setUserVisibleCols({
                          select: true,
                          index: true,
                          name: true,
                          email: true,
                          authProvider: true,
                          role: true,
                          department: true,
                          createdAt: true,
                          status: true,
                          actions: true,
                        })
                      }
                      className="text-purple-600 dark:text-purple-400 hover:underline cursor-pointer"
                    >
                      แสดงทั้งหมด
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowUserColPicker(false)}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 text-white hover:bg-purple-500 transition cursor-pointer font-bold"
                    >
                      ตกลง
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleExportUsersCSV}
              className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs whitespace-nowrap active:scale-95"
              title="ส่งออกข้อมูลผู้ใช้เป็น CSV"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>ส่งออก CSV</span>
            </button>
            <button
              onClick={() => loadUsersData()}
              disabled={loadingUsers}
              className={`w-full col-span-2 sm:col-span-1 px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center space-x-1.5 transition cursor-pointer whitespace-nowrap active:scale-95 ${
                isDarkMode ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300' : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${loadingUsers ? 'animate-spin' : ''}`} />
              <span>โหลดใหม่</span>
            </button>
          </div>
        </div>

        {/* Bulk Actions Panel */}
        {selectedUserIds.length > 0 && (
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center space-x-2 text-xs font-bold text-purple-600 dark:text-purple-300">
              <CheckSquare className="w-4 h-4" />
              <span>เลือกไว้แล้ว {selectedUserIds.length} บัญชี</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleExportUsersCSV}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer flex items-center space-x-1"
              >
                <Download className="w-3 h-3" />
                <span>ส่งออกที่เลือก (CSV)</span>
              </button>
              <button
                onClick={() => handleExecuteBulkRole('STUDENT')}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
              >
                ปรับเป็น Student
              </button>
              <button
                onClick={() => handleExecuteBulkRole('TEACHER')}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-sky-300 border border-sky-500/30 transition cursor-pointer"
              >
                ปรับเป็น Teacher
              </button>
              <button
                onClick={() => handleExecuteBulkResetDevices()}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition cursor-pointer"
              >
                ปลดล็อกอุปกรณ์
              </button>
              <button
                onClick={() => handleExecuteBulkStatus(true)}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-amber-500/20 hover:bg-amber-500/30 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition cursor-pointer"
              >
                ระงับบัญชี
              </button>
              <button
                onClick={() => handleExecuteBulkStatus(false)}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer"
              >
                ปลดระงับ
              </button>
              <button
                onClick={handleExecuteBulkDelete}
                disabled={bulkActionProcessing}
                className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>ลบผู้ใช้ที่เลือก ({selectedUserIds.length})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Users Table */}
      <div className={`rounded-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed min-w-[700px] text-left text-xs border-collapse">
            <colgroup>
              {userVisibleCols.select && <col style={{ width: `${userColWidths.select}px` }} />}
              {userVisibleCols.index && <col style={{ width: `${userColWidths.index}px` }} />}
              {userVisibleCols.name && <col style={{ width: `${userColWidths.name}px` }} />}
              {userVisibleCols.email && <col style={{ width: `${userColWidths.email}px` }} />}
              {userVisibleCols.authProvider && <col style={{ width: `${userColWidths.authProvider}px` }} />}
              {userVisibleCols.role && <col style={{ width: `${userColWidths.role}px` }} />}
              {userVisibleCols.department && <col style={{ width: `${userColWidths.department}px` }} />}
              {userVisibleCols.createdAt && <col style={{ width: `${userColWidths.createdAt}px` }} />}
              {userVisibleCols.status && <col style={{ width: `${userColWidths.status}px` }} />}
              {userVisibleCols.actions && <col style={{ width: `${userColWidths.actions}px` }} />}
            </colgroup>
            <thead>
              <tr className={`border-b ${isDarkMode ? 'bg-slate-800/80 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700 font-extrabold'}`}>
                {userVisibleCols.select && (
                  <th className="p-3.5 text-center relative group select-none">
                    <button
                      onClick={() => handleSelectAllVisibleUsers(paginatedUsers)}
                      className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      {allVisibleSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                    </button>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('select', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.index && (
                  <th className="p-3.5 text-center font-extrabold uppercase tracking-wider text-slate-400 relative group select-none">
                    #
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('index', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.name && (
                  <th onClick={() => handleUserTableSort('name')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>ชื่อ - นามสกุล / รหัส</span>
                      {userTableSortField === 'name' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('name', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.email && (
                  <th onClick={() => handleUserTableSort('email')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>อีเมล</span>
                      {userTableSortField === 'email' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('email', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.authProvider && (
                  <th onClick={() => handleUserTableSort('authProvider')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>การเชื่อมบัญชี</span>
                      {userTableSortField === 'authProvider' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('authProvider', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.role && (
                  <th onClick={() => handleUserTableSort('role')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>สิทธิ์ (Role)</span>
                      {userTableSortField === 'role' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('role', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.department && (
                  <th onClick={() => handleUserTableSort('department')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>สาขา / ภาควิชา</span>
                      {userTableSortField === 'department' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('department', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.createdAt && (
                  <th onClick={() => handleUserTableSort('createdAt')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>สร้างเมื่อ</span>
                      {userTableSortField === 'createdAt' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('createdAt', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.status && (
                  <th onClick={() => handleUserTableSort('status')} className="p-3.5 font-extrabold uppercase tracking-wider cursor-pointer hover:opacity-80 transition select-none relative group pr-4">
                    <div className="flex items-center space-x-1 truncate">
                      <span>สถานะบัญชี</span>
                      {userTableSortField === 'status' ? (
                        userTableSortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-sky-500 shrink-0" /> : <ArrowDown className="w-3 h-3 text-sky-500 shrink-0" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                      )}
                    </div>
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('status', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
                {userVisibleCols.actions && (
                  <th className="p-3.5 font-extrabold text-right relative group select-none">
                    จัดการ
                    <div
                      onMouseDown={(e) => handleMouseDownResizeUser('actions', e)}
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize group-hover:bg-sky-500/30 hover:!bg-sky-500 transition-colors z-10 flex items-center justify-center"
                    >
                      <div className="w-0.5 h-3 bg-slate-400/40 group-hover:bg-sky-400" />
                    </div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${isDarkMode ? 'divide-slate-800/60' : 'divide-slate-100'}`}>
              {loadingUsers ? (
                <tr>
                  <td colSpan={Object.values(userVisibleCols).filter(Boolean).length || 1} className="p-8 text-center text-slate-400 font-semibold">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-500" />
                    กำลังโหลดข้อมูลผู้ใช้...
                  </td>
                </tr>
              ) : filteredAndSortedUsers.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(userVisibleCols).filter(Boolean).length || 1} className="p-8 text-center text-slate-400 font-semibold">
                    ไม่พบข้อมูลผู้ใช้ตรงตามเงื่อนไข
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user, idx) => {
                  const isSelected = selectedUserIds.includes(user.id);
                  return (
                    <tr
                      key={user.id}
                      className={`transition ${
                        isSelected
                          ? isDarkMode ? 'bg-purple-900/20' : 'bg-purple-50'
                          : isDarkMode ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                      }`}
                    >
                      {userVisibleCols.select && (
                        <td className="p-3.5 text-center">
                          <button
                            onClick={(e) => handleToggleSelectUser(user.id, idx, e)}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                          >
                            {isSelected ? <CheckSquare className="w-4 h-4 text-purple-500" /> : <Square className="w-4 h-4 text-slate-400" />}
                          </button>
                        </td>
                      )}
                      {userVisibleCols.index && (
                        <td className="p-3.5 text-center font-mono font-bold text-slate-400 text-xs">
                          {(userCurrentPage - 1) * (userPageSize === -1 ? 0 : userPageSize) + idx + 1}
                        </td>
                      )}
                      {userVisibleCols.name && (
                        <td className="p-3.5">
                          <div>
                            <div className={`font-bold flex items-center space-x-1.5 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                              <span>{user.title || ''}{user.firstNameTh || ''} {user.lastNameTh || ''}</span>
                              {(user.isDemo || ['usr_teacher_1', 'usr_teacher_2', 'usr_student_1', 'usr_student_2', 'usr_admin_1'].includes(user.id)) && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0">
                                  🧪 DEMO
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] font-mono text-slate-400 flex items-center space-x-2">
                              <span>ID: {user.universityId || user.id}</span>
                              {user.deviceId && (
                                <span className="text-emerald-500 font-extrabold flex items-center space-x-0.5">
                                  <Smartphone className="w-3 h-3 inline" />
                                  <span>มีอุปกรณ์ผูกแล้ว</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      {userVisibleCols.email && (
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {user.email}
                        </td>
                      )}
                      {userVisibleCols.authProvider && (
                        <td className="p-3.5">
                          {user.authProvider === 'google' || (user.id && user.id.startsWith('usr_g_')) ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-black bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                              </svg>
                              <span>Google Account</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
                              <Mail className="w-3 h-3 shrink-0" />
                              <span>Email / Pass</span>
                            </span>
                          )}
                        </td>
                      )}
                      {userVisibleCols.role && (
                        <td className="p-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${
                            user.role === UserRole.ADMIN
                              ? isDarkMode ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-purple-100 text-purple-900 border-purple-300'
                              : user.role === UserRole.TEACHER
                              ? isDarkMode ? 'bg-sky-500/20 text-sky-300 border-sky-500/40' : 'bg-sky-100 text-sky-900 border-sky-300'
                              : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                          }`}>
                            {user.role === UserRole.ADMIN ? '🛠️ ADMIN' : user.role === UserRole.TEACHER ? '👨‍🏫 TEACHER' : '👨‍🎓 STUDENT'}
                          </span>
                        </td>
                      )}
                      {userVisibleCols.department && (
                        <td className="p-3.5">
                          {user.department ? (
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{user.department}</span>
                          ) : (
                            <span className="text-[10px] italic text-slate-400">- ไม่ระบุ -</span>
                          )}
                        </td>
                      )}
                      {userVisibleCols.createdAt && (
                        <td className="p-3.5 font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {user.createdAt ? (
                            new Date(user.createdAt).toLocaleString('th-TH', {
                              timeZone: 'Asia/Bangkok',
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                      )}
                      {userVisibleCols.status && (
                        <td className="p-3.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                            user.isSuspended
                              ? isDarkMode ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : 'bg-rose-100 text-rose-950 border-rose-300'
                              : isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-emerald-100 text-emerald-950 border-emerald-300'
                          }`}>
                            {user.isSuspended ? '🔴 ถูกระงับ' : '🟢 ปกติ'}
                          </span>
                        </td>
                      )}
                      {userVisibleCols.actions && (
                        <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenEditUserModal(user)}
                            className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 transition cursor-pointer"
                            title="แก้ไขโปรไฟล์"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetPasswordTargetUser(user);
                              setResetPasswordInput('');
                            }}
                            className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-amber-600 dark:text-amber-400 transition cursor-pointer"
                            title="รีเซ็ตรหัสผ่าน"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {user.deviceId && (
                            <button
                              onClick={() => handleResetDeviceSingle(user.id, user.firstNameTh || user.email)}
                              className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition cursor-pointer"
                              title="ปลดล็อกอุปกรณ์ผูกติด"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSuspendTargetUser(user);
                              setSuspendReasonInput(user.suspendReason || '');
                            }}
                            className={`p-1.5 rounded-lg border transition cursor-pointer ${
                              user.isSuspended
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-300'
                            }`}
                            title={user.isSuspended ? 'ปลดการระงับ' : 'ระงับบัญชี'}
                          >
                            {user.isSuspended ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleSingleUserDelete(user)}
                            className="p-1.5 rounded-lg border bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 transition cursor-pointer"
                            title="ลบบัญชีถาวร"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          className={`p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-3 ${
            isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            <span>แสดงจำนวน:</span>
            <select
              value={userPageSize}
              onChange={(e) => {
                setUserPageSize(Number(e.target.value));
                setUserCurrentPage(1);
              }}
              className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value={10}>10 รายการ</option>
              <option value={15}>15 รายการ</option>
              <option value={30}>30 รายการ</option>
              <option value={50}>50 รายการ</option>
              <option value={-1}>ทั้งหมด ({totalUserItems})</option>
            </select>
          </div>

          {userPageSize !== -1 && totalUserPages > 1 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUserCurrentPage((p) => Math.max(1, p - 1))}
                disabled={userCurrentPage === 1}
                className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-extrabold px-2">
                หน้า {userCurrentPage} จาก {totalUserPages}
              </span>
              <button
                onClick={() => setUserCurrentPage((p) => Math.min(totalUserPages, p + 1))}
                disabled={userCurrentPage === totalUserPages}
                className={`p-1.5 rounded-xl border transition disabled:opacity-40 cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-300 text-slate-700'
                }`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* EDIT USER PROFILE MODAL */}
      {editingUserProfile && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-purple-500/30 text-slate-100' : 'bg-white border-purple-200 text-slate-900'
          }`}>
            <button
              onClick={() => setEditingUserProfile(null)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-purple-500">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
                <Edit3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-purple-600 dark:text-purple-400">แก้ไขข้อมูลโปรไฟล์ผู้ใช้งาน</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ID: {editingUserProfile.universityId || editingUserProfile.id} ({editingUserProfile.email})
                </p>
              </div>
            </div>

            <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">คำนำหน้า</label>
                  <input
                    type="text"
                    value={editUserForm.title}
                    onChange={(e) => setEditUserForm({ ...editUserForm, title: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">ชื่อ (ไทย)</label>
                  <input
                    type="text"
                    value={editUserForm.firstNameTh}
                    onChange={(e) => setEditUserForm({ ...editUserForm, firstNameTh: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">นามสกุล (ไทย)</label>
                  <input
                    type="text"
                    value={editUserForm.lastNameTh}
                    onChange={(e) => setEditUserForm({ ...editUserForm, lastNameTh: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">รหัสประจำตัว (Student ID)</label>
                  <input
                    type="text"
                    value={editUserForm.universityId}
                    onChange={(e) => setEditUserForm({ ...editUserForm, universityId: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-mono font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">อีเมลระบบ</label>
                  <input
                    type="email"
                    value={editUserForm.email}
                    onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-mono font-semibold ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">สิทธิ์การใช้งาน (Role)</label>
                <select
                  value={editUserForm.role}
                  onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value as UserRole })}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value={UserRole.STUDENT}>👨‍🎓 นักศึกษา (STUDENT)</option>
                  <option value={UserRole.TEACHER}>👨‍🏫 อาจารย์ผู้สอน (TEACHER)</option>
                  <option value={UserRole.ADMIN}>🛠️ ผู้ดูแลระบบ (ADMIN)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">สาขา / ภาควิชา</label>
                <select
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                  className={`w-full p-2.5 rounded-xl border text-xs font-semibold ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                >
                  <option value="">-- ไม่ระบุ --</option>
                  {masterDeps.map((dept: MasterDepartment) => (
                    <option key={dept.id} value={dept.code}>
                      {dept.nameTh} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-700/30">
              <button
                type="button"
                onClick={() => setEditingUserProfile(null)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveEditUserForm}
                className="px-5 py-2 rounded-xl font-extrabold text-xs text-white bg-purple-600 hover:bg-purple-500 transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                บันทึกการปรับปรุง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordTargetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden ${
            isDarkMode ? 'bg-slate-900 border-amber-500/30 text-slate-100' : 'bg-white border-amber-200 text-slate-900'
          }`}>
            <button
              onClick={() => setResetPasswordTargetUser(null)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3 text-amber-500">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Key className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-amber-600 dark:text-amber-400">กำหนดรหัสผ่านใหม่ (Reset Password)</h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  สำหรับผู้ใช้: <strong className="text-amber-500">{resetPasswordTargetUser.firstNameTh} {resetPasswordTargetUser.lastNameTh}</strong> ({resetPasswordTargetUser.email})
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-bold mb-1">รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)</label>
                <input
                  type="text"
                  value={resetPasswordInput}
                  onChange={(e) => setResetPasswordInput(e.target.value)}
                  placeholder="กรอกรหัสผ่านใหม่ที่นี่..."
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-mono font-semibold transition ${
                    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-600 dark:text-amber-400 space-y-1">
                <p className="font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>คำแนะนำด้านความปลอดภัย:</span>
                </p>
                <p className="opacity-90">
                  เมื่อเปลี่ยนรหัสผ่านแล้ว แจ้งรหัสผ่านใหม่ให้ผู้ใช้ทราบเพื่อเข้าใช้งานครั้งถัดไป
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-700/30">
              <button
                type="button"
                onClick={() => setResetPasswordTargetUser(null)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveResetPassword}
                className="px-5 py-2 rounded-xl font-extrabold text-xs text-white bg-amber-600 hover:bg-amber-500 transition shadow-lg shadow-amber-600/30 cursor-pointer"
              >
                ยืนยันการตั้งรหัสผ่านใหม่
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendTargetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className={`border rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl relative overflow-hidden ${
            suspendTargetUser.isSuspended
              ? isDarkMode ? 'bg-slate-900 border-emerald-500/30 text-slate-100' : 'bg-white border-emerald-200 text-slate-900'
              : isDarkMode ? 'bg-slate-900 border-rose-500/30 text-slate-100' : 'bg-white border-rose-200 text-slate-900'
          }`}>
            <button
              onClick={() => setSuspendTargetUser(null)}
              className={`absolute right-4 top-4 p-2 rounded-full transition ${
                isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
                suspendTargetUser.isSuspended
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-500'
              }`}>
                {suspendTargetUser.isSuspended ? <Unlock className="w-5 h-5 stroke-[2.2]" /> : <Lock className="w-5 h-5 stroke-[2.2]" />}
              </div>
              <div>
                <h3 className={`text-base font-extrabold ${suspendTargetUser.isSuspended ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {suspendTargetUser.isSuspended ? 'ปลดการระงับบัญชี (Unsuspend)' : 'ระงับการใช้งานบัญชี (Suspend Account)'}
                </h3>
                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  ผู้ใช้: <strong>{suspendTargetUser.firstNameTh} {suspendTargetUser.lastNameTh}</strong> ({suspendTargetUser.email})
                </p>
              </div>
            </div>

            {!suspendTargetUser.isSuspended && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-bold mb-1">เหตุผลในการระงับบัญชี (ระบุเพื่อแจ้งผู้ใช้)</label>
                  <textarea
                    rows={3}
                    value={suspendReasonInput}
                    onChange={(e) => setSuspendReasonInput(e.target.value)}
                    placeholder="เช่น ละเมิดเงื่อนไขการใช้งาน, ข้อมูลซ้ำซ้อน, รอการยืนยันตัวตน..."
                    className={`w-full p-3 rounded-xl border text-xs transition ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-300 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            )}

            {suspendTargetUser.isSuspended && (
              <p className={`text-xs leading-relaxed pt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                เมื่อดำเนินการปลดระงับ บัญชีนี้จะสามารถสแกนเข้าชั้นเรียนและลงชื่อเข้าใช้งานได้ตามปกติทันที
              </p>
            )}

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-700/30">
              <button
                type="button"
                onClick={() => setSuspendTargetUser(null)}
                className={`px-4 py-2 rounded-xl font-bold text-xs transition border cursor-pointer ${
                  isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                }`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSaveSuspendStatus}
                className={`px-5 py-2 rounded-xl font-extrabold text-xs text-white transition shadow-lg cursor-pointer ${
                  suspendTargetUser.isSuspended
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                }`}
              >
                {suspendTargetUser.isSuspended ? 'ยืนยันปลดระงับ' : 'ยืนยันการระงับบัญชี'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
