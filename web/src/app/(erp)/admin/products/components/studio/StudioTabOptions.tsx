'use client';

import React, { useState, useMemo } from 'react';
import {
  RiAddLine,
  RiSearch2Line,
  RiDeleteBin7Line,
  RiArrowUpLine,
  RiArrowDownLine,
  RiBookOpenLine,
  RiFileTextLine,
  RiCheckLine,
  RiCloseLine,
  RiShieldCheckLine,
  RiSettings4Line,
  RiRefreshLine,
  RiInformationLine,
  RiArrowRightLine,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiArrowDropDownLine,
  RiArrowDropUpLine,
  RiSparklingFill,
} from 'react-icons/ri';
import { ProductOptionGroup, ProductOption, ReusableOptionGroup, api } from '@/lib/api';
import { Modal } from '@/components/ui';
import { MatrixRowItem } from './StudioTabPricing';
import { StudioTab } from './StudioTabReview';

export interface StudioTabOptionsProps {
  productId?: string;
  optionGroups: ProductOptionGroup[];
  setOptionGroups: React.Dispatch<React.SetStateAction<ProductOptionGroup[]>>;
  matrixRows?: MatrixRowItem[];
  setMatrixRows?: React.Dispatch<React.SetStateAction<MatrixRowItem[]>>;
  basePrice?: number | string;
  minQuantity?: number;
  pricingModel?: string;
  rules?: any[];
  defaultSize?: string;
  onChange?: () => void;
  onNavigateToTab?: (tab: StudioTab) => void;
}

