import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  ShieldCheck,
  Key,
  Trash2,
  Edit2,
  X,
  Check,
  Search,
  Building2,
  QrCode,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'organizer' | 'scanner';
  pinCode: string;
  assignedFestivalId: 'all' | 'denhaag' | 'gent' | 'amsterdam';
  createdAt: string;
  lastLoginAt?: string | null;
}

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'organizer' | 'scanner'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'organizer' | 'scanner'>('admin');
  const [formPinCode, setFormPinCode] = useState('2026');
  const [formFestivalId, setFormFestivalId] = useState<'all' | 'denhaag' | 'gent' | 'amsterdam'>('all');
  const [showPassword, setShowPassword] = useState(false);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<AdminUserItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Kon gebruikers niet laden.');
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Fout bij het laden van gebruikers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('admin');
    setFormPinCode('2026');
    setFormFestivalId('all');
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEditModal = (user: AdminUserItem) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword(''); // Leave blank unless changing
    setFormRole(user.role);
    setFormPinCode(user.pinCode || '2026');
    setFormFestivalId(user.assignedFestivalId || 'all');
    setFormError(null);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let result = 'Whisky-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(result);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formName.trim() || !formEmail.trim()) {
      setFormError('Naam en e-mailadres zijn verplicht.');
      return;
    }

    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      setFormError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }

    if (editingUser && formPassword && formPassword.length < 6) {
      setFormError('Nieuw wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingUser) {
        // PUT update
        const payload: any = {
          name: formName.trim(),
          email: formEmail.trim(),
          role: formRole,
          pinCode: formPinCode.trim(),
          assignedFestivalId: formFestivalId,
        };
        if (formPassword.trim()) {
          payload.password = formPassword.trim();
        }

        const res = await fetch(`/api/admin/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fout bij bijwerken.');

        setSuccessMessage(`Beheerder "${formName}" succesvol bijgewerkt!`);
      } else {
        // POST create
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName.trim(),
            email: formEmail.trim(),
            password: formPassword.trim(),
            role: formRole,
            pinCode: formPinCode.trim(),
            assignedFestivalId: formFestivalId,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Fout bij aanmaken.');

        setSuccessMessage(`Beheerder "${formName}" succesvol toegevoegd!`);
      }

      setIsModalOpen(false);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Er is een fout opgetreden.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmUser) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/admin/users/${deleteConfirmUser.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kon beheerder niet verwijderen.');

      setSuccessMessage(`Beheerder "${deleteConfirmUser.name}" is verwijderd.`);
      setDeleteConfirmUser(null);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Kon beheerder niet verwijderen.');
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePinVisibility = (userId: string) => {
    setShowPins((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  // Filtered list
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalOrganizers = users.filter((u) => u.role === 'organizer').length;
  const totalScanners = users.filter((u) => u.role === 'scanner').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[4px_4px_0px_rgba(29,28,26,0.9)] rounded-xl p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#061A10] to-[#006448] border-2 border-[#caac8e] flex items-center justify-center shrink-0 shadow-md">
              <Users className="w-6 h-6 text-[#caac8e]" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-[#1D1C1A]">
                Beheerders & Team
              </h1>
              <p className="text-xs sm:text-sm text-[#4c5752] font-medium">
                Beheer wie toegang heeft tot de centrale Cockpit en scanapparaten.
              </p>
            </div>
          </div>

          <button
            onClick={openCreateModal}
            className="btn-letterpress inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider self-start md:self-auto shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nieuwe Beheerder</span>
          </button>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-[#c1d4ce]/60 text-xs">
          <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded-lg p-3">
            <span className="text-[#4c5752] block text-[11px] font-semibold">Totaal Accounts</span>
            <span className="text-lg font-black text-[#1D1C1A]">{users.length}</span>
          </div>
          <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded-lg p-3">
            <span className="text-[#006448] block text-[11px] font-semibold">Cockpit Admins</span>
            <span className="text-lg font-black text-[#006448]">{totalAdmins}</span>
          </div>
          <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded-lg p-3">
            <span className="text-[#caac8e] block text-[11px] font-semibold">Organisatoren</span>
            <span className="text-lg font-black text-[#856b50]">{totalOrganizers}</span>
          </div>
          <div className="bg-[#FAF7F2] border border-[#c1d4ce] rounded-lg p-3">
            <span className="text-[#1D1C1A] block text-[11px] font-semibold">Deurscanners</span>
            <span className="text-lg font-black text-[#1D1C1A]">{totalScanners}</span>
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border-2 border-[#006448] rounded-xl text-[#006448] text-xs font-bold flex items-center justify-between shadow-[2px_2px_0px_rgba(0,100,72,0.3)] animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#006448]" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-800 hover:text-emerald-950">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoeken op naam of e-mailadres..."
            className="w-full pl-9 pr-3 py-2 bg-[#FCFAF7] border-2 border-[#1D1C1A] rounded-lg text-xs font-semibold placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#006448] shadow-[2px_2px_0px_rgba(29,28,26,0.15)]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'admin', 'organizer', 'scanner'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border-2 transition-all cursor-pointer ${
                roleFilter === r
                  ? 'bg-[#1D1C1A] text-[#e4d5c4] border-[#1D1C1A] shadow-[2px_2px_0px_rgba(29,28,26,0.4)]'
                  : 'bg-[#FCFAF7] text-[#4c5752] border-[#c1d4ce] hover:border-[#1D1C1A]'
              }`}
            >
              {r === 'all' ? 'Alle Rollen' : r === 'admin' ? 'Admins' : r === 'organizer' ? 'Organisatoren' : 'Scanners'}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table Card */}
      <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[4px_4px_0px_rgba(29,28,26,0.9)] rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs font-bold text-[#4c5752]">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#006448]" />
            <span>Beheerders ophalen...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#4c5752]">
            <p className="font-bold text-sm text-[#1D1C1A]">Geen beheerders gevonden</p>
            <p className="mt-1">Probeer een andere zoekopdracht of voeg een nieuwe beheerder toe.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-[#061A10] to-[#0E3823] text-[#e4d5c4] text-[11px] font-extrabold uppercase tracking-wider border-b-2 border-[#1D1C1A]">
                  <th className="py-3 px-4">Gebruiker</th>
                  <th className="py-3 px-4">Rol & Rechten</th>
                  <th className="py-3 px-4">Toegang Festival</th>
                  <th className="py-3 px-4">Scanner PIN</th>
                  <th className="py-3 px-4">Laatste Activiteit</th>
                  <th className="py-3 px-4 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#c1d4ce]/50 text-xs font-medium">
                {filteredUsers.map((u) => {
                  const isSuperAdmin = u.email === 'beheer@whiskyfestival.nl';
                  return (
                    <tr key={u.id} className="hover:bg-[#FAF7F2] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-[#006448] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm border border-[#caac8e]/40">
                            {u.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-[#1D1C1A] flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {isSuperAdmin && (
                                <span className="inline-flex items-center gap-0.5 bg-[#caac8e]/30 text-[#006448] text-[9px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider border border-[#caac8e]/60">
                                  <ShieldCheck className="w-2.5 h-2.5" /> Hoofdadmin
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-500 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {u.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-[#006448] font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-[#006448]/30">
                            <Shield className="w-3 h-3" /> Admin (Volledig)
                          </span>
                        ) : u.role === 'organizer' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-800/30">
                            <Building2 className="w-3 h-3" /> Organisator
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 font-black text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider border border-gray-400">
                            <QrCode className="w-3 h-3" /> Scanner Staff
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#1D1C1A]">
                          {u.assignedFestivalId === 'all'
                            ? 'Alle 3 Festivals'
                            : u.assignedFestivalId === 'denhaag'
                            ? 'Den Haag'
                            : u.assignedFestivalId === 'gent'
                            ? 'Gent'
                            : 'Amsterdam'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <code className="bg-[#FAF7F2] border border-[#c1d4ce] px-2 py-0.5 rounded font-mono font-bold text-[#006448] text-xs">
                            {showPins[u.id] ? u.pinCode || '2026' : '••••'}
                          </code>
                          <button
                            onClick={() => togglePinVisibility(u.id)}
                            className="text-gray-400 hover:text-[#1D1C1A] p-1"
                            title="PIN tonen/verbergen"
                          >
                            {showPins[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-500 text-[11px]">
                        {u.lastLoginAt ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#006448]" />
                            {new Date(u.lastLoginAt).toLocaleDateString('nl-NL', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-gray-400">Nog niet ingelogd</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(u)}
                            className="p-1.5 rounded-lg border border-[#c1d4ce] text-[#1D1C1A] hover:bg-[#006448] hover:text-white hover:border-[#006448] transition-colors"
                            title="Bewerken"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmUser(u)}
                            disabled={isSuperAdmin}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isSuperAdmin
                                ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                : 'border-[#c1d4ce] text-red-600 hover:bg-red-600 hover:text-white hover:border-red-600'
                            }`}
                            title={isSuperAdmin ? 'Hoofdadmin kan niet verwijderd worden' : 'Verwijderen'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[8px_8px_0px_rgba(29,28,26,0.9)] rounded-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#061A10] to-[#0E3823] text-[#FAF7F2] px-5 py-4 border-b-2 border-[#1D1C1A] flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#caac8e]">
                  {editingUser ? 'Beheerder Bewerken' : 'Nieuwe Beheerder Toevoegen'}
                </h2>
                <p className="text-[11px] text-[#d8e7e2]">
                  {editingUser ? 'Pas toegangsrechten of inloggegevens aan' : 'Maak een nieuw account aan voor de cockpit'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-[#061A10] border border-[#caac8e]/40 flex items-center justify-center text-[#caac8e] hover:bg-[#caac8e] hover:text-[#061A10] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 text-xs font-semibold text-[#1D1C1A]">
              {formError && (
                <div className="p-3 bg-red-50 border-2 border-red-800 rounded-lg text-red-900 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-800 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="block uppercase tracking-wider font-extrabold mb-1">Volledige Naam:</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="bijv. Robert-Jan Bakker"
                  className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block uppercase tracking-wider font-extrabold mb-1">E-mailadres (inlognaam):</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="beheerder@whiskyfestival.nl"
                  className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="uppercase tracking-wider font-extrabold">
                    {editingUser ? 'Wachtwoord (laat leeg om niet te wijzigen):' : 'Wachtwoord:'}
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 text-[11px] text-[#006448] hover:text-[#1D1C1A] font-bold"
                  >
                    <RefreshCw className="w-3 h-3 text-[#caac8e]" />
                    <span>Genereer sterk wachtwoord</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? '•••••••••••• (ongewijzigd)' : 'Minimaal 6 tekens'}
                    className="w-full pl-3 pr-10 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-[#1D1C1A]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role & Festival Access Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block uppercase tracking-wider font-extrabold mb-1">Rol / Permissies:</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    <option value="admin">Admin (Volledige Cockpit)</option>
                    <option value="organizer">Organisator (Overzicht & Orders)</option>
                    <option value="scanner">Deurscanner (Alleen /scan)</option>
                  </select>
                </div>

                <div>
                  <label className="block uppercase tracking-wider font-extrabold mb-1">Toegang Festival:</label>
                  <select
                    value={formFestivalId}
                    onChange={(e) => setFormFestivalId(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-xs font-bold text-[#1D1C1A] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  >
                    <option value="all">Alle 3 Festivals</option>
                    <option value="denhaag">Alleen Den Haag</option>
                    <option value="gent">Alleen Gent</option>
                    <option value="amsterdam">Alleen Amsterdam</option>
                  </select>
                </div>
              </div>

              {/* Scanner PIN Code */}
              <div>
                <label className="block uppercase tracking-wider font-extrabold mb-1">
                  Deurscanner PIN-code (voor snelle login op /scan):
                </label>
                <div className="relative w-36">
                  <Key className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    maxLength={6}
                    value={formPinCode}
                    onChange={(e) => setFormPinCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="2026"
                    className="w-full pl-9 pr-3 py-2 bg-white border-2 border-[#1D1C1A] rounded-lg text-sm font-mono font-bold tracking-widest text-[#006448] focus:outline-none focus:ring-2 focus:ring-[#006448]"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#c1d4ce]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border-2 border-[#1D1C1A] font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-letterpress px-5 py-2 rounded-lg font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Opslaan...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingUser ? 'Wijzigingen Opslaan' : 'Beheerder Toevoegen'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#FCFAF7] border-2 border-[#1D1C1A] shadow-[8px_8px_0px_rgba(29,28,26,0.9)] rounded-xl w-full max-w-md p-6 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 border-2 border-red-600 text-red-600 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black uppercase text-[#1D1C1A] tracking-tight">
              Beheerder Verwijderen?
            </h3>
            <p className="mt-1 text-xs text-[#4c5752] leading-relaxed">
              Weet je zeker dat je het account van{' '}
              <strong className="text-[#1D1C1A] font-bold">"{deleteConfirmUser.name}"</strong> (
              {deleteConfirmUser.email}) wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </p>

            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setDeleteConfirmUser(null)}
                className="px-4 py-2 rounded-lg border-2 border-[#1D1C1A] font-bold text-xs uppercase tracking-wider hover:bg-gray-100 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs uppercase tracking-wider border-2 border-[#1D1C1A] shadow-[3px_3px_0px_rgba(29,28,26,0.9)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
              >
                {isDeleting ? 'Verwijderen...' : 'Definitief Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
