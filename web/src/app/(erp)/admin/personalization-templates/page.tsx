'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  api,
  PersonalizationTemplate,
  PersonalizationField,
  PersonalizationInputType,
  PersonalizationScope,
} from '@/lib/api';
import {
  RiFileTextLine,
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
  RiRefreshLine,
  RiInputMethodLine,
  RiEyeLine,
  RiSettings4Line,
  RiCalendarEventLine,
  RiGroupLine,
  RiFileList3Line,
  RiUpload2Line,
} from 'react-icons/ri';

const INPUT_TYPE_OPTIONS: { label: string; value: PersonalizationInputType; desc: string }[] = [
  { label: 'Single Line Text', value: 'TEXT', desc: 'Names, short captions, greetings' },
  { label: 'Multi-line Text Area', value: 'TEXTAREA', desc: 'Personal messages, verses, long inscriptions' },
  { label: 'Numeric Value', value: 'NUMBER', desc: 'Table number, age, years, jersey number' },
  { label: 'Calendar Date', value: 'DATE', desc: 'Wedding date, birthday, anniversary date' },
  { label: 'Email Address', value: 'EMAIL', desc: 'Recipient notifications, e-vouchers' },
  { label: 'Phone Number', value: 'PHONE', desc: 'Contact numbers, SMS delivery alerts' },
  { label: 'Predefined Dropdown', value: 'SELECT', desc: 'Font style, theme accent, orientation choices' },
];

const PRESET_TEMPLATES: Array<{
  name: string;
  category: string;
  description: string;
  fields: Array<Omit<PersonalizationField, 'id' | 'templateId'>>;
}> = [
  {
    name: 'Wedding Keepsake Frame',
    category: 'Wedding & Keepsakes',
    description: 'Shared couple details, wedding date, venue, with personalized recipient names per frame',
    fields: [
      {
        name: 'Bride Name',
        code: 'bride_name',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: true,
        placeholder: 'e.g. Priya Sharma',
        helperText: 'Will appear on the top banner of all frames',
      },
      {
        name: 'Groom Name',
        code: 'groom_name',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: true,
        placeholder: 'e.g. Rahul Verma',
        helperText: 'Will appear on the top banner of all frames',
      },
      {
        name: 'Wedding Date',
        code: 'wedding_date',
        inputType: 'DATE',
        scope: 'PER_ORDER',
        isRequired: true,
        helperText: 'Commemoration date engraved or printed on the frame',
      },
      {
        name: 'Venue / City',
        code: 'venue_city',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: false,
        placeholder: 'e.g. Udaipur Palace',
      },
      {
        name: 'Guest / Recipient Name',
        code: 'recipient_name',
        inputType: 'TEXT',
        scope: 'PER_ITEM',
        isRequired: true,
        placeholder: 'e.g. Uncle David & Family',
        helperText: 'Unique name printed on each individual frame for every quantity ordered',
      },
      {
        name: 'Table / Seating Number',
        code: 'table_number',
        inputType: 'NUMBER',
        scope: 'PER_ITEM',
        isRequired: false,
        placeholder: 'e.g. 12',
      },
    ],
  },
  {
    name: 'Birthday & Milestone Keepsake',
    category: 'Birthday & Milestones',
    description: 'Celebrant details, milestone age, and custom gift notes per recipient',
    fields: [
      {
        name: 'Celebrant Name',
        code: 'celebrant_name',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: true,
        placeholder: 'e.g. Aryan Malhotra',
      },
      {
        name: 'Milestone / Turning Age',
        code: 'milestone_age',
        inputType: 'NUMBER',
        scope: 'PER_ORDER',
        isRequired: true,
        placeholder: 'e.g. 21',
      },
      {
        name: 'Celebration Date',
        code: 'celebration_date',
        inputType: 'DATE',
        scope: 'PER_ORDER',
        isRequired: false,
      },
      {
        name: 'Personal Inscription / Note',
        code: 'personal_note',
        inputType: 'TEXTAREA',
        scope: 'PER_ITEM',
        isRequired: true,
        placeholder: 'Custom memory or message for this specific piece',
        validationRules: { maxLength: 200 },
      },
    ],
  },
  {
    name: 'Corporate Memento & Plaque',
    category: 'Corporate & Awards',
    description: 'Company event branding with individual employee names, titles, and departments',
    fields: [
      {
        name: 'Event / Award Title',
        code: 'award_title',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: true,
        placeholder: 'e.g. Annual Excellence Awards 2026',
      },
      {
        name: 'Corporate Sponsor / Division',
        code: 'corporate_division',
        inputType: 'TEXT',
        scope: 'PER_ORDER',
        isRequired: false,
        placeholder: 'e.g. Engineering & Product Group',
      },
      {
        name: 'Awardee Full Name',
        code: 'awardee_name',
        inputType: 'TEXT',
        scope: 'PER_ITEM',
        isRequired: true,
        placeholder: 'e.g. Sneha Kulkarni',
      },
      {
        name: 'Designation / Department',
        code: 'designation',
        inputType: 'TEXT',
        scope: 'PER_ITEM',
        isRequired: true,
        placeholder: 'e.g. Lead Cloud Architect',
      },
    ],
  },
];