export function StudioTabOptions({
  productId,
  optionGroups,
  setOptionGroups,
  matrixRows,
  setMatrixRows,
  basePrice,
  minQuantity,
  pricingModel,
  rules,
  defaultSize,
  onChange,
  onNavigateToTab,
}: StudioTabOptionsProps) {
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number>(0);
  const [searchFilter, setSearchFilter] = useState('');
  const [choiceFilter, setChoiceFilter] = useState<'ALL' | 'ACTIVE' | 'EXCLUDED'>('ALL');

  // Library Modal State
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [libraryGroups, setLibraryGroups] = useState<ReusableOptionGroup[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<string[]>([]);
  const [selectedLibraryOptionValues, setSelectedLibraryOptionValues] = useState<Record<string, string[]>>({});
  const [expandedLibraryIds, setExpandedLibraryIds] = useState<string[]>([]);

  // Bulk Values Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkInputText, setBulkInputText] = useState('');

  // Filtered attached groups
  const filteredGroups = useMemo(() => {
    return optionGroups.filter((g) => {
      if (!searchFilter.trim()) return true;
      const q = searchFilter.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
    });
  }, [optionGroups, searchFilter]);

  const activeGroup = optionGroups[selectedGroupIndex] || null;

  // Active choices in active group
  const activeChoicesInActiveGroup = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.options.filter((o) => o.isActive !== false);
  }, [activeGroup]);

  const isAllActiveInGroup = Boolean(
    activeGroup &&
      activeGroup.options.length > 0 &&
      activeChoicesInActiveGroup.length === activeGroup.options.length
  );

  const isSomeActiveInGroup = Boolean(
    activeGroup &&
      activeChoicesInActiveGroup.length > 0 &&
      activeChoicesInActiveGroup.length < activeGroup.options.length
  );

  // Total active choices across all groups
  const totalActiveChoices = useMemo(() => {
    return optionGroups.reduce(
      (sum, g) => sum + g.options.filter((o) => o.isActive !== false).length,
      0
    );
  }, [optionGroups]);

  // Open library modal and load groups
  const handleOpenLibraryModal = async () => {
    setIsLibraryModalOpen(true);
    setIsLoadingLibrary(true);
    setSelectedLibraryIds([]);
    setSelectedLibraryOptionValues({});
    setExpandedLibraryIds([]);
    try {
      const data = await api.adminListReusableGroups();
      setLibraryGroups(data || []);
      // Pre-select all choices by default for all groups
      const initialMap: Record<string, string[]> = {};
      for (const g of data || []) {
        const opts = Array.isArray(g.defaultOptions) ? g.defaultOptions : [];
        initialMap[g.id] = opts.map((o: any) => o.value);
      }
      setSelectedLibraryOptionValues(initialMap);
    } catch (err: any) {
      alert(err?.message || 'Failed to fetch option group library');
    } finally {
      setIsLoadingLibrary(false);
    }
  };

  // Toggle group selection in library modal
  const handleToggleLibrarySelection = (id: string) => {
    setSelectedLibraryIds((prev) => {
      const willSelect = !prev.includes(id);
      if (willSelect) {
        // Ensure its options are selected by default if not yet populated
        const libGroup = libraryGroups.find((g) => g.id === id);
        if (libGroup && !selectedLibraryOptionValues[id]) {
          const opts = Array.isArray(libGroup.defaultOptions) ? libGroup.defaultOptions : [];
          setSelectedLibraryOptionValues((sPrev) => ({
            ...sPrev,
            [id]: opts.map((o: any) => o.value),
          }));
        }
        return [...prev, id];
      } else {
        return prev.filter((item) => item !== id);
      }
    });
  };

  // Toggle choice selection inside a library group
  const handleToggleLibraryOption = (groupId: string, val: string) => {
    setSelectedLibraryOptionValues((prev) => {
      const current = prev[groupId] || [];
      const updated = current.includes(val)
        ? current.filter((v) => v !== val)
        : [...current, val];

      if (updated.length > 0 && !selectedLibraryIds.includes(groupId)) {
        setSelectedLibraryIds((sPrev) => [...sPrev, groupId]);
      }
      if (updated.length === 0) {
        setSelectedLibraryIds((sPrev) => sPrev.filter((id) => id !== groupId));
      }

      return {
        ...prev,
        [groupId]: updated,
      };
    });
  };

  const handleSelectAllOptionsInLibraryGroup = (groupId: string) => {
    const libGroup = libraryGroups.find((g) => g.id === groupId);
    if (!libGroup) return;
    const opts = Array.isArray(libGroup.defaultOptions) ? libGroup.defaultOptions : [];
    setSelectedLibraryOptionValues((prev) => ({
      ...prev,
      [groupId]: opts.map((o: any) => o.value),
    }));
    if (!selectedLibraryIds.includes(groupId)) {
      setSelectedLibraryIds((prev) => [...prev, groupId]);
    }
  };

  const handleDeselectAllOptionsInLibraryGroup = (groupId: string) => {
    setSelectedLibraryOptionValues((prev) => ({
      ...prev,
      [groupId]: [],
    }));
    setSelectedLibraryIds((prev) => prev.filter((id) => id !== groupId));
  };

  const handleToggleExpandLibraryGroup = (groupId: string) => {
    setExpandedLibraryIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  // Attach selected library groups (cloned independently, only with selected choices for this product)
  const handleAttachSelectedLibraryGroups = () => {
    const toAttach = libraryGroups.filter((g) => selectedLibraryIds.includes(g.id));
    if (toAttach.length === 0) return;

    const newGroups: ProductOptionGroup[] = toAttach.map((lib, idx) => {
      const allDefaultOpts: any[] = Array.isArray(lib.defaultOptions) ? lib.defaultOptions : [];
      const chosenVals =
        selectedLibraryOptionValues[lib.id] || allDefaultOpts.map((o) => o.value);

      // Filter default options to only the chosen ones for this product
      const filteredOpts = allDefaultOpts.filter((opt: any) =>
        chosenVals.includes(opt.value)
      );
      const finalOpts = filteredOpts.length > 0 ? filteredOpts : allDefaultOpts;

      return {
        id: `group-lib-${Date.now()}-${idx}`,
        productId: '',
        reusableGroupId: lib.id,
        name: lib.name,
        code: lib.code,
        inputType: lib.inputType || 'SELECT',
        description: lib.description || '',
        isRequired: true,
        isCustomerVisible: true,
        enableAdditionalPricing: Boolean(lib.enableAdditionalPricing),
        sortOrder: optionGroups.length + idx,
        isActive: true,
        options: finalOpts.map((opt: any, oIdx: number) => ({
          id: `opt-lib-${Date.now()}-${idx}-${oIdx}`,
          groupId: '',
          label: opt.label || '',
          value: opt.value || '',
          priceModifierType: 'FIXED',
          priceModifier: opt.priceModifier || 0,
          sortOrder: oIdx,
          isDefault: Boolean(opt.isDefault) || oIdx === 0,
          isActive: true,
          fileCount: opt.fileCount || 0,
          fileSlotLabels: [],
        })),
      };
    });

    setOptionGroups((prev) => [...prev, ...newGroups]);
    setSelectedGroupIndex(optionGroups.length);
    setIsLibraryModalOpen(false);
    onChange?.();
  };

  // Create custom group for this product
  const handleCreateCustomGroup = () => {
    const newIdx = optionGroups.length + 1;
    const newGroup: ProductOptionGroup = {
      id: `group-custom-${Date.now()}`,
      productId: '',
      reusableGroupId: null,
      name: `Custom Option Group ${newIdx}`,
      code: `custom_option_${newIdx}`,
      inputType: 'SELECT',
      description: '',
      isRequired: true,
      isCustomerVisible: true,
      enableAdditionalPricing: false,
      sortOrder: optionGroups.length,
      isActive: true,
      options: [
        {
          id: `opt-${Date.now()}-1`,
          groupId: '',
          label: 'Default Choice',
          value: 'default_choice',
          priceModifierType: 'FIXED',
          priceModifier: 0,
          sortOrder: 0,
          isDefault: true,
          isActive: true,
          fileCount: 0,
          fileSlotLabels: [],
        },
      ],
    };

    setOptionGroups((prev) => [...prev, newGroup]);
    setSelectedGroupIndex(optionGroups.length);
    onChange?.();
  };

  // Reorder groups
  const handleMoveGroup = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === optionGroups.length - 1) return;
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;

    setOptionGroups((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy.map((g, idx) => ({ ...g, sortOrder: idx }));
    });
    setSelectedGroupIndex(targetIdx);
    onChange?.();
  };

  // Remove group from product (does NOT delete reusable library)
  const handleRemoveGroup = (index: number) => {
    const target = optionGroups[index];
    if (!target) return;
    if (
      !confirm(
        `Remove option group "${target.name}" from this product? (The shared library template will NOT be deleted)`
      )
    ) {
      return;
    }

    setOptionGroups((prev) => {
      const copy = prev.filter((_, idx) => idx !== index);
      return copy.map((g, idx) => ({ ...g, sortOrder: idx }));
    });
    setSelectedGroupIndex(Math.max(0, index - 1));
    onChange?.();
  };

  // Active group field updaters
  const updateActiveGroup = (patch: Partial<ProductOptionGroup>) => {
    if (selectedGroupIndex < 0 || selectedGroupIndex >= optionGroups.length) return;
    setOptionGroups((prev) => {
      const copy = [...prev];
      copy[selectedGroupIndex] = { ...copy[selectedGroupIndex], ...patch };
      return copy;
    });
    onChange?.();
  };

  // Add individual option choice
  const handleAddOption = () => {
    if (!activeGroup) return;
    const newIdx = activeGroup.options.length + 1;
    const newOpt: ProductOption = {
      id: `opt-${Date.now()}-${newIdx}`,
      groupId: activeGroup.id,
      label: `Option ${newIdx}`,
      value: `option_${newIdx}`,
      priceModifierType: 'FIXED',
      priceModifier: 0,
      sortOrder: activeGroup.options.length,
      isDefault: activeGroup.options.filter((o) => o.isActive !== false).length === 0,
      isActive: true,
      fileCount: 0,
      fileSlotLabels: [],
    };

    updateActiveGroup({
      options: [...activeGroup.options, newOpt],
    });
  };

  // Update single option choice
  const updateOption = (optIdx: number, patch: Partial<ProductOption>) => {
    if (!activeGroup) return;
    const updatedOptions = [...activeGroup.options];
    updatedOptions[optIdx] = { ...updatedOptions[optIdx], ...patch };

    // If deselecting / inactivating an option that was default, shift default to another active choice
    if (patch.isActive === false) {
      if (updatedOptions[optIdx].isDefault) {
        updatedOptions[optIdx].isDefault = false;
        const firstActive = updatedOptions.find((o, i) => i !== optIdx && o.isActive !== false);
        if (firstActive) {
          firstActive.isDefault = true;
        }
      }
    }

    // If making this one default, ensure it is also active
    if (patch.isDefault) {
      updatedOptions[optIdx].isActive = true;
      updatedOptions.forEach((o, i) => {
        if (i !== optIdx) o.isDefault = false;
      });
    }

    updateActiveGroup({ options: updatedOptions });
  };

  // Select all choices in active group
  const handleSelectAllChoicesInActiveGroup = () => {
    if (!activeGroup) return;
    const updated = activeGroup.options.map((opt, i) => ({
      ...opt,
      isActive: true,
      isDefault: activeGroup.options.some((o) => o.isDefault && o.isActive !== false)
        ? opt.isDefault
        : i === 0,
    }));
    updateActiveGroup({ options: updated });
  };

  // Deselect all choices in active group
  const handleDeselectAllChoicesInActiveGroup = () => {
    if (!activeGroup) return;
    const updated = activeGroup.options.map((opt) => ({
      ...opt,
      isActive: false,
      isDefault: false,
    }));
    updateActiveGroup({ options: updated });
  };

  // Delete option choice
  const handleDeleteOption = (optIdx: number) => {
    if (!activeGroup) return;
    const targetOpt = activeGroup.options[optIdx];
    if (!confirm(`Delete choice "${targetOpt?.label || 'Choice'}" from this product?`)) {
      return;
    }
    const updated = activeGroup.options.filter((_, i) => i !== optIdx);
    if (updated.length > 0 && !updated.some((o) => o.isDefault && o.isActive !== false)) {
      const firstActive = updated.find((o) => o.isActive !== false);
      if (firstActive) firstActive.isDefault = true;
      else if (updated[0]) updated[0].isDefault = true;
    }
    updateActiveGroup({ options: updated });
  };

  // Remove all unselected choices permanently from active group
  const handleRemoveUnselectedChoices = () => {
    if (!activeGroup) return;
    const unselectedCount = activeGroup.options.filter((o) => o.isActive === false).length;
    if (unselectedCount === 0) return;
    if (
      !confirm(
        `Remove ${unselectedCount} unselected choice(s) permanently from "${activeGroup.name}" for this product?`
      )
    ) {
      return;
    }
    const updated = activeGroup.options.filter((o) => o.isActive !== false);
    if (updated.length > 0 && !updated.some((o) => o.isDefault)) {
      updated[0].isDefault = true;
    }
    updateActiveGroup({ options: updated });
  };

  // Reorder option choices
  const handleMoveOption = (optIdx: number, direction: 'UP' | 'DOWN') => {
    if (!activeGroup) return;
    if (direction === 'UP' && optIdx === 0) return;
    if (direction === 'DOWN' && optIdx === activeGroup.options.length - 1) return;
    const targetIdx = direction === 'UP' ? optIdx - 1 : optIdx + 1;

    const copy = [...activeGroup.options];
    const temp = copy[optIdx];
    copy[optIdx] = copy[targetIdx];
    copy[targetIdx] = temp;

    updateActiveGroup({
      options: copy.map((o, i) => ({ ...o, sortOrder: i })),
    });
  };

  // Bulk Ingest
  const handleBulkAddValues = () => {
    if (!activeGroup || !bulkInputText.trim()) return;

    const lines = bulkInputText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: ProductOption[] = lines.map((line, idx) => {
      const parts = line.split(',').map((p) => p.trim());
      const label = parts[0] || `Choice ${idx + 1}`;
      const val = parts[1]
        ? parts[1].toLowerCase().replace(/[^a-z0-9_]+/g, '_')
        : label.toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const mod = parts[2] ? parseFloat(parts[2]) || 0 : 0;

      return {
        id: `opt-bulk-${Date.now()}-${idx}`,
        groupId: activeGroup.id,
        label,
        value: val,
        priceModifierType: 'FIXED',
        priceModifier: mod,
        sortOrder: activeGroup.options.length + idx,
        isDefault: activeGroup.options.length === 0 && idx === 0,
        isActive: true,
        fileCount: 0,
        fileSlotLabels: [],
      };
    });

    updateActiveGroup({
      options: [...activeGroup.options, ...parsed],
    });

    setBulkInputText('');
    setIsBulkModalOpen(false);
  };

  // Sync active group from master reusable library
  const handleSyncActiveGroupFromLibrary = () => {
    if (!activeGroup) return;
    const matchingLib = libraryGroups.find(
      (g) => g.id === activeGroup.reusableGroupId || g.code === activeGroup.code
    );
    if (!matchingLib) {
      alert(`Master reusable group for "${activeGroup.name}" not found in /admin/option-groups library.`);
      return;
    }

    const defaultOpts: any[] = Array.isArray(matchingLib.defaultOptions)
      ? matchingLib.defaultOptions
      : [];
    const existingOptsMap = new Map(activeGroup.options.map((o) => [o.value, o]));

    const syncedOptions: ProductOption[] = defaultOpts.map((opt: any, oIdx: number) => {
      const existing = existingOptsMap.get(opt.value);
      return {
        id: existing?.id || `opt-lib-${Date.now()}-${oIdx}`,
        groupId: activeGroup.id,
        label: opt.label || existing?.label || opt.value,
        value: opt.value,
        priceModifierType: existing?.priceModifierType || 'FIXED',
        priceModifier: existing?.priceModifier || 0,
        sortOrder: opt.sortOrder !== undefined ? opt.sortOrder : oIdx,
        isDefault: opt.isDefault !== undefined ? opt.isDefault : (existing?.isDefault ?? oIdx === 0),
        isActive: opt.isActive !== undefined ? opt.isActive : (existing?.isActive ?? true),
        fileCount: existing?.fileCount || 0,
        fileSlotLabels: existing?.fileSlotLabels || [],
        minMegapixels: existing?.minMegapixels || null,
      };
    });

    updateActiveGroup({
      reusableGroupId: matchingLib.id,
      name: matchingLib.name,
      code: matchingLib.code,
      inputType: matchingLib.inputType || 'SELECT',
      description: matchingLib.description || '',
      enableAdditionalPricing: Boolean(matchingLib.enableAdditionalPricing),
      options: syncedOptions,
    });
    alert(`Option group "${activeGroup.name}" successfully synchronized with latest /admin/option-groups library!`);
  };

  // Estimated combinations calculation: only counts active choices!
  const estimatedCartesianCombos = useMemo(() => {
    const active = optionGroups.filter((g) => g.isActive && g.options.length > 0);
    if (active.length === 0) return 0;
    return active.reduce(
      (acc, g) => acc * Math.max(1, g.options.filter((o) => o.isActive !== false).length),
      1
    );
  }, [optionGroups]);

  // Proceed to next stage validation & navigation
  const handleProceedToNextStage = () => {
    if (optionGroups.length === 0) {
      alert('Please configure at least one option group for this printing product.');
      return;
    }

    // Validate that each group has at least one active choice selected
    for (let i = 0; i < optionGroups.length; i++) {
      const g = optionGroups[i];
      const activeChoices = g.options.filter((o) => o.isActive !== false);
      if (activeChoices.length === 0) {
        alert(
          `Cannot proceed to next stage: Option group "${g.name}" has no choices selected for this product. Please select at least one choice to include, or remove the group.`
        );
        setSelectedGroupIndex(i);
        return;
      }

      // Ensure required groups have a default choice among active choices
      if (g.isRequired && !activeChoices.some((o) => o.isDefault)) {
        setOptionGroups((prev) => {
          const copy = [...prev];
          const grpCopy = { ...copy[i] };
          grpCopy.options = grpCopy.options.map((o) => ({
            ...o,
            isDefault: o.value === activeChoices[0].value,
          }));
          copy[i] = grpCopy;
          return copy;
        });
      }
    }

    if (onNavigateToTab) {
      onNavigateToTab('ARTWORK_CONDITIONS');
    }
  };

  // Filter choices for the active group's table
  const displayedChoices = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.options
      .map((opt, optIdx) => ({ opt, optIdx }))
      .filter(({ opt }) => {
        const isAct = opt.isActive !== false;
        if (choiceFilter === 'ACTIVE') return isAct;
        if (choiceFilter === 'EXCLUDED') return !isAct;
        return true;
      });
  }, [activeGroup, choiceFilter]);

  return (
    <div className="w-full space-y-5">
      {/* Step 2 Guidance Banner */}
      <div className="p-3.5 bg-amber-50/70 border border-amber-200/90 rounded-xl text-amber-950 text-xs flex items-start gap-3 shadow-2xs">
        <RiInformationLine className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold block text-xs">
            Step 2 — Groups & Combinations Architecture
          </span>
          <p className="text-[11px] text-amber-900 leading-relaxed">
            Attach shared printing attributes (Material, Size, Finish) from the library or create custom groups.
            <strong> Select which choices belong to this specific product.</strong> Only the selected choices will move forward to Artwork Conditions, Pricing, and Storefront.
          </p>
        </div>
      </div>

      {/* Top Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 flex-wrap">
            <span>Product Option Groups & Choices</span>
            <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-mono font-semibold">
              {optionGroups.length} Groups
            </span>
            <span className="text-xs bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded-full font-mono font-semibold">
              {totalActiveChoices} Selected Choices
            </span>
            {estimatedCartesianCombos > 0 && (
              <span className="text-xs bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 rounded-full font-mono">
                ~{estimatedCartesianCombos.toLocaleString()} Possible Combinations
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Select choices per option group. Only choices marked &quot;Selected&quot; move on to pricing and artwork conditions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleOpenLibraryModal}
            className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold text-xs px-3.5 py-2 rounded-lg border border-amber-200 shadow-2xs transition active:scale-95 cursor-pointer"
          >
            <RiBookOpenLine className="w-4 h-4 text-amber-700" />
            <span>Add Existing Groups</span>
          </button>

          <button
            type="button"
            onClick={handleCreateCustomGroup}
            className="flex items-center gap-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-[#0F172A] font-bold text-xs px-3.5 py-2 rounded-lg border border-[#E3A008]/40 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <RiAddLine className="w-4 h-4" />
            <span>Create Custom Group</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Pane Studio Layout */}
      {optionGroups.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center space-y-3">
          <RiSettings4Line className="w-10 h-10 text-slate-300 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Option Groups Configured Yet</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Click &quot;Add Existing Groups&quot; to import standard templates like Paper Stock, Size, and Finish from your central library, or create custom groups.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenLibraryModal}
              className="inline-flex items-center gap-1.5 bg-[#FFED00] text-black font-bold text-xs px-4 py-2 rounded-lg shadow-xs"
            >
              <RiBookOpenLine className="w-4 h-4" /> Browse Reusable Library
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Group Selector (4 cols) */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="relative">
                <RiSearch2Line className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter groups..."
                  className="w-full h-7 pl-8 pr-2 text-xs bg-white border border-slate-300 rounded-md text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredGroups.map((group) => {
                const actualIdx = optionGroups.findIndex((g) => g.id === group.id);
                const isSelected = actualIdx === selectedGroupIndex;
                const activeCount = group.options.filter((o) => o.isActive !== false).length;

                return (
                  <div
                    key={group.id}
                    onClick={() => setSelectedGroupIndex(actualIdx)}
                    className={`p-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-amber-50/80 border-l-4 border-amber-500'
                        : 'hover:bg-slate-50/70 border-l-4 border-transparent'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-slate-900 truncate">{group.name}</span>
                        {group.reusableGroupId && (
                          <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                            Library
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 truncate">/{group.code}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold font-mono text-[9px] border ${
                            activeCount === 0
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : activeCount < group.options.length
                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {activeCount}/{group.options.length} Selected
                        </span>
                        <span>•</span>
                        <span>{group.inputType}</span>
                        {group.enableAdditionalPricing && (
                          <>
                            <span>•</span>
                            <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded font-sans">
                              +Pricing
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleMoveGroup(actualIdx, 'UP')}
                        disabled={actualIdx === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Move Up"
                      >
                        <RiArrowUpLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveGroup(actualIdx, 'DOWN')}
                        disabled={actualIdx === optionGroups.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                        title="Move Down"
                      >
                        <RiArrowDownLine className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active Group & Choices Editor (8 cols) */}
          {activeGroup && (
            <div className="lg:col-span-8 space-y-4">
              {/* Group Settings Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Edit Group: {activeGroup.name}
                    </span>
                    {activeGroup.reusableGroupId ? (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-bold">
                        <RiBookOpenLine className="w-3 h-3 text-amber-600" />
                        Master Reusable Group (/admin/option-groups)
                      </span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-medium">
                        Product Custom
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {activeGroup.reusableGroupId && (
                      <button
                        type="button"
                        onClick={handleSyncActiveGroupFromLibrary}
                        className="text-xs text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Pull latest values and options from /admin/option-groups"
                      >
                        <RiRefreshLine className="w-3.5 h-3.5 text-amber-700" />
                        <span>Sync with Library</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveGroup(selectedGroupIndex)}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <RiDeleteBin7Line className="w-3.5 h-3.5" /> Remove from Product
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Group Label</label>
                    <input
                      type="text"
                      value={activeGroup.name}
                      onChange={(e) => updateActiveGroup({ name: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Code Identifier</label>
                    <input
                      type="text"
                      value={activeGroup.code}
                      onChange={(e) =>
                        updateActiveGroup({
                          code: e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, '_'),
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Storefront Input Type</label>
                    <select
                      value={activeGroup.inputType}
                      onChange={(e) => updateActiveGroup({ inputType: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="SELECT">SELECT (Dropdown list)</option>
                      <option value="RADIO">RADIO (Button group cards)</option>
                      <option value="CHECKBOX">CHECKBOX (Multi-select add-on)</option>
                      <option value="TOGGLE">TOGGLE (Yes/No switch)</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeGroup.isRequired}
                      onChange={(e) => updateActiveGroup({ isRequired: e.target.checked })}
                      className="rounded text-amber-500 border-slate-300 focus:ring-amber-500"
                    />
                    <span className="font-semibold">Mandatory selection</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeGroup.isCustomerVisible}
                      onChange={(e) => updateActiveGroup({ isCustomerVisible: e.target.checked })}
                      className="rounded text-amber-500 border-slate-300 focus:ring-amber-500"
                    />
                    <span className="font-semibold">Visible to customers on storefront</span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 text-xs text-amber-950 font-semibold cursor-pointer bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                    <input
                      type="checkbox"
                      checked={Boolean(activeGroup.enableAdditionalPricing)}
                      onChange={(e) => updateActiveGroup({ enableAdditionalPricing: e.target.checked })}
                      className="rounded text-amber-600 border-amber-300 focus:ring-amber-500"
                    />
                    <span>Eligible for Additional Pricing (Step 4)</span>
                  </label>
                </div>
              </div>

              {/* Options Table Card */}
              <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                        Configured Choices ({activeGroup.options.length})
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-mono font-bold border ${
                          activeChoicesInActiveGroup.length === 0
                            ? 'bg-rose-50 text-rose-800 border-rose-300'
                            : activeChoicesInActiveGroup.length < activeGroup.options.length
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {activeChoicesInActiveGroup.length} of {activeGroup.options.length} Selected for Product
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 block">
                      Select which choices apply to this product. Only selected choices move forward to Pricing, Artwork, and Storefront.
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Filter buttons */}
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
                      <button
                        type="button"
                        onClick={() => setChoiceFilter('ALL')}
                        className={`px-2 py-1 rounded cursor-pointer ${
                          choiceFilter === 'ALL'
                            ? 'bg-amber-100 text-amber-900 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All ({activeGroup.options.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoiceFilter('ACTIVE')}
                        className={`px-2 py-1 rounded cursor-pointer ${
                          choiceFilter === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-900 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Selected ({activeChoicesInActiveGroup.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setChoiceFilter('EXCLUDED')}
                        className={`px-2 py-1 rounded cursor-pointer ${
                          choiceFilter === 'EXCLUDED'
                            ? 'bg-slate-200 text-slate-800 font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Excluded ({activeGroup.options.length - activeChoicesInActiveGroup.length})
                      </button>
                    </div>

                    {/* Batch Actions */}
                    <button
                      type="button"
                      onClick={handleSelectAllChoicesInActiveGroup}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-300 transition cursor-pointer"
                      title="Select all choices in this group for this product"
                    >
                      <RiCheckDoubleLine className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Select All</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleDeselectAllChoicesInActiveGroup}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-300 transition cursor-pointer"
                      title="Deselect all choices in this group for this product"
                    >
                      <RiCloseLine className="w-3.5 h-3.5 text-slate-500" />
                      <span>Deselect All</span>
                    </button>

                    {activeGroup.options.some((o) => o.isActive === false) && (
                      <button
                        type="button"
                        onClick={handleRemoveUnselectedChoices}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-rose-200 transition cursor-pointer"
                        title="Permanently remove excluded choices from this product"
                      >
                        <RiDeleteBin7Line className="w-3.5 h-3.5" />
                        <span>Purge Excluded</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsBulkModalOpen(true)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-300 transition cursor-pointer"
                    >
                      <RiFileTextLine className="w-3.5 h-3.5" /> Bulk Ingest
                    </button>

                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="px-3 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-black font-bold text-xs rounded-lg flex items-center gap-1 shadow-2xs transition cursor-pointer"
                    >
                      <RiAddLine className="w-4 h-4" /> Add Choice
                    </button>
                  </div>
                </div>

                {/* Zero Active Alert */}
                {activeGroup.options.length > 0 && activeChoicesInActiveGroup.length === 0 && (
                  <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                    <RiErrorWarningLine className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      <strong>No choices selected:</strong> You must check &quot;Select for Product&quot; on at least one choice for &quot;{activeGroup.name}&quot; to move to next stages.
                    </span>
                  </div>
                )}

                {activeGroup.options.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No choices configured yet. Click &quot;Add Choice&quot; or &quot;Bulk Ingest&quot;.
                  </div>
                ) : displayedChoices.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs space-y-1">
                    <div>No choices match filter &quot;{choiceFilter}&quot;.</div>
                    <button
                      type="button"
                      onClick={() => setChoiceFilter('ALL')}
                      className="text-amber-800 underline font-bold"
                    >
                      Show All Choices ({activeGroup.options.length})
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50/90 text-[11px] text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                        <tr>
                          <th className="p-3 w-44">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isAllActiveInGroup}
                                ref={(input) => {
                                  if (input) input.indeterminate = isSomeActiveInGroup;
                                }}
                                onChange={() => {
                                  if (isAllActiveInGroup) {
                                    handleDeselectAllChoicesInActiveGroup();
                                  } else {
                                    handleSelectAllChoicesInActiveGroup();
                                  }
                                }}
                                className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                title="Select / Deselect all choices for this product"
                              />
                              <span>Select for Product</span>
                            </div>
                          </th>
                          <th className="p-3">Label</th>
                          <th className="p-3">Value Code</th>
                          <th className="p-3">Price Delta</th>
                          <th className="p-3 text-center">Default</th>
                          <th className="p-3 text-center">Art Slots</th>
                          <th className="p-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {displayedChoices.map(({ opt, optIdx }) => {
                          const isSelectedForProduct = opt.isActive !== false;

                          return (
                            <tr
                              key={opt.id || optIdx}
                              className={`transition-colors ${
                                !isSelectedForProduct
                                  ? 'bg-slate-50/80 opacity-60 hover:opacity-100 border-l-4 border-slate-300'
                                  : 'hover:bg-slate-50/60 border-l-4 border-amber-500'
                              }`}
                            >
                              {/* 1. Selection Checkbox for this Product */}
                              <td className="p-2.5">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={isSelectedForProduct}
                                    onChange={(e) =>
                                      updateOption(optIdx, { isActive: e.target.checked })
                                    }
                                    className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                  />
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                                      isSelectedForProduct
                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                        : 'bg-slate-200 text-slate-600 border border-slate-300 line-through'
                                    }`}
                                  >
                                    {isSelectedForProduct ? 'Selected' : 'Excluded'}
                                  </span>
                                </label>
                              </td>

                              {/* 2. Label */}
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  value={opt.label}
                                  onChange={(e) => updateOption(optIdx, { label: e.target.value })}
                                  className={`w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-amber-500 ${
                                    !isSelectedForProduct ? 'text-slate-400' : ''
                                  }`}
                                />
                              </td>

                              {/* 3. Value Code */}
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  value={opt.value}
                                  onChange={(e) =>
                                    updateOption(optIdx, {
                                      value: e.target.value
                                        .toLowerCase()
                                        .replace(/[^a-z0-9_]+/g, '_'),
                                    })
                                  }
                                  className="w-full bg-white border border-slate-200 rounded px-2 py-1 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500"
                                />
                              </td>

                              {/* 4. Price Delta */}
                              <td className="p-2.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] text-slate-500">+₹</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={opt.priceModifier}
                                    onChange={(e) =>
                                      updateOption(optIdx, {
                                        priceModifier: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-20 bg-white border border-slate-200 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:border-amber-500"
                                  />
                                </div>
                              </td>

                              {/* 5. Default Choice */}
                              <td className="p-2.5 text-center">
                                <input
                                  type="radio"
                                  name={`default_opt_${activeGroup.id}`}
                                  checked={Boolean(opt.isDefault)}
                                  onChange={() =>
                                    updateOption(optIdx, { isDefault: true, isActive: true })
                                  }
                                  className="text-amber-500 focus:ring-amber-500 cursor-pointer"
                                  title={
                                    isSelectedForProduct
                                      ? 'Set as default choice'
                                      : 'Selecting as default will also include this choice for this product'
                                  }
                                />
                              </td>

                              {/* 6. Art Slots */}
                              <td className="p-2.5 text-center">
                                <input
                                  type="number"
                                  min={0}
                                  max={10}
                                  value={opt.fileCount || 0}
                                  onChange={(e) =>
                                    updateOption(optIdx, {
                                      fileCount: parseInt(e.target.value, 10) || 0,
                                    })
                                  }
                                  className="w-12 bg-white border border-slate-200 rounded px-1.5 py-1 text-xs font-mono text-center"
                                  title="Number of dedicated artwork file slots required for this option"
                                />
                              </td>

                              {/* 7. Actions */}
                              <td className="p-2.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveOption(optIdx, 'UP')}
                                    disabled={optIdx === 0}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                    title="Move Up"
                                  >
                                    <RiArrowUpLine className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveOption(optIdx, 'DOWN')}
                                    disabled={optIdx === activeGroup.options.length - 1}
                                    className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                                    title="Move Down"
                                  >
                                    <RiArrowDownLine className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOption(optIdx)}
                                    className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                    title="Delete option"
                                  >
                                    <RiDeleteBin7Line className="w-3.5 h-3.5" />
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
            </div>
          )}
        </div>
      )}

      {/* Step 2 Bottom Navigation & Validation Bar */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {onNavigateToTab && (
            <button
              type="button"
              onClick={() => onNavigateToTab('BASICS')}
              className="px-3.5 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
            >
              ← Back to Basic Details
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="font-semibold text-slate-900">Stage 2 Summary:</span>
          <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-mono text-[11px]">
            {optionGroups.length} Groups
          </span>
          <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono font-bold text-[11px]">
            {totalActiveChoices} Selected Choices
          </span>
          <span className="bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 rounded font-mono text-[11px]">
            ~{estimatedCartesianCombos.toLocaleString()} Combinations Moving to Next Stages
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleProceedToNextStage}
            className="flex items-center gap-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-[#0F172A] font-bold text-xs px-4 py-2.5 rounded-lg border border-[#E3A008]/40 shadow-xs transition active:scale-95 cursor-pointer"
          >
            <span>Proceed to Step 3: Artwork Conditions</span>
            <RiArrowRightLine className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reusable Library Browser Modal with Individual Choices Selection */}
      {isLibraryModalOpen && (
        <Modal
          isOpen={isLibraryModalOpen}
          onClose={() => setIsLibraryModalOpen(false)}
          title="Import from Reusable Option Groups Library"
          maxWidth="3xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-amber-900 text-[11px] flex items-center gap-2">
              <RiShieldCheckLine className="w-4 h-4 shrink-0 text-amber-700" />
              <span>
                Pick the shared groups and <strong>specifically choose which options apply to this product</strong>. Only selected choices will be imported.
              </span>
            </div>

            <div className="relative">
              <RiSearch2Line className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search standard groups (Material, Size, Finish)..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
            </div>

            {isLoadingLibrary ? (
              <div className="p-8 text-center text-slate-400">Loading library templates...</div>
            ) : libraryGroups.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No library groups found.</div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-2">
                {libraryGroups
                  .filter((g) => {
                    if (!librarySearch.trim()) return true;
                    const q = librarySearch.toLowerCase();
                    return g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q);
                  })
                  .map((g) => {
                    const isChecked = selectedLibraryIds.includes(g.id);
                    const defaultCount = Array.isArray(g.defaultOptions) ? g.defaultOptions.length : 0;
                    const selectedChoicesCount = (selectedLibraryOptionValues[g.id] || []).length;
                    const isExpanded = expandedLibraryIds.includes(g.id);

                    return (
                      <div
                        key={g.id}
                        className={`border rounded-lg overflow-hidden transition-all ${
                          isChecked ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div
                          className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                            isChecked ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => handleToggleLibrarySelection(g.id)}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleLibrarySelection(g.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                                <span>{g.name}</span>
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  /{g.code}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                <span className="font-semibold text-slate-800">
                                  {selectedChoicesCount} of {defaultCount} choices selected
                                </span>{' '}
                                for this product • {g.inputType}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => handleToggleExpandLibraryGroup(g.id)}
                              className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 bg-amber-100/70 hover:bg-amber-200 px-2 py-1 rounded flex items-center gap-1 border border-amber-300/60 cursor-pointer"
                            >
                              <span>{isExpanded ? 'Hide Choices' : 'Pick Choices'}</span>
                              {isExpanded ? (
                                <RiArrowDropUpLine className="w-4 h-4" />
                              ) : (
                                <RiArrowDropDownLine className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expanded choice selector for this specific library group */}
                        {isExpanded && (
                          <div className="p-3 bg-slate-50/90 border-t border-slate-200 space-y-2">
                            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 text-[11px]">
                              <span className="font-bold text-slate-700">
                                Select choices of &quot;{g.name}&quot; for this product:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSelectAllOptionsInLibraryGroup(g.id)}
                                  className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                                >
                                  Select All
                                </button>
                                <span>•</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeselectAllOptionsInLibraryGroup(g.id)}
                                  className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                                >
                                  Deselect All
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                              {(Array.isArray(g.defaultOptions) ? g.defaultOptions : []).map(
                                (opt: any) => {
                                  const isOptChecked = (
                                    selectedLibraryOptionValues[g.id] || []
                                  ).includes(opt.value);

                                  return (
                                    <label
                                      key={opt.value}
                                      className={`p-2 rounded border flex items-center gap-2 cursor-pointer text-xs transition select-none ${
                                        isOptChecked
                                          ? 'bg-amber-50/80 border-amber-300 font-bold text-amber-950'
                                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isOptChecked}
                                        onChange={() => handleToggleLibraryOption(g.id, opt.value)}
                                        className="rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
                                      />
                                      <div className="truncate">
                                        <span className="block truncate">{opt.label || opt.value}</span>
                                        <span className="text-[10px] font-mono text-slate-400 block truncate">
                                          {opt.value}
                                        </span>
                                      </div>
                                    </label>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <span className="text-[11px] font-semibold text-slate-600">
                {selectedLibraryIds.length} groups selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLibraryModalOpen(false)}
                  className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAttachSelectedLibraryGroups}
                  disabled={selectedLibraryIds.length === 0}
                  className="px-4 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-black font-bold text-xs rounded-lg shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  Attach to Product
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Bulk Values Modal */}
      {isBulkModalOpen && (
        <Modal
          isOpen={isBulkModalOpen}
          onClose={() => setIsBulkModalOpen(false)}
          title={`Bulk Ingest Values into "${activeGroup?.name}"`}
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-500 text-[11px]">
              Paste multiple choices below (one per line). Format:{' '}
              <span className="font-mono font-bold text-slate-800">Label, value_code, extra_price</span>
            </p>

            <textarea
              rows={8}
              value={bulkInputText}
              onChange={(e) => setBulkInputText(e.target.value)}
              placeholder="300 GSM Art Card, 300_gsm, 0&#10;350 GSM Art Card, 350_gsm, 150&#10;400 GSM Imported, 400_gsm, 300"
              className="w-full p-3 font-mono text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-amber-500"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-3 py-1.5 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkAddValues}
                disabled={!bulkInputText.trim()}
                className="px-4 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-black font-bold text-xs rounded-lg shadow-xs disabled:opacity-50"
              >
                Ingest Values
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
