'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api, ReusableOptionGroup } from '@/lib/api';
import {
  RiListSettingsLine,
  RiAddLine,
  RiSearch2Line,
  RiDeleteBinLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiCheckLine,
  RiCloseLine,
  RiEditLine,
  RiFileCopyLine,
  RiInformationLine,
  RiMagicLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiArrowRightLine,
  RiFileTextLine,
  RiRefreshLine,
} from 'react-icons/ri';

interface OptionValueItem {
  id?: string;
  label: string;
  value: string;
  isDefault?: boolean;
}

export default function OptionGroupsLibraryPage() {
  const [groups, setGroups] = useState<ReusableOptionGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State for Selected / New Group
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formInputType, setFormInputType] = useState('SELECT');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formOptions, setFormOptions] = useState<OptionValueItem[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Modals
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');
  const [isAddValueModalOpen, setIsAddValueModalOpen] = useState(false);
  const [editingValueIdx, setEditingValueIdx] = useState<number | null>(null);
  const [valFormLabel, setValFormLabel] = useState('');
  const [valFormValue, setValFormValue] = useState('');
  const [valFormIsDefault, setValFormIsDefault] = useState(false);
  const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<ReusableOptionGroup | null>(null);

  // Fetch groups on mount
  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async (selectId?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.adminListReusableGroups();
      setGroups(data);
      if (data.length > 0) {
        const target = selectId ? data.find((g) => g.id === selectId) : data[0];
        selectGroup(target || data[0]);
      } else {
        setSelectedGroupId(null);
        resetForm();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch reusable option groups.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectGroup = (group: ReusableOptionGroup) => {
    setIsCreatingNew(false);
    setSelectedGroupId(group.id);
    setFormName(group.name);
    setFormCode(group.code);
    setFormInputType(group.inputType || 'SELECT');
    setFormDescription(group.description || '');
    setFormIsActive(group.isActive);

    const opts: OptionValueItem[] = Array.isArray(group.defaultOptions)
      ? group.defaultOptions.map((o: any, idx: number) => ({
          id: o.id || `opt-${idx}`,
          label: o.label || '',
          value: o.value || '',
          isDefault: Boolean(o.isDefault),
        }))
      : [];
    setFormOptions(opts);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const resetForm = () => {
    setFormName('');
    setFormCode('');
    setFormInputType('SELECT');
    setFormDescription('');
    setFormIsActive(true);
    setFormOptions([]);
  };

  const handleStartCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedGroupId(null);
    resetForm();
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Filtered groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      const matchesSearch =
        !searchQuery.trim() ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && g.isActive) ||
        (statusFilter === 'INACTIVE' && !g.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [groups, searchQuery, statusFilter]);

  // Total values count across all groups
  const totalLibraryValues = useMemo(() => {
    return groups.reduce((acc, g) => {
      const count = Array.isArray(g.defaultOptions) ? g.defaultOptions.length : 0;
      return acc + count;
    }, 0);
  }, [groups]);

  // Auto-slugify code when creating new
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormName(val);
    if (isCreatingNew) {
      const autoCode = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      setFormCode(autoCode);
    }
  };

  // Save Group (Create or Update)
  const handleSaveGroup = async () => {
    if (!formName.trim()) {
      setErrorMsg('Group name is required.');
      return;
    }
    if (!formCode.trim()) {
      setErrorMsg('Group unique code identifier is required.');
      return;
    }

    // Check for duplicate value codes
    const valCodes = formOptions.map((o) => o.value);
    const dupes = valCodes.filter((v, i) => valCodes.indexOf(v) !== i);
    if (dupes.length > 0) {
      setErrorMsg(`Duplicate option value code detected: '${dupes[0]}'. Each value must have a unique code.`);
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      name: formName.trim(),
      code: formCode.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
      inputType: formInputType,
      description: formDescription.trim() || null,
      isActive: formIsActive,
      defaultOptions: formOptions.map((opt, idx) => ({
        label: opt.label.trim(),
        value: opt.value.trim(),
        isDefault: Boolean(opt.isDefault),
        sortOrder: idx,
      })),
    };

    try {
      if (isCreatingNew) {
        const created = await api.adminCreateReusableGroup(payload);
        setSuccessMsg(`Option group '${created.name}' created successfully with ${payload.defaultOptions.length} values.`);
        await loadGroups(created.id);
      } else if (selectedGroupId) {
        const updated = await api.adminUpdateReusableGroup(selectedGroupId, payload);
        const countText = (updated as any).affectedProductsCount ? ` (${(updated as any).affectedProductsCount} products updated)` : '';
        setSuccessMsg(`Option group '${updated.name}' updated and synchronized across all products${countText}.`);
        await loadGroups(updated.id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save option group.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!deleteConfirmGroup) return;
    setIsSaving(true);
    setErrorMsg(null);
    try {
      await api.adminDeleteReusableGroup(deleteConfirmGroup.id);
      setSuccessMsg(`Group '${deleteConfirmGroup.name}' removed from library.`);
      setDeleteConfirmGroup(null);
      await loadGroups();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete group.');
    } finally {
      setIsSaving(false);
    }
  };

  // Value Items Operations
  const handleOpenAddValueModal = (editIdx?: number) => {
    if (editIdx !== undefined) {
      setEditingValueIdx(editIdx);
      const opt = formOptions[editIdx];
      setValFormLabel(opt.label);
      setValFormValue(opt.value);
      setValFormIsDefault(Boolean(opt.isDefault));
    } else {
      setEditingValueIdx(null);
      setValFormLabel('');
      setValFormValue('');
      setValFormIsDefault(formOptions.length === 0);
    }
    setIsAddValueModalOpen(true);
  };

  const handleSaveSingleValue = () => {
    if (!valFormLabel.trim()) return;
    const finalVal = valFormValue.trim()
      ? valFormValue.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_')
      : valFormLabel.toLowerCase().replace(/[^a-z0-9_]+/g, '_');

    const newOpt: OptionValueItem = {
      label: valFormLabel.trim(),
      value: finalVal,
      isDefault: valFormIsDefault,
    };

    if (editingValueIdx !== null) {
      setFormOptions((prev) => {
        const copy = [...prev];
        if (newOpt.isDefault) {
          copy.forEach((o) => (o.isDefault = false));
        }
        copy[editingValueIdx] = newOpt;
        return copy;
      });
    } else {
      setFormOptions((prev) => {
        let copy = [...prev];
        if (newOpt.isDefault) {
          copy = copy.map((o) => ({ ...o, isDefault: false }));
        }
        return [...copy, newOpt];
      });
    }

    setIsAddValueModalOpen(false);
  };

  const handleDeleteValue = (index: number) => {
    setFormOptions((prev) => {
      const copy = prev.filter((_, idx) => idx !== index);
      if (copy.length > 0 && !copy.some((o) => o.isDefault)) {
        copy[0].isDefault = true;
      }
      return copy;
    });
  };

  const handleMoveValue = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === formOptions.length - 1) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    setFormOptions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleSetDefaultValue = (index: number) => {
    setFormOptions((prev) =>
      prev.map((opt, idx) => ({
        ...opt,
        isDefault: idx === index,
      }))
    );
  };

  // Bulk Values Parse & Add
  const handleBulkAddValues = () => {
    if (!bulkInputText.trim()) return;

    const lines = bulkInputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: OptionValueItem[] = lines.map((line, idx) => {
      const parts = line.split(',').map((p) => p.trim());
      const label = parts[0] || `Option ${idx + 1}`;
      const val = parts[1]
        ? parts[1].toLowerCase().replace(/[^a-z0-9_]+/g, '_')
        : label.toLowerCase().replace(/[^a-z0-9_]+/g, '_');

      return {
        label,
        value: val,
        isDefault: formOptions.length === 0 && idx === 0,
      };
    });

    setFormOptions((prev) => [...prev, ...parsed]);
    setBulkInputText('');
    setIsBulkModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-black">
      {/* Top Header & Breadcrumbs */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/admin/products" className="hover:text-black transition-colors">
                Catalogue
              </Link>
              <span>/</span>
              <span className="text-black">Option Groups Library</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <RiListSettingsLine className="w-7 h-7 text-[#D4AF37]" />
              Reusable Option Groups Library
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Define standard option groups (Material, Size, Printing Location, Finish) and configure their default values. Changes made here provide starter templates without breaking individual product configurations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadGroups(selectedGroupId || undefined)}
              disabled={isLoading}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors border border-slate-300"
              title="Refresh groups"
            >
              <RiRefreshLine className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            <button
              onClick={handleStartCreateNew}
              className="px-4 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg flex items-center gap-2 shadow-xs transition-colors border border-neutral-300"
            >
              <RiAddLine className="w-4 h-4" />
              Create Option Group
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Banner Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Library Groups
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{groups.length}</div>
            <span className="text-[11px] text-slate-600">Central templates available</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Active Groups
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {groups.filter((g) => g.isActive).length}
            </div>
            <span className="text-[11px] text-slate-600">Ready to attach to products</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Configured Values
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">{totalLibraryValues}</div>
            <span className="text-[11px] text-slate-600">Option choices across groups</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Product Studio Sync
              </span>
              <div className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                <RiCheckboxCircleLine className="w-4 h-4 text-emerald-500" />
                Decoupled Clones
              </div>
              <span className="text-[11px] text-slate-600">Never modifies library on save</span>
            </div>
            <Link
              href="/admin/products/new"
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
              title="Open Product Setup Studio"
            >
              <RiArrowRightLine className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Global Alert Messages */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <RiErrorWarningLine className="w-4 h-4 flex-shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-500 hover:text-rose-800"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <RiCheckboxCircleLine className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg(null)}
              className="text-emerald-500 hover:text-emerald-800"
            >
              <RiCloseLine className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Studio Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Group List & Search (4 Cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Option Groups ({filteredGroups.length})
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {groups.filter((g) => g.isActive).length} Active
                </span>
              </div>

              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search group name or code..."
                  className="w-full h-8 pl-8 pr-3 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg placeholder:text-slate-600 focus:outline-none focus:border-black focus:ring-1 focus:ring-black transition-all"
                />
                <RiSearch2Line className="w-3.5 h-3.5 text-slate-600 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1.5 pt-0.5">
                {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                      statusFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* List Items */}
            <div className="divide-y divide-slate-100 max-h-[620px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-slate-600 space-y-2">
                  <RiRefreshLine className="w-5 h-5 mx-auto animate-spin text-[#D4AF37]" />
                  <p>Loading library groups...</p>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-600 space-y-3">
                  <RiInformationLine className="w-6 h-6 mx-auto text-slate-600" />
                  <p>No option groups match your search.</p>
                  <button
                    onClick={handleStartCreateNew}
                    className="px-3 py-1.5 bg-[#FFED00] text-black text-xs font-bold rounded-lg border border-neutral-300 inline-block"
                  >
                    + Add New Group
                  </button>
                </div>
              ) : (
                filteredGroups.map((group) => {
                  const isSelected = selectedGroupId === group.id && !isCreatingNew;
                  const optsCount = Array.isArray(group.defaultOptions) ? group.defaultOptions.length : 0;

                  return (
                    <div
                      key={group.id}
                      onClick={() => selectGroup(group)}
                      className={`p-3.5 cursor-pointer transition-all flex items-center justify-between border-l-4 ${
                        isSelected
                          ? 'bg-[#FFFDE6] border-[#FFED00]'
                          : 'hover:bg-slate-50 border-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {group.name}
                          </span>
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              group.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={group.isActive ? 'Active' : 'Inactive'}
                          />
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono mt-0.5">
                          <span>{group.code}</span>
                          <span>•</span>
                          <span className="font-sans font-semibold text-slate-600">
                            {group.inputType}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 text-slate-700 rounded-md border border-slate-200">
                          {optsCount} {optsCount === 1 ? 'val' : 'vals'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Footer Add Action */}
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <button
                onClick={handleStartCreateNew}
                className={`w-full py-2 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                  isCreatingNew
                    ? 'bg-slate-900 text-white border-black'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-300'
                }`}
              >
                <RiAddLine className="w-4 h-4" />
                {isCreatingNew ? 'Currently Creating New Group' : 'Create New Reusable Group'}
              </button>
            </div>
          </div>

          {/* Right Panel: Selected Group Editor & Inside Values (8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Header Bar */}
              <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#FFED00] text-black flex items-center justify-center font-bold text-sm border border-neutral-300 flex-shrink-0">
                    <RiListSettingsLine className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      {isCreatingNew
                        ? 'Create New Reusable Option Group'
                        : `Edit Group: ${formName || 'Untitled Group'}`}
                    </h2>
                    <p className="text-xs text-slate-600">
                      {isCreatingNew
                        ? 'Define group identity and add its default option values below.'
                        : `Unique code: '${formCode || '—'}'. Used as template when attaching to products.`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!isCreatingNew && selectedGroupId && (
                    <button
                      onClick={() => {
                        const target = groups.find((g) => g.id === selectedGroupId);
                        if (target) setDeleteConfirmGroup(target);
                      }}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg flex items-center gap-1 border border-rose-200 transition-colors"
                      title="Delete this group from library"
                    >
                      <RiDeleteBinLine className="w-3.5 h-3.5" />
                      Delete Group
                    </button>
                  )}

                  <button
                    onClick={handleSaveGroup}
                    disabled={isSaving}
                    className="px-4 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg flex items-center gap-1.5 border border-neutral-300 shadow-xs transition-colors"
                  >
                    <RiCheckLine className="w-4 h-4" />
                    {isSaving ? 'Saving...' : isCreatingNew ? 'Create Group' : 'Save Changes'}
                  </button>
                </div>
              </div>

              {/* Group Core Metadata Form */}
              <div className="p-4 sm:p-6 space-y-4 border-b border-slate-200">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <RiEditLine className="w-3.5 h-3.5 text-slate-500" />
                  Group Details & Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Group Name */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Group Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={handleNameChange}
                      placeholder="e.g. Paper Stock, Finish, Size"
                      className="w-full h-9 px-3 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg placeholder:text-slate-600 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <p className="text-[11px] text-slate-600">Display label shown to customers and operators</p>
                  </div>

                  {/* Unique Code */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Unique Code Identifier <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
                      placeholder="e.g. paper_stock, finish, size"
                      className="w-full h-9 px-3 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-lg placeholder:text-slate-600 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                    <p className="text-[11px] text-slate-600">Stable alphanumeric snake_case identifier</p>
                  </div>

                  {/* Input Type */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Input Type</label>
                    <select
                      value={formInputType}
                      onChange={(e) => setFormInputType(e.target.value)}
                      className="w-full h-9 px-3 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    >
                      <option value="SELECT">Dropdown Select (SELECT)</option>
                      <option value="RADIO">Radio Buttons (RADIO)</option>
                      <option value="CHECKBOX">Checkboxes (CHECKBOX)</option>
                      <option value="TOGGLE">Toggle Switch (TOGGLE)</option>
                    </select>
                    <p className="text-[11px] text-slate-600">Customer selection presentation style</p>
                  </div>

                  {/* Active Status */}
                  <div className="space-y-1 flex flex-col justify-end">
                    <label className="text-xs font-semibold text-slate-700">Status</label>
                    <div className="h-9 flex items-center gap-3">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formIsActive}
                          onChange={(e) => setFormIsActive(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-slate-900"></div>
                        <span className="ml-2.5 text-xs font-semibold text-slate-800">
                          {formIsActive ? 'Active in Library' : 'Inactive / Draft'}
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Description / Operator Guidance
                  </label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Describe what this option group controls (e.g. Substrate grammage and coating options)..."
                    className="w-full p-2.5 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg placeholder:text-slate-600 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              {/* Inside Group: Option Values Manager */}
              <div className="p-4 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                      <RiFileTextLine className="w-4 h-4 text-[#D4AF37]" />
                      Values Inside This Group ({formOptions.length})
                    </h3>
                    <p className="text-xs text-slate-600">
                      Configure the specific choices available for this group (e.g. 130 GSM, 170 GSM, 250 GSM, 300 GSM).
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(true)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-300 transition-colors"
                    >
                      <RiFileCopyLine className="w-3.5 h-3.5" />
                      Bulk Add Values
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenAddValueModal()}
                      className="px-3.5 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg flex items-center gap-1.5 border border-neutral-300 shadow-xs transition-colors"
                    >
                      <RiAddLine className="w-4 h-4" />
                      Add Value
                    </button>
                  </div>
                </div>

                {/* Values Table / List */}
                {formOptions.length === 0 ? (
                  <div className="p-8 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50/50">
                    <RiMagicLine className="w-8 h-8 mx-auto text-slate-600" />
                    <div>
                      <p className="text-xs font-bold text-slate-800">No option values added yet</p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Add values individually or paste multiple lines in bulk to quickly populate this group.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 pt-1">
                      <button
                        onClick={() => handleOpenAddValueModal()}
                        className="px-3 py-1.5 bg-[#FFED00] text-black text-xs font-bold rounded-lg border border-neutral-300 shadow-xs"
                      >
                        + Add First Value
                      </button>
                      <button
                        onClick={() => setIsBulkModalOpen(true)}
                        className="px-3 py-1.5 bg-white text-slate-700 text-xs font-semibold rounded-lg border border-slate-300"
                      >
                        Paste Bulk Lines
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase text-[11px] tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 w-12 text-center">Order</th>
                          <th className="py-2.5 px-3">Option Label</th>
                          <th className="py-2.5 px-3">Value Code</th>
                          <th className="py-2.5 px-3 text-center w-20">Default</th>
                          <th className="py-2.5 px-3 text-right w-24">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formOptions.map((opt, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            {/* Order Buttons */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveValue(idx, 'UP')}
                                  disabled={idx === 0}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20"
                                  title="Move Up"
                                >
                                  <RiArrowUpLine className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveValue(idx, 'DOWN')}
                                  disabled={idx === formOptions.length - 1}
                                  className="p-1 hover:bg-slate-200 rounded text-slate-500 disabled:opacity-20"
                                  title="Move Down"
                                >
                                  <RiArrowDownLine className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* Label */}
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {opt.label}
                            </td>

                            {/* Value */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                              {opt.value}
                            </td>

                            {/* Default Toggle */}
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="radio"
                                name="group_default_option"
                                checked={Boolean(opt.isDefault)}
                                onChange={() => handleSetDefaultValue(idx)}
                                className="w-4 h-4 text-black focus:ring-black cursor-pointer accent-[#D4AF37]"
                                title="Set as default selection"
                              />
                            </td>

                            {/* Actions */}
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenAddValueModal(idx)}
                                  className="p-1.5 hover:bg-slate-200 text-slate-600 rounded transition-colors"
                                  title="Edit Value"
                                >
                                  <RiEditLine className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteValue(idx)}
                                  className="p-1.5 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                                  title="Delete Value"
                                >
                                  <RiDeleteBinLine className="w-3.5 h-3.5" />
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

              {/* Bottom Sticky Action Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {formOptions.length} values configured for this reusable group
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedGroupId) {
                        const target = groups.find((g) => g.id === selectedGroupId);
                        if (target) selectGroup(target);
                      } else {
                        handleStartCreateNew();
                      }
                    }}
                    className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300"
                  >
                    Reset Form
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveGroup}
                    disabled={isSaving}
                    className="px-5 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg border border-neutral-300 shadow-xs transition-colors"
                  >
                    {isSaving ? 'Saving...' : isCreatingNew ? 'Create Group' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Add / Edit Single Option Value */}
      {isAddValueModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {editingValueIdx !== null ? 'Edit Option Value' : 'Add New Option Value'}
              </h3>
              <button
                onClick={() => setIsAddValueModalOpen(false)}
                className="text-slate-600 hover:text-black"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">
                  Option Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={valFormLabel}
                  onChange={(e) => {
                    const l = e.target.value;
                    setValFormLabel(l);
                    if (editingValueIdx === null) {
                      setValFormValue(l.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
                    }
                  }}
                  placeholder="e.g. 300 GSM Velvet Card, Gloss UV"
                  className="w-full h-9 px-3 text-xs bg-white text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Value Code</label>
                <input
                  type="text"
                  value={valFormValue}
                  onChange={(e) => setValFormValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'))}
                  placeholder="e.g. 300_gsm_velvet_card"
                  className="w-full h-9 px-3 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={valFormIsDefault}
                    onChange={(e) => setValFormIsDefault(e.target.checked)}
                    className="w-4 h-4 text-black rounded focus:ring-black accent-[#D4AF37]"
                  />
                  <span className="text-xs font-semibold text-slate-800">
                    Set as default selected value
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsAddValueModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveSingleValue}
                className="px-4 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg border border-neutral-300"
              >
                {editingValueIdx !== null ? 'Update Value' : 'Add Value'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Bulk Values Multiline Paste */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Bulk Add Option Values</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Paste multiple options at once (one per line).
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-600 hover:text-black"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-1">
                <span className="font-bold">Format:</span>
                <code className="block bg-amber-100/70 p-1 rounded font-mono text-[11px]">
                  Option Label, value_code (or simply Option Label)
                </code>
                <span className="text-[11px] text-amber-800">
                  Example:
                  <br />
                  130 GSM Gloss Art, 130_gsm<br />
                  170 GSM Matte Art, 170_gsm<br />
                  250 GSM Premium Card, 250_gsm
                </span>
              </div>

              <textarea
                rows={7}
                value={bulkInputText}
                onChange={(e) => setBulkInputText(e.target.value)}
                placeholder="130 GSM Gloss Art&#10;170 GSM Matte Art&#10;250 GSM Premium Card"
                className="w-full p-3 text-xs font-mono bg-slate-50 text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <span className="text-xs text-slate-600">
                {bulkInputText.trim()
                  ? `${bulkInputText.trim().split('\n').filter((l) => l.trim()).length} lines detected`
                  : '0 lines'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkAddValues}
                  disabled={!bulkInputText.trim()}
                  className="px-4 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg border border-neutral-300 disabled:opacity-50"
                >
                  Import All Values
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {deleteConfirmGroup && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <RiDeleteBinLine className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Option Group</h3>
                <p className="text-xs text-slate-600">This action cannot be undone.</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-1">
              <span className="font-bold block">⚠️ Cascade Deletion Notice:</span>
              <span>
                Deleting <strong className="font-bold">{deleteConfirmGroup.name}</strong> will remove it from the reusable library AND completely delete this option group across all products that use it.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setDeleteConfirmGroup(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteGroup}
                disabled={isSaving}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {isSaving ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