export default function PersonalizationTemplatesPage() {
  const [templates, setTemplates] = useState<PersonalizationTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'EDITOR' | 'PREVIEW_SIMULATOR'>('EDITOR');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formFields, setFormFields] = useState<PersonalizationField[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Field Edit Modal
  const [editingFieldIdx, setEditingFieldIdx] = useState<number | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [fName, setFName] = useState('');
  const [fCode, setFCode] = useState('');
  const [fInputType, setFInputType] = useState<PersonalizationInputType>('TEXT');
  const [fScope, setFScope] = useState<PersonalizationScope>('PER_ORDER');
  const [fIsRequired, setFIsRequired] = useState(true);
  const [fPlaceholder, setFPlaceholder] = useState('');
  const [fHelperText, setFHelperText] = useState('');
  const [fDefaultValue, setFDefaultValue] = useState('');
  const [fMinLength, setFMinLength] = useState<string>('');
  const [fMaxLength, setFMaxLength] = useState<string>('');
  const [fMinValue, setFMinValue] = useState<string>('');
  const [fMaxValue, setFMaxValue] = useState<string>('');
  const [fPattern, setFPattern] = useState<string>('');
  const [fOptionsRaw, setFOptionsRaw] = useState<string>('');

  // Simulator State
  const [simQty, setSimQty] = useState<number>(3);
  const [simShared, setSimShared] = useState<Record<string, string>>({});
  const [simPerItem, setSimPerItem] = useState<Array<Record<string, string>>>([{}, {}, {}]);
  const [simValidationErrors, setSimValidationErrors] = useState<string[]>([]);
  const [simBulkText, setSimBulkText] = useState('');
  const [isSimBulkOpen, setIsSimBulkOpen] = useState(false);

  // Deletion modal
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<PersonalizationTemplate | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async (selectId?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.adminListPersonalizationTemplates();
      setTemplates(data);

      if (data.length > 0) {
        const target = selectId ? data.find((t) => t.id === selectId) : data[0];
        if (target) {
          selectTemplate(target);
        } else {
          selectTemplate(data[0]);
        }
      } else {
        handleStartCreateNew();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to fetch personalization templates.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectTemplate = (tmpl: PersonalizationTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setIsCreatingNew(false);
    setFormName(tmpl.name);
    setFormCode(tmpl.code);
    setFormCategory(tmpl.category || '');
    setFormDescription(tmpl.description || '');
    setFormIsActive(tmpl.isActive);
    setFormFields(tmpl.fields || []);
    setErrorMsg(null);
    setSuccessMsg(null);
    resetSimulator(tmpl.fields || [], 3);
  };

  const handleStartCreateNew = () => {
    setSelectedTemplateId(null);
    setIsCreatingNew(true);
    setFormName('');
    setFormCode('');
    setFormCategory('General');
    setFormDescription('');
    setFormIsActive(true);
    setFormFields([]);
    setErrorMsg(null);
    setSuccessMsg(null);
    resetSimulator([], 3);
  };

  const handleApplyPreset = (preset: (typeof PRESET_TEMPLATES)[0]) => {
    setFormName(preset.name);
    setFormCode(preset.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
    setFormCategory(preset.category);
    setFormDescription(preset.description);
    setFormFields(
      preset.fields.map((f, idx) => ({
        ...f,
        sortOrder: idx,
      })),
    );
    resetSimulator(preset.fields as any, 3);
    setSuccessMsg(`Preset '${preset.name}' loaded successfully into editor!`);
  };

  const resetSimulator = (fields: PersonalizationField[], qty: number) => {
    setSimQty(qty);
    const shared: Record<string, string> = {};
    fields.filter((f) => f.scope === 'PER_ORDER').forEach((f) => {
      shared[f.code] = f.defaultValue || '';
    });
    setSimShared(shared);

    const items: Array<Record<string, string>> = [];
    for (let i = 0; i < qty; i++) {
      const row: Record<string, string> = {};
      fields.filter((f) => f.scope === 'PER_ITEM').forEach((f) => {
        row[f.code] = '';
      });
      items.push(row);
    }
    setSimPerItem(items);
    setSimValidationErrors([]);
  };

  // Change quantity in simulator
  const handleSimQtyChange = (newQty: number) => {
    const q = Math.max(1, Math.min(200, newQty));
    setSimQty(q);
    const perItemFields = formFields.filter((f) => f.scope === 'PER_ITEM');

    const nextItems: Array<Record<string, string>> = [];
    for (let i = 0; i < q; i++) {
      if (simPerItem[i]) {
        nextItems.push(simPerItem[i]);
      } else {
        const row: Record<string, string> = {};
        perItemFields.forEach((f) => {
          row[f.code] = '';
        });
        nextItems.push(row);
      }
    }
    setSimPerItem(nextItems);
  };

  // Simulator Bulk Paste
  const handleSimBulkApply = () => {
    const lines = simBulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const perItemFields = formFields.filter((f) => f.scope === 'PER_ITEM');
    if (perItemFields.length === 0) {
      alert('Template does not have any PER_ITEM fields to populate.');
      return;
    }

    if (lines.length === 0) {
      alert('Please enter at least one line of text or CSV.');
      return;
    }

    setSimQty(lines.length);
    const newItems: Array<Record<string, string>> = [];

    lines.forEach((line) => {
      // Split by comma or tab if multi-field
      const parts = line.includes('\t') ? line.split('\t') : line.split(',');
      const row: Record<string, string> = {};
      perItemFields.forEach((f, idx) => {
        row[f.code] = (parts[idx] || '').trim();
      });
      newItems.push(row);
    });

    setSimPerItem(newItems);
    setIsSimBulkOpen(false);
    setSimBulkText('');
  };

  // Run authoritative simulator validation
  const handleRunSimulatorValidation = () => {
    const errors: string[] = [];
    const sharedFields = formFields.filter((f) => f.scope === 'PER_ORDER');
    const perItemFields = formFields.filter((f) => f.scope === 'PER_ITEM');

    // 1. Shared
    sharedFields.forEach((f) => {
      const val = (simShared[f.code] || '').trim();
      if (f.isRequired && !val) {
        errors.push(`Shared field '${f.name}' is required.`);
      }
      if (val && f.validationRules?.minLength && val.length < f.validationRules.minLength) {
        errors.push(`'${f.name}' must be at least ${f.validationRules.minLength} characters.`);
      }
    });

    // 2. Per-Item
    if (perItemFields.length > 0) {
      if (simPerItem.length !== simQty) {
        errors.push(`Per-item entries count (${simPerItem.length}) must match product quantity (${simQty}).`);
      }
      simPerItem.forEach((item, idx) => {
        const itemNum = idx + 1;
        perItemFields.forEach((f) => {
          const val = (item[f.code] || '').trim();
          if (f.isRequired && !val) {
            errors.push(`Item #${itemNum}: '${f.name}' is required.`);
          }
        });
      });
    }

    setSimValidationErrors(errors);
  };

  // Field Edit Handlers
  const handleOpenAddField = () => {
    setEditingFieldIdx(null);
    setFName('');
    setFCode('');
    setFInputType('TEXT');
    setFScope('PER_ORDER');
    setFIsRequired(true);
    setFPlaceholder('');
    setFHelperText('');
    setFDefaultValue('');
    setFMinLength('');
    setFMaxLength('');
    setFMinValue('');
    setFMaxValue('');
    setFPattern('');
    setFOptionsRaw('');
    setIsFieldModalOpen(true);
  };

  const handleOpenEditField = (idx: number) => {
    const f = formFields[idx];
    setEditingFieldIdx(idx);
    setFName(f.name);
    setFCode(f.code);
    setFInputType(f.inputType);
    setFScope(f.scope);
    setFIsRequired(f.isRequired);
    setFPlaceholder(f.placeholder || '');
    setFHelperText(f.helperText || '');
    setFDefaultValue(f.defaultValue || '');
    setFMinLength(f.validationRules?.minLength ? String(f.validationRules.minLength) : '');
    setFMaxLength(f.validationRules?.maxLength ? String(f.validationRules.maxLength) : '');
    setFMinValue(f.validationRules?.minValue !== undefined ? String(f.validationRules.minValue) : '');
    setFMaxValue(f.validationRules?.maxValue !== undefined ? String(f.validationRules.maxValue) : '');
    setFPattern(f.validationRules?.pattern || '');
    setFOptionsRaw(
      f.options && f.options.length > 0
        ? f.options.map((o) => `${o.label}:${o.value}`).join('\n')
        : '',
    );
    setIsFieldModalOpen(true);
  };

  const handleSaveField = () => {
    if (!fName.trim()) {
      alert('Field Name is required');
      return;
    }
    const cleanCode = (fCode || fName)
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');

    let optionsParsed: Array<{ label: string; value: string }> | null = null;
    if (fInputType === 'SELECT' && fOptionsRaw.trim()) {
      optionsParsed = fOptionsRaw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
          if (line.includes(':')) {
            const [l, v] = line.split(':');
            return { label: l.trim(), value: v.trim() };
          }
          return { label: line, value: line };
        });
    }

    const fieldObj: PersonalizationField = {
      ...(editingFieldIdx !== null && formFields[editingFieldIdx]?.id
        ? { id: formFields[editingFieldIdx].id }
        : {}),
      name: fName.trim(),
      code: cleanCode,
      inputType: fInputType,
      scope: fScope,
      isRequired: fIsRequired,
      placeholder: fPlaceholder.trim() || null,
      helperText: fHelperText.trim() || null,
      defaultValue: fDefaultValue.trim() || null,
      validationRules: {
        ...(fMinLength ? { minLength: Number(fMinLength) } : {}),
        ...(fMaxLength ? { maxLength: Number(fMaxLength) } : {}),
        ...(fMinValue ? { minValue: Number(fMinValue) } : {}),
        ...(fMaxValue ? { maxValue: Number(fMaxValue) } : {}),
        ...(fPattern ? { pattern: fPattern } : {}),
      },
      options: optionsParsed,
      sortOrder: editingFieldIdx !== null ? editingFieldIdx : formFields.length,
    };

    if (editingFieldIdx !== null) {
      const next = [...formFields];
      next[editingFieldIdx] = fieldObj;
      setFormFields(next);
    } else {
      setFormFields([...formFields, fieldObj]);
    }

    setIsFieldModalOpen(false);
  };

  const handleDeleteField = (idx: number) => {
    setFormFields(formFields.filter((_, i) => i !== idx));
  };

  const handleMoveField = (idx: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && idx === 0) return;
    if (direction === 'DOWN' && idx === formFields.length - 1) return;
    const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
    const next = [...formFields];
    const temp = next[idx];
    next[idx] = next[targetIdx];
    next[targetIdx] = temp;
    setFormFields(next);
  };

  // Save Template
  const handleSaveTemplate = async () => {
    if (!formName.trim()) {
      setErrorMsg('Template name is required.');
      return;
    }
    if (formFields.length === 0) {
      setErrorMsg('Please add at least one personalization field to the template.');
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload = {
      name: formName.trim(),
      code: (formCode || formName)
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+|_+$/g, ''),
      category: formCategory.trim() || 'General',
      description: formDescription.trim() || null,
      isActive: formIsActive,
      fields: formFields.map((f, idx) => ({
        ...f,
        sortOrder: idx,
      })),
    };

    try {
      if (isCreatingNew || !selectedTemplateId) {
        const created = await api.adminCreatePersonalizationTemplate(payload);
        setSuccessMsg(`Template '${created.name}' created successfully!`);
        await loadTemplates(created.id);
      } else {
        const updated = await api.adminUpdatePersonalizationTemplate(selectedTemplateId, payload);
        setSuccessMsg(`Template '${updated.name}' updated successfully!`);
        await loadTemplates(updated.id);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save personalization template.');
    } finally {
      setIsSaving(false);
    }
  };

  // Duplicate Template
  const handleDuplicate = async (tmpl: PersonalizationTemplate) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const copy = await api.adminDuplicatePersonalizationTemplate(tmpl.id, `${tmpl.name} (Copy)`);
      setSuccessMsg(`Duplicated template '${copy.name}' successfully!`);
      await loadTemplates(copy.id);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to duplicate template.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete Template
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmTemplate) return;
    setIsLoading(true);
    try {
      await api.adminDeletePersonalizationTemplate(deleteConfirmTemplate.id);
      setSuccessMsg(`Template '${deleteConfirmTemplate.name}' deleted.`);
      setDeleteConfirmTemplate(null);
      await loadTemplates();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to delete template.');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.category || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && t.isActive) ||
        (statusFilter === 'INACTIVE' && !t.isActive);

      const matchesCategory =
        categoryFilter === 'ALL' || (t.category || '').toLowerCase() === categoryFilter.toLowerCase();

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [templates, searchQuery, statusFilter, categoryFilter]);

  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [templates]);

  return (
    <div className="min-h-screen bg-[#F8F8F8] text-black flex flex-col font-sans">
      {/* Top Header & Breadcrumbs */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <Link href="/admin/products" className="hover:text-black transition-colors">
                Catalogue
              </Link>
              <span>/</span>
              <span className="text-black">Personalization Templates</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#D4AF37] shadow-sm">
                <RiFileList3Line size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
                  Personalization Templates Library
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                    Universal Engine
                  </span>
                </h1>
                <p className="text-xs text-slate-600 mt-0.5">
                  Configure shared order fields (PER_ORDER) and repeated bulk item fields (PER_ITEM) with live validation
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleStartCreateNew()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-medium text-sm transition-all shadow-sm"
            >
              <RiAddLine size={18} />
              Create Template
            </button>
          </div>
        </div>
      </header>

      {/* Notifications */}
      {errorMsg && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 mt-4">
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <RiErrorWarningLine size={20} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="hover:text-red-950">
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 mt-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <RiCheckboxCircleLine size={20} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="hover:text-emerald-950">
              <RiCloseLine size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-12 gap-8 flex-1">
        {/* Left Column: Template List & Presets */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-5">
          {/* Filters card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col gap-3">
            <div className="relative">
              <RiSearch2Line className="absolute left-3.5 top-2.5 text-slate-400" size={17} />
              <input
                type="text"
                placeholder="Search templates or codes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 focus:outline-none text-sm text-slate-900 placeholder-slate-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Template List Cards */}
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col gap-2 max-h-[580px] overflow-y-auto">
            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 gap-2">
                <RiRefreshLine size={24} className="animate-spin text-[#D4AF37]" />
                <span className="text-xs">Loading templates...</span>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="py-12 px-4 text-center text-slate-500 flex flex-col items-center gap-2">
                <RiInformationLine size={28} />
                <p className="text-sm">No templates match filter</p>
                <button
                  onClick={() => handleStartCreateNew()}
                  className="mt-2 text-xs text-amber-700 font-semibold hover:underline"
                >
                  Create new template
                </button>
              </div>
            ) : (
              filteredTemplates.map((t) => {
                const isSelected = selectedTemplateId === t.id && !isCreatingNew;
                const sharedCount = (t.fields || []).filter((f) => f.scope === 'PER_ORDER').length;
                const perItemCount = (t.fields || []).filter((f) => f.scope === 'PER_ITEM').length;

                return (
                  <div
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 ${
                      isSelected
                        ? 'bg-amber-50/70 border-[#D4AF37] ring-1 ring-[#D4AF37]/40 shadow-sm'
                        : 'bg-slate-50/60 border-slate-200 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 truncate max-w-[200px]">
                        {t.name}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          t.isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}
                      >
                        {t.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-[11px] text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {t.code}
                      </span>
                      {t.category && (
                        <span className="text-[11px] text-slate-600 font-medium truncate">{t.category}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/80 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium border border-blue-100">
                          <RiCalendarEventLine size={13} />
                          {sharedCount} Shared
                        </span>
                        <span className="flex items-center gap-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium border border-purple-100">
                          <RiGroupLine size={13} />
                          {perItemCount} Per-Item
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          title="Duplicate template"
                          onClick={() => handleDuplicate(t)}
                          className="p-1 hover:text-slate-900 text-slate-400 transition-colors"
                        >
                          <RiFileCopyLine size={14} />
                        </button>
                        <button
                          title="Delete template"
                          onClick={() => setDeleteConfirmTemplate(t)}
                          className="p-1 hover:text-red-600 text-slate-400 transition-colors"
                        >
                          <RiDeleteBinLine size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Quick Presets Picker Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">
              <RiMagicLine size={15} className="text-[#D4AF37]" />
              Quick Starter Presets
            </div>
            <p className="text-xs text-slate-500 mb-3">
              One-click scaffold for popular industry occasion products
            </p>

            <div className="flex flex-col gap-2">
              {PRESET_TEMPLATES.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(p)}
                  className="flex items-start justify-between text-left p-2.5 rounded-lg bg-slate-50 hover:bg-amber-50/50 border border-slate-200 hover:border-amber-300 transition-all group"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-900 group-hover:text-amber-900">
                      {p.name}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-1">{p.description}</div>
                  </div>
                  <RiArrowRightLine
                    size={15}
                    className="text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all mt-0.5 shrink-0"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Template Editor & Live Simulator */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          {/* Tabs bar */}
          <div className="bg-white border border-slate-200 rounded-xl p-1.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('EDITOR')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'EDITOR'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <RiSettings4Line size={16} />
                Template Configuration
              </button>
              <button
                onClick={() => {
                  setActiveTab('PREVIEW_SIMULATOR');
                  handleRunSimulatorValidation();
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  activeTab === 'PREVIEW_SIMULATOR'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <RiEyeLine size={16} />
                Storefront & Bulk Paste Simulator
              </button>
            </div>

            <div className="flex items-center gap-3 pr-2">
              <button
                onClick={handleSaveTemplate}
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
              >
                {isSaving ? (
                  <RiRefreshLine size={16} className="animate-spin text-[#FFED00]" />
                ) : (
                  <RiCheckLine size={16} className="text-[#FFED00]" />
                )}
                {isCreatingNew ? 'Create Template' : 'Save Changes'}
              </button>
            </div>
          </div>

          {activeTab === 'EDITOR' ? (
            /* ============================================================ */
            /* TAB 1: TEMPLATE METADATA & FIELD BUILDER                     */
            /* ============================================================ */
            <div className="flex flex-col gap-6">
              {/* Template Header Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <RiFileTextLine className="text-[#D4AF37]" />
                    Template Information
                  </h2>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="rounded border-slate-300 text-black focus:ring-slate-400"
                      />
                      Active for Product Attachment
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Template Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Wedding Keepsake Frame"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (isCreatingNew) {
                          setFormCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
                        }
                      }}
                      className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 focus:border-slate-400 focus:outline-none text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Stable Code Identifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. wedding_keepsake_frame"
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 focus:border-slate-400 focus:outline-none text-sm font-mono text-slate-900 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Category</label>
                    <input
                      type="text"
                      placeholder="e.g. Frames, Mementos, Gifts"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 focus:border-slate-400 focus:outline-none text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Description & Production Guidelines
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Notes for production operators and product catalog managers..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-lg bg-white border border-slate-200 focus:border-slate-400 focus:outline-none text-sm text-slate-900 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Personalization Fields Card */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <RiInputMethodLine className="text-[#D4AF37]" />
                      Configured Personalization Fields ({formFields.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Mix and match shared order-level fields and quantity-based item fields
                    </p>
                  </div>

                  <button
                    onClick={handleOpenAddField}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold transition-all"
                  >
                    <RiAddLine size={16} />
                    Add Field
                  </button>
                </div>

                {/* Scope Legend Alert */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-slate-900 font-semibold">PER_ORDER (Shared):</strong> Entered once per
                      ordered line item (e.g. Bride/Groom Name, Wedding Date, Event Title).
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500 mt-1 shrink-0" />
                    <div>
                      <strong className="text-slate-900 font-semibold">PER_ITEM (Per-Item):</strong> Repeated
                      exactly according to quantity (e.g. 50 guest names for 50 frames).
                    </div>
                  </div>
                </div>

                {/* Fields Table */}
                {formFields.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-500 gap-2">
                    <RiFileList3Line size={32} className="text-slate-400" />
                    <p className="text-sm font-medium">No personalization fields configured yet.</p>
                    <button
                      onClick={handleOpenAddField}
                      className="text-xs text-amber-700 font-semibold hover:underline"
                    >
                      Click here to add your first field
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Order</th>
                          <th className="py-2.5 px-3">Field Name</th>
                          <th className="py-2.5 px-3">Code</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Scope</th>
                          <th className="py-2.5 px-3">Required</th>
                          <th className="py-2.5 px-3">Validation Rules</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {formFields.map((f, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleMoveField(idx, 'UP')}
                                  disabled={idx === 0}
                                  className="p-1 hover:text-slate-900 text-slate-400 disabled:opacity-20"
                                >
                                  <RiArrowUpLine size={13} />
                                </button>
                                <button
                                  onClick={() => handleMoveField(idx, 'DOWN')}
                                  disabled={idx === formFields.length - 1}
                                  className="p-1 hover:text-slate-900 text-slate-400 disabled:opacity-20"
                                >
                                  <RiArrowDownLine size={13} />
                                </button>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900">{f.name}</td>
                            <td className="py-3 px-3 font-mono text-slate-600">{f.code}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-mono border border-slate-200">
                                {f.inputType}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                  f.scope === 'PER_ORDER'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-purple-50 text-purple-700 border-purple-200'
                                }`}
                              >
                                {f.scope}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              {f.isRequired ? (
                                <span className="text-red-600 font-semibold">Yes</span>
                              ) : (
                                <span className="text-slate-500">Optional</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-slate-500 text-[11px]">
                              {f.validationRules ? (
                                <div className="flex flex-wrap gap-1">
                                  {f.validationRules.minLength && (
                                    <span className="bg-slate-100 border border-slate-200 px-1 rounded">
                                      min: {f.validationRules.minLength}
                                    </span>
                                  )}
                                  {f.validationRules.maxLength && (
                                    <span className="bg-slate-100 border border-slate-200 px-1 rounded">
                                      max: {f.validationRules.maxLength}
                                    </span>
                                  )}
                                  {f.validationRules.pattern && (
                                    <span className="bg-slate-100 border border-slate-200 px-1 rounded">regex</span>
                                  )}
                                </div>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleOpenEditField(idx)}
                                  className="p-1 hover:text-slate-900 text-slate-400 transition-colors"
                                  title="Edit Field"
                                >
                                  <RiEditLine size={15} />
                                </button>
                                <button
                                  onClick={() => handleDeleteField(idx)}
                                  className="p-1 hover:text-red-600 text-slate-400 transition-colors"
                                  title="Remove Field"
                                >
                                  <RiDeleteBinLine size={15} />
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
            </div>
          ) : (
            /* ============================================================ */
            /* TAB 2: LIVE SIMULATOR & BULK IMPORT VALIDATION               */
            /* ============================================================ */
            <div className="flex flex-col gap-6">
              {/* Simulator Controls */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <RiEyeLine className="text-[#D4AF37]" />
                      Live Customer Input Simulator
                    </h2>
                    <p className="text-xs text-slate-500">
                      Simulate the customer configurator and test bulk paste with row count checks
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs text-slate-600 font-semibold">Order Quantity:</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={simQty}
                      onChange={(e) => handleSimQtyChange(Number(e.target.value))}
                      className="w-20 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center font-bold text-slate-900 text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => setIsSimBulkOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-semibold transition-all"
                    >
                      <RiUpload2Line size={15} />
                      Bulk Paste / CSV
                    </button>
                    <button
                      onClick={handleRunSimulatorValidation}
                      className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-all shadow-sm"
                    >
                      <RiCheckLine size={15} className="text-[#FFED00]" />
                      Validate Inputs
                    </button>
                  </div>
                </div>

                {/* Validation Status */}
                {simValidationErrors.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                    <RiCheckboxCircleLine size={18} className="text-emerald-600" />
                    <span className="font-medium">All personalization inputs are valid and ready for checkout!</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex flex-col gap-1">
                    <div className="font-semibold flex items-center gap-1.5">
                      <RiErrorWarningLine size={16} className="text-red-600" />
                      Validation Errors ({simValidationErrors.length}):
                    </div>
                    <ul className="list-disc pl-5 space-y-0.5">
                      {simValidationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Shared Fields Section */}
              {formFields.filter((f) => f.scope === 'PER_ORDER').length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <RiCalendarEventLine className="text-blue-600" />
                    Shared Order Details (PER_ORDER) — Entered Once
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formFields
                      .filter((f) => f.scope === 'PER_ORDER')
                      .map((f) => (
                        <div key={f.code}>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            {f.name} {f.isRequired && <span className="text-red-500">*</span>}
                          </label>
                          {f.inputType === 'TEXTAREA' ? (
                            <textarea
                              rows={2}
                              placeholder={f.placeholder || ''}
                              value={simShared[f.code] || ''}
                              onChange={(e) =>
                                setSimShared({ ...simShared, [f.code]: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                            />
                          ) : (
                            <input
                              type={
                                f.inputType === 'NUMBER'
                                  ? 'number'
                                  : f.inputType === 'DATE'
                                  ? 'date'
                                  : 'text'
                              }
                              placeholder={f.placeholder || ''}
                              value={simShared[f.code] || ''}
                              onChange={(e) =>
                                setSimShared({ ...simShared, [f.code]: e.target.value })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                            />
                          )}
                          {f.helperText && (
                            <p className="text-[11px] text-slate-500 mt-1">{f.helperText}</p>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Per-Item Fields Section */}
              {formFields.filter((f) => f.scope === 'PER_ITEM').length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <RiGroupLine className="text-purple-600" />
                      Per-Item Personalization (PER_ITEM) — {simQty} items
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                      Row count must match quantity {simQty} exactly
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase">
                          <th className="py-2.5 px-3 w-16">Item #</th>
                          {formFields
                            .filter((f) => f.scope === 'PER_ITEM')
                            .map((f) => (
                              <th key={f.code} className="py-2.5 px-3">
                                {f.name} {f.isRequired && <span className="text-red-500">*</span>}
                              </th>
                            ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {simPerItem.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-500">
                              #{idx + 1}
                            </td>
                            {formFields
                              .filter((f) => f.scope === 'PER_ITEM')
                              .map((f) => (
                                <td key={f.code} className="py-2 px-3">
                                  <input
                                    type={f.inputType === 'NUMBER' ? 'number' : 'text'}
                                    placeholder={f.placeholder || `Enter ${f.name}`}
                                    value={row[f.code] || ''}
                                    onChange={(e) => {
                                      const next = [...simPerItem];
                                      next[idx] = { ...next[idx], [f.code]: e.target.value };
                                      setSimPerItem(next);
                                    }}
                                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
                                  />
                                </td>
                              ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FIELD EDIT MODAL */}
      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-xl shadow-2xl flex flex-col gap-5 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RiInputMethodLine className="text-[#D4AF37]" />
                {editingFieldIdx !== null ? 'Edit Field' : 'Add Personalization Field'}
              </h3>
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine size={20} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Label <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Recipient Name"
                  value={fName}
                  onChange={(e) => {
                    setFName(e.target.value);
                    if (editingFieldIdx === null) {
                      setFCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'));
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Stable Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. recipient_name"
                  value={fCode}
                  onChange={(e) => setFCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Input Type</label>
                <select
                  value={fInputType}
                  onChange={(e: any) => setFInputType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                >
                  {INPUT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Scope & Application <span className="text-red-500">*</span>
                </label>
                <select
                  value={fScope}
                  onChange={(e: any) => setFScope(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:border-slate-400 focus:outline-none"
                >
                  <option value="PER_ORDER">PER_ORDER (Shared value for whole item)</option>
                  <option value="PER_ITEM">PER_ITEM (Repeated for every quantity count)</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fIsRequired}
                    onChange={(e) => setFIsRequired(e.target.checked)}
                    className="rounded border-slate-300 text-black focus:ring-slate-400"
                  />
                  Mandatory Field (Customer must provide this value)
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Placeholder</label>
                <input
                  type="text"
                  placeholder="e.g. Enter name..."
                  value={fPlaceholder}
                  onChange={(e) => setFPlaceholder(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Helper Text</label>
                <input
                  type="text"
                  placeholder="e.g. Max 30 chars, English only"
                  value={fHelperText}
                  onChange={(e) => setFHelperText(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 focus:border-slate-400 focus:outline-none"
                />
              </div>

              {/* Validation Rules Section */}
              <div className="md:col-span-2 pt-2 border-t border-slate-200 flex flex-col gap-2">
                <span className="text-xs font-semibold text-slate-700">Validation Rules</span>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Min Length</label>
                    <input
                      type="number"
                      value={fMinLength}
                      onChange={(e) => setFMinLength(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Max Length</label>
                    <input
                      type="number"
                      value={fMaxLength}
                      onChange={(e) => setFMaxLength(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Min Value</label>
                    <input
                      type="number"
                      value={fMinValue}
                      onChange={(e) => setFMinValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">Max Value</label>
                    <input
                      type="number"
                      value={fMaxValue}
                      onChange={(e) => setFMaxValue(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900"
                    />
                  </div>
                </div>
              </div>

              {fInputType === 'SELECT' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Dropdown Options (One per line, or Label:Value)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={`Gold Foil:gold\nSilver Foil:silver\nRose Gold:rose_gold`}
                    value={fOptionsRaw}
                    onChange={(e) => setFOptionsRaw(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-mono text-slate-900 focus:border-slate-400 focus:outline-none"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                onClick={() => setIsFieldModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                className="px-5 py-2 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm transition-all"
              >
                {editingFieldIdx !== null ? 'Update Field' : 'Add to Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK PASTE MODAL FOR SIMULATOR */}
      {isSimBulkOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-4 text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RiUpload2Line className="text-[#D4AF37]" />
                Bulk Paste / CSV Roster
              </h3>
              <button
                onClick={() => setIsSimBulkOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine size={20} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Paste names from Excel or CSV. Each line represents one item.
            </p>

            <textarea
              rows={8}
              placeholder={`Uncle David & Family\nAunt Sarah\nGrandpa Arthur\nCousin Michael`}
              value={simBulkText}
              onChange={(e) => setSimBulkText(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 font-mono text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:border-slate-400 focus:outline-none"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500 font-medium">
                {simBulkText.split('\n').filter((l) => l.trim()).length} lines detected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSimBulkOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimBulkApply}
                  className="px-4 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-semibold shadow-sm"
                >
                  Apply to Roster
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmTemplate && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4 text-slate-900">
            <h3 className="text-base font-bold text-red-600 flex items-center gap-2">
              <RiDeleteBinLine className="text-red-600" />
              Confirm Template Deletion
            </h3>
            <p className="text-xs text-slate-600">
              Are you sure you want to delete template{' '}
              <strong className="text-slate-900">'{deleteConfirmTemplate.name}'</strong>? Products
              attached to this template will no longer prompt for these fields.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteConfirmTemplate(null)}
                className="px-4 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-sm"
              >
                Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
