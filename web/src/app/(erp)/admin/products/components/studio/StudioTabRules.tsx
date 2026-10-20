'use client';

import React, { useState } from 'react';
import {
  RiAddLine,
  RiDeleteBin7Line,
  RiFileCopyLine,
  RiSparklingFill,
  RiCheckLine,
  RiErrorWarningLine,
  RiArrowRightLine,
  RiInformationLine,
  RiEditLine,
  RiUploadCloud2Line,
  RiCameraLine,
  RiFileTextLine,
  RiCheckboxCircleLine,
  RiPriceTag3Line,
} from 'react-icons/ri';
import { ProductConfigurationRule, ProductOptionGroup } from '@/lib/api';
import { Modal } from '@/components/ui';

export interface StudioTabRulesProps {
  rules: ProductConfigurationRule[];
  setRules: React.Dispatch<React.SetStateAction<ProductConfigurationRule[]>>;
  optionGroups: ProductOptionGroup[];
  onChange?: () => void;
}

export function StudioTabRules({
  rules,
  setRules,
  optionGroups,
  onChange,
}: StudioTabRulesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [conditionGroupCode, setConditionGroupCode] = useState(optionGroups[0]?.code || '');
  const [conditionOperator, setConditionOperator] = useState('IN');
  const [selectedConditionValues, setSelectedConditionValues] = useState<string[]>([]);
  const [actionType, setActionType] = useState('HIDE');
  const [targetGroupCode, setTargetGroupCode] = useState(optionGroups[1]?.code || optionGroups[0]?.code || '');
  const [targetOptionValue, setTargetOptionValue] = useState('');

  // Target Effect: Artwork Behavior Payload
  const [artworkStatus, setArtworkStatus] = useState<'REQUIRED' | 'OPTIONAL' | 'DISABLED'>('REQUIRED');
  const [uploadPurpose, setUploadPurpose] = useState<'PRINT_READY' | 'DESIGN_REFERENCE' | 'SAMPLE_MOCKUP'>('PRINT_READY');
  const [displayLabel, setDisplayLabel] = useState<string>('');
  const [acceptedFormats, setAcceptedFormats] = useState<string>('PDF, AI, PSD, CDR, TIFF, JPG');
  const [slotCount, setSlotCount] = useState<number>(1);
  const [slotLabelsList, setSlotLabelsList] = useState<string[]>(['Front Side']);
  const [minMegapixels, setMinMegapixels] = useState<number>(1.5);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState<number>(50);
  const [designServicePolicy, setDesignServicePolicy] = useState<'STANDARD' | 'REQUIRE_BRIEF' | 'SKIP_BRIEF'>('STANDARD');

  // Target Effect: Conditional Additional Charge Payload
  const [chargeName, setChargeName] = useState<string>('');
  const [chargeAmount, setChargeAmount] = useState<number | string>(0);
  const [chargeCalculationType, setChargeCalculationType] = useState<'FIXED' | 'PER_UNIT' | 'PERCENTAGE'>('FIXED');
  const [chargeDescription, setChargeDescription] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);

  // Active options for selected source group
  const sourceGroup = optionGroups.find((g) => g.code === conditionGroupCode);
  const targetGroup = optionGroups.find((g) => g.code === targetGroupCode);

  const handleSetSlotCount = (newCount: number) => {
    const safeCount = Math.max(1, Math.min(10, newCount));
    setSlotCount(safeCount);
    setSlotLabelsList((prev) => {
      const next = [...prev];
      if (next.length < safeCount) {
        if (safeCount === 2 && next.length === 1 && (next[0] === 'Front Side' || next[0] === 'Production Artwork File')) {
          return ['Front Side', 'Back Side'];
        }
        while (next.length < safeCount) {
          next.push(`Artwork File ${next.length + 1}`);
        }
      } else if (next.length > safeCount) {
        return next.slice(0, safeCount);
      }
      return next;
    });
  };

  const handleSlotLabelChange = (index: number, val: string) => {
    setSlotLabelsList((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const applySlotPreset = (labels: string[]) => {
    setSlotCount(labels.length);
    setSlotLabelsList(labels);
  };

  const handleOpenAddModal = (indexToEdit?: number) => {
    setFormError(null);
    if (indexToEdit !== undefined) {
      setEditingRuleIndex(indexToEdit);
      const r = rules[indexToEdit];
      setName(r.name);
      setConditionGroupCode(r.conditionGroupCode);
      setConditionOperator(r.conditionOperator || 'IN');

      const vals = Array.isArray(r.conditionOptionValue)
        ? r.conditionOptionValue
        : String(r.conditionOptionValue || '').split(',').map((s) => s.trim()).filter(Boolean);
      setSelectedConditionValues(vals);

      setActionType(r.actionType);
      setTargetGroupCode(r.targetGroupCode || optionGroups[0]?.code || '');
      setTargetOptionValue(r.targetOptionValue || '');

      if (r.actionPayload) {
        const payload = r.actionPayload as any;
        setArtworkStatus(payload.artworkStatus || 'REQUIRED');
        setUploadPurpose(payload.purpose || 'PRINT_READY');
        setDisplayLabel(payload.displayLabel || '');
        setAcceptedFormats(
          Array.isArray(payload.acceptedFormats)
            ? payload.acceptedFormats.join(', ')
            : payload.acceptedFormats || 'PDF, AI, PSD, CDR, TIFF, JPG',
        );
        const rawLabels: string[] = Array.isArray(payload.slotLabels)
          ? payload.slotLabels
          : String(payload.slotLabels || '')
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean);
        const count = Number(payload.slotCount) || rawLabels.length || 1;
        setSlotCount(count);
        setSlotLabelsList(
          rawLabels.length > 0
            ? rawLabels
            : count === 2
            ? ['Front Side', 'Back Side']
            : Array.from({ length: count }, (_, i) => `Artwork File ${i + 1}`)
        );
        setMinMegapixels(payload.minMegapixels || 1.5);
        setMaxFileSizeMb(payload.maxFileSizeMb || 50);
        setDesignServicePolicy(payload.designServicePolicy || 'STANDARD');

        // Populate charge payload
        setChargeName(payload.name || payload.chargeName || '');
        setChargeAmount(payload.amount ?? payload.price ?? 0);
        setChargeCalculationType(payload.calculationType || 'FIXED');
        setChargeDescription(payload.description || '');
      } else {
        setArtworkStatus('REQUIRED');
        setUploadPurpose('PRINT_READY');
        setDisplayLabel('');
        setAcceptedFormats('PDF, AI, PSD, CDR, TIFF, JPG');
        setSlotCount(1);
        setSlotLabelsList(['Front Side']);
        setMinMegapixels(1.5);
        setMaxFileSizeMb(50);
        setDesignServicePolicy('STANDARD');
        setChargeName('');
        setChargeAmount(0);
        setChargeCalculationType('FIXED');
        setChargeDescription('');
      }
    } else {
      setEditingRuleIndex(null);
      setName('');
      const defaultSource = optionGroups[0]?.code || '';
      const defaultTarget = optionGroups[1]?.code || optionGroups[0]?.code || '';
      setConditionGroupCode(defaultSource);
      setConditionOperator('IN');
      setSelectedConditionValues([]);
      setActionType('HIDE');
      setTargetGroupCode(defaultTarget);
      setTargetOptionValue('');

      setArtworkStatus('REQUIRED');
      setUploadPurpose('PRINT_READY');
      setDisplayLabel('');
      setAcceptedFormats('PDF, AI, PSD, CDR, TIFF, JPG');
      setSlotCount(1);
      setSlotLabelsList(['Front Side']);
      setMinMegapixels(1.5);
      setMaxFileSizeMb(50);
      setDesignServicePolicy('STANDARD');
      setChargeName('');
      setChargeAmount(0);
      setChargeCalculationType('FIXED');
      setChargeDescription('');
    }
    setIsModalOpen(true);
  };

  const handleToggleConditionValue = (val: string) => {
    setSelectedConditionValues((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );
  };

  const handleSelectAllConditionValues = () => {
    if (sourceGroup) {
      setSelectedConditionValues(sourceGroup.options.map((o) => o.value));
    }
  };

  const handleClearConditionValues = () => {
    setSelectedConditionValues([]);
  };

  const isArtworkAction = actionType === 'CONFIGURE_ARTWORK' || actionType === 'REQUIRE_ARTWORK_FILES';
  const isChargeAction = actionType === 'APPLY_CHARGE' || actionType === 'REMOVE_CHARGE';

  const handleSaveRule = () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError('Rule name / description is required.');
      return;
    }
    if (!conditionGroupCode) {
      setFormError('Please select a condition trigger group.');
      return;
    }
    if (selectedConditionValues.length === 0) {
      setFormError('Please select at least one trigger option value with checkboxes.');
      return;
    }
    if (!isArtworkAction && !isChargeAction && !targetGroupCode) {
      setFormError('Please select a target option group for this rule action.');
      return;
    }

    if (actionType === 'APPLY_CHARGE') {
      if (!chargeName.trim()) {
        setFormError('Charge name / title is required (e.g. Design Proofing Fee).');
        return;
      }
      if (Number(chargeAmount) < 0) {
        setFormError('Charge amount cannot be negative.');
        return;
      }
    }

    const actionPayload = isArtworkAction
      ? {
          artworkStatus,
          purpose: uploadPurpose,
          displayLabel: displayLabel.trim() || undefined,
          acceptedFormats: acceptedFormats.split(',').map((f) => f.trim()).filter(Boolean),
          slotCount: Number(slotCount) || 1,
          slotLabels: slotLabelsList.map((s) => s.trim()).filter(Boolean),
          minMegapixels: Number(minMegapixels) || 1.5,
          maxFileSizeMb: Number(maxFileSizeMb) || 50,
          designServicePolicy,
        }
      : actionType === 'APPLY_CHARGE'
      ? {
          chargeId: `chg-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name: chargeName.trim(),
          amount: Number(chargeAmount) || 0,
          calculationType: chargeCalculationType,
          description: chargeDescription.trim() || undefined,
        }
      : actionType === 'REMOVE_CHARGE'
      ? {
          chargeId: `chg-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        }
      : null;

    const ruleData: ProductConfigurationRule = {
      id: editingRuleIndex !== null ? rules[editingRuleIndex].id : `rule-${Date.now()}`,
      productId: '',
      name: name.trim(),
      conditionGroupCode,
      conditionOperator,
      conditionOptionValue: selectedConditionValues.join(','),
      actionType,
      targetGroupCode: isArtworkAction || isChargeAction ? null : targetGroupCode,
      targetOptionValue: isArtworkAction || isChargeAction ? null : targetOptionValue.trim() || null,
      actionPayload,
      isActive: editingRuleIndex !== null ? rules[editingRuleIndex].isActive : true,
    };

    if (editingRuleIndex !== null) {
      setRules((prev) => {
        const copy = [...prev];
        copy[editingRuleIndex] = ruleData;
        return copy;
      });
    } else {
      setRules((prev) => [...prev, ruleData]);
    }

    setIsModalOpen(false);
    onChange?.();
  };

  const handleDuplicateRule = (index: number) => {
    const orig = rules[index];
    const copy: ProductConfigurationRule = {
      ...orig,
      id: `rule-${Date.now()}`,
      name: `${orig.name} (Copy)`,
    };
    setRules((prev) => [...prev, copy]);
    onChange?.();
  };

  const handleToggleActive = (index: number) => {
    setRules((prev) =>
      prev.map((r, i) => (i === index ? { ...r, isActive: !r.isActive } : r))
    );
    onChange?.();
  };

  const handleDeleteRule = (index: number) => {
    if (!confirm('Are you sure you want to delete this configuration rule?')) return;
    setRules((prev) => prev.filter((_, i) => i !== index));
    onChange?.();
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <span>Conditional Logic & Compatibility Rules Engine</span>
            <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full font-mono font-semibold">
              {rules.length} Rules Active
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Configure IF → THEN rules. Target Effects directly control storefront option visibility, mandatory choices, and dynamic artwork upload slots (e.g. 2-sided print requires 2 slots, or Design Service = Yes activates design brief).
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleOpenAddModal()}
          className="flex items-center gap-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-[#0F172A] font-bold text-xs px-4 py-2.5 rounded-lg border border-[#E3A008]/40 shadow-xs transition active:scale-95 cursor-pointer"
        >
          <RiAddLine className="w-4 h-4" />
          <span>Create New Rule</span>
        </button>
      </div>

      {/* Rules List */}
      {rules.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-xl text-center space-y-3">
          <RiSparklingFill className="w-10 h-10 text-amber-400 mx-auto" />
          <h4 className="text-sm font-bold text-slate-800">No Conditional Rules Configured</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Rules allow dynamic hiding, disabling, or configuring of upload slots and storefront options based on customer choices.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule, idx) => {
            const vals = String(rule.conditionOptionValue || '').split(',').map((s) => s.trim()).filter(Boolean);
            const sourceG = optionGroups.find((g) => g.code === rule.conditionGroupCode);
            const targetG = optionGroups.find((g) => g.code === rule.targetGroupCode);
            const payload = (rule.actionPayload as any) || {};

            return (
              <div
                key={rule.id || idx}
                className={`p-4 rounded-xl border transition-all bg-white shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  rule.isActive ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-900">{rule.name}</span>
                    {!rule.isActive && (
                      <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold">
                        DISABLED
                      </span>
                    )}
                  </div>

                  {/* Visual Rule Flow Summary */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono text-[11px]">
                      IF
                    </span>
                    <span className="font-semibold text-slate-800">
                      {sourceG?.name || rule.conditionGroupCode}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">IN</span>
                    <div className="flex flex-wrap items-center gap-1">
                      {vals.map((v) => (
                        <span
                          key={v}
                          className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-200"
                        >
                          {v}
                        </span>
                      ))}
                    </div>

                    <RiArrowRightLine className="w-3.5 h-3.5 text-slate-400" />

                    <span className="font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono text-[11px]">
                      THEN {rule.actionType}
                    </span>

                    {rule.actionType === 'APPLY_CHARGE' ? (
                      <span className="font-semibold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded text-[11px]">
                        💰 +₹{payload.amount} {payload.name || rule.name} ({payload.calculationType || 'FIXED'})
                      </span>
                    ) : rule.actionType === 'REMOVE_CHARGE' ? (
                      <span className="font-semibold text-rose-800 bg-rose-50 border border-rose-300 px-2 py-0.5 rounded text-[11px]">
                        ❌ Waive Charge: {payload.name || rule.name}
                      </span>
                    ) : rule.actionType === 'CONFIGURE_ARTWORK' ? (
                      <span className="font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                        {payload.slotCount || 1} Upload Slot(s): {Array.isArray(payload.slotLabels) ? payload.slotLabels.join(', ') : 'Artwork File'} ({payload.artworkStatus || 'REQUIRED'})
                      </span>
                    ) : rule.actionType === 'REQUIRE_ARTWORK_FILES' ? (
                      <span className="font-semibold text-slate-800">Mandatory Customer Artwork Files</span>
                    ) : (
                      <span className="font-semibold text-slate-800">
                        {targetG?.name || rule.targetGroupCode}
                        {rule.targetOptionValue ? ` (${rule.targetOptionValue})` : ''}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(idx)}
                    className={`text-xs px-2.5 py-1 rounded-md font-semibold border cursor-pointer ${
                      rule.isActive
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {rule.isActive ? 'Disable' : 'Enable'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAddModal(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    title="Edit Rule"
                  >
                    <RiEditLine className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicateRule(idx)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                    title="Duplicate Rule"
                  >
                    <RiFileCopyLine className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteRule(idx)}
                    className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                    title="Delete Rule"
                  >
                    <RiDeleteBin7Line className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visual Rule Builder Modal - FULL SINGLE-VIEW WIDTH */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          maxWidth="6xl"
          title={
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-black uppercase text-amber-600 tracking-wider">
                Rule Studio
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-base font-black text-slate-900 font-display">
                {editingRuleIndex !== null ? 'Edit Conditional Rule' : 'Create New Conditional Rule'}
              </span>
            </div>
          }
          subtitle="Configure dynamic IF condition triggers and exact THEN target storefront effects"
        >
          <div className="space-y-5 text-xs">
            {formError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5">
                <RiErrorWarningLine className="w-5 h-5 shrink-0 text-rose-600" />
                <span className="font-medium">{formError}</span>
              </div>
            )}

            {/* Top Bar: Rule Name & Description */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Rule Name / Purpose Description <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. When Double-Sided is selected, configure 2 artwork slots: Front Side and Back Side"
                className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950"
              />
            </div>

            {/* Panoramic 2-Column Grid: Left (IF Trigger) | Right (THEN Effect) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* -------------------------------------------------------- */}
              {/* LEFT COLUMN: 1. CONDITION TRIGGER (IF)                   */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-5 p-4 sm:p-5 bg-white border border-amber-200/90 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-amber-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-amber-500 text-slate-950 font-black font-mono text-[11px] flex items-center justify-center">
                      IF
                    </span>
                    <span className="font-black text-slate-900 uppercase font-mono tracking-wider text-xs">
                      Condition Trigger
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-800 font-mono font-bold bg-amber-100 px-2 py-0.5 rounded">
                    Source Evaluation
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      When Option Group
                    </label>
                    <select
                      value={conditionGroupCode}
                      onChange={(e) => {
                        setConditionGroupCode(e.target.value);
                        setSelectedConditionValues([]);
                      }}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {optionGroups.map((g) => (
                        <option key={g.id || g.code} value={g.code}>
                          {g.name} ({g.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Matches Operator
                    </label>
                    <select
                      value={conditionOperator}
                      onChange={(e) => setConditionOperator(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      <option value="IN">IN (Any of the checked values)</option>
                      <option value="EQUALS">EQUALS (Exact single value)</option>
                      <option value="NOT_EQUALS">NOT EQUALS (Any value except)</option>
                      <option value="GREATER_THAN">GREATER_THAN (Value &gt; threshold)</option>
                      <option value="LESS_THAN">LESS_THAN (Value &lt; threshold)</option>
                    </select>
                  </div>

                  {/* Source Options Checkbox List */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[11px] font-bold text-slate-700">
                        Trigger Value(s) Checkboxes:
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllConditionValues}
                          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                        >
                          Select All
                        </button>
                        <span className="text-slate-300">•</span>
                        <button
                          type="button"
                          onClick={handleClearConditionValues}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {sourceGroup && sourceGroup.options.length > 0 ? (
                      <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-56 overflow-y-auto custom-scrollbar">
                        {sourceGroup.options.map((opt) => {
                          const isChecked = selectedConditionValues.includes(opt.value);
                          return (
                            <label
                              key={opt.id || opt.value}
                              className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-amber-50/80 border-amber-300 text-amber-950 font-bold'
                                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70 font-medium'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleToggleConditionValue(opt.value)}
                                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="truncate">{opt.label}</span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                {opt.value}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400 italic">
                        No options in selected group.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* -------------------------------------------------------- */}
              {/* RIGHT COLUMN: 2. TARGET EFFECT (THEN)                    */}
              {/* -------------------------------------------------------- */}
              <div className="lg:col-span-7 p-4 sm:p-5 bg-white border border-indigo-200/90 rounded-2xl shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-lg bg-indigo-600 text-white font-black font-mono text-[11px] flex items-center justify-center">
                      THEN
                    </span>
                    <span className="font-black text-slate-900 uppercase font-mono tracking-wider text-xs">
                      Target Effect
                    </span>
                  </div>
                  <span className="text-[10px] text-indigo-800 font-mono font-bold bg-indigo-100 px-2 py-0.5 rounded">
                    Storefront Impact
                  </span>
                </div>

                {/* Action Type Selector */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Select Target Action Type
                  </label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-black focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="CONFIGURE_ARTWORK">🎨 CONFIGURE_ARTWORK (Dynamic Upload Slots & Exact Labels)</option>
                    <option value="REQUIRE_ARTWORK_FILES">📁 REQUIRE_ARTWORK_FILES (Force Mandatory Artwork Files)</option>
                    <option value="APPLY_CHARGE">💰 APPLY_CHARGE (Add Conditional Fee or Surcharge)</option>
                    <option value="REMOVE_CHARGE">❌ REMOVE_CHARGE (Remove or Waive Conditional Charge)</option>
                    <option value="HIDE">👁️ HIDE Option Group / Specific Choice</option>
                    <option value="SHOW">✨ SHOW Option Group / Specific Choice</option>
                    <option value="REQUIRE">⚠️ REQUIRE Option Selection</option>
                    <option value="DISABLE">🚫 DISABLE Option Group / Specific Choice</option>
                    <option value="SET_DEFAULT">⚡ SET_DEFAULT Pre-selection</option>
                  </select>
                </div>

                {/* CONDITIONAL CHARGE ACTION CONFIGURATION */}
                {isChargeAction && (
                  <div className="p-4 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 border border-amber-200 rounded-2xl space-y-3.5">
                    <div className="flex items-center justify-between border-b border-amber-100 pb-2">
                      <div className="flex items-center gap-2">
                        <RiPriceTag3Line className="w-5 h-5 text-amber-600" />
                        <span className="text-xs font-black uppercase text-amber-950 font-display">
                          Conditional Additional Charge Settings
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                        {actionType}
                      </span>
                    </div>

                    {actionType === 'APPLY_CHARGE' ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Charge Name / Title
                            </label>
                            <input
                              type="text"
                              value={chargeName}
                              onChange={(e) => setChargeName(e.target.value)}
                              placeholder="e.g. Design Proofing Fee, Spot UV Setup"
                              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-amber-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Amount (₹) or Rate
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={chargeAmount}
                                onChange={(e) => setChargeAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                              />
                              <select
                                value={chargeCalculationType}
                                onChange={(e: any) => setChargeCalculationType(e.target.value)}
                                className="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-amber-500 cursor-pointer"
                              >
                                <option value="FIXED">₹ Fixed Fee</option>
                                <option value="PER_UNIT">₹ Per Unit</option>
                                <option value="PERCENTAGE">% of Base</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Description / Customer Notice (Optional)
                          </label>
                          <input
                            type="text"
                            value={chargeDescription}
                            onChange={(e) => setChargeDescription(e.target.value)}
                            placeholder="e.g. Special tooling plate and preparation cost"
                            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">
                        When this condition is triggered, any previously applied charge with this rule identifier will be waived and removed from the quote.
                      </p>
                    )}
                  </div>
                )}

                {/* NON-ARTWORK, NON-CHARGE ACTIONS: Target Option Group & Specific Choice */}
                {!isArtworkAction && !isChargeAction && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Target Option Group
                        </label>
                        <select
                          value={targetGroupCode}
                          onChange={(e) => {
                            setTargetGroupCode(e.target.value);
                            setTargetOptionValue('');
                          }}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          {optionGroups.map((g) => (
                            <option key={g.id || g.code} value={g.code}>
                              {g.name} ({g.code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Target Specific Value (Optional)
                        </label>
                        <select
                          value={targetOptionValue}
                          onChange={(e) => setTargetOptionValue(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="">Entire Option Group</option>
                          {targetGroup?.options.map((opt) => (
                            <option key={opt.id || opt.value} value={opt.value}>
                              {opt.label} ({opt.value})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* ARTWORK ACTION CONFIGURATION: Exact Number of Slots + Exact Slot Labels */}
                {isArtworkAction && (
                  <div className="p-4 bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/40 border border-indigo-200 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                      <div className="flex items-center gap-2">
                        <RiUploadCloud2Line className="w-5 h-5 text-indigo-600" />
                        <span className="text-xs font-black uppercase text-indigo-950 font-display">
                          Artwork Upload Slots & Exact Labels
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded">
                        Active Storefront Override
                      </span>
                    </div>

                    {/* Purpose & Display Label */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Upload Field Purpose
                        </label>
                        <select
                          value={uploadPurpose}
                          onChange={(e: any) => setUploadPurpose(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="PRINT_READY">🖨️ PRINT_READY (Production Proof / Prepress)</option>
                          <option value="DESIGN_REFERENCE">🎨 DESIGN_REFERENCE (Client Brief / Sample Mockup)</option>
                          <option value="SAMPLE_MOCKUP">🖼️ SAMPLE_MOCKUP (Logo / Content Reference)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Field Display Label (Optional)
                        </label>
                        <input
                          type="text"
                          value={displayLabel}
                          onChange={(e) => setDisplayLabel(e.target.value)}
                          placeholder="e.g. Upload Print-Ready Vector PDF"
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* 1. Upload Requirement Policy */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                        Customer Upload Requirement Policy
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setArtworkStatus('REQUIRED')}
                          className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                            artworkStatus === 'REQUIRED'
                              ? 'bg-amber-400 border-amber-500 text-slate-950 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          REQUIRED (Mandatory)
                        </button>
                        <button
                          type="button"
                          onClick={() => setArtworkStatus('OPTIONAL')}
                          className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                            artworkStatus === 'OPTIONAL'
                              ? 'bg-slate-900 border-slate-950 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          OPTIONAL (Customer choice)
                        </button>
                        <button
                          type="button"
                          onClick={() => setArtworkStatus('DISABLED')}
                          className={`py-2 px-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                            artworkStatus === 'DISABLED'
                              ? 'bg-rose-600 border-rose-700 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          DISABLED (No uploads)
                        </button>
                      </div>
                    </div>

                    {/* 2. Number of Artwork Files + Exact Stepper */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-slate-700">
                          Number of Artwork Files / Upload Slots:
                        </label>
                        <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded">
                          {slotCount} {slotCount === 1 ? 'File Slot' : 'File Slots'} Configured
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Quick Presets Pills */}
                        {[1, 2, 3, 4].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => handleSetSlotCount(num)}
                            className={`py-1.5 px-3 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
                              slotCount === num
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {num} {num === 1 ? 'Slot' : 'Slots'}
                          </button>
                        ))}

                        {/* Numeric Stepper for Exact Custom Count */}
                        <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleSetSlotCount(slotCount - 1)}
                            disabled={slotCount <= 1}
                            className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={slotCount}
                            onChange={(e) => handleSetSlotCount(parseInt(e.target.value, 10) || 1)}
                            className="w-12 text-center font-mono font-bold text-xs text-slate-900 border-none focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleSetSlotCount(slotCount + 1)}
                            disabled={slotCount >= 10}
                            className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Exact Slot Labels List */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-slate-700">
                          Configure Exact Label for Each Slot:
                        </label>

                        {/* Fast Presets */}
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className="text-slate-400">Presets:</span>
                          <button
                            type="button"
                            onClick={() => applySlotPreset(['Front Side', 'Back Side'])}
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-indigo-400 rounded text-slate-700 font-medium cursor-pointer"
                          >
                            Front & Back (2)
                          </button>
                          <button
                            type="button"
                            onClick={() => applySlotPreset(['Production Artwork File'])}
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-indigo-400 rounded text-slate-700 font-medium cursor-pointer"
                          >
                            Single File (1)
                          </button>
                          <button
                            type="button"
                            onClick={() => applySlotPreset(['Outside Cover', 'Inside Pages'])}
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-indigo-400 rounded text-slate-700 font-medium cursor-pointer"
                          >
                            Outer & Inner (2)
                          </button>
                          <button
                            type="button"
                            onClick={() => applySlotPreset(['Front Cover', 'Back Cover', 'Spine / Inside'])}
                            className="px-2 py-0.5 bg-white border border-slate-200 hover:border-indigo-400 rounded text-slate-700 font-medium cursor-pointer"
                          >
                            Tri-Fold (3)
                          </button>
                        </div>
                      </div>

                      {/* Dynamic List of Exact Slot Label Inputs */}
                      <div className="space-y-2 bg-white p-3 rounded-xl border border-slate-200">
                        {Array.from({ length: slotCount }).map((_, slotIdx) => (
                          <div key={slotIdx} className="flex items-center gap-2">
                            <span className="h-7 w-20 px-2 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 font-mono font-bold text-[11px] flex items-center justify-center shrink-0">
                              Slot 0{slotIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={slotLabelsList[slotIdx] ?? `Artwork File ${slotIdx + 1}`}
                              onChange={(e) => handleSlotLabelChange(slotIdx, e.target.value)}
                              placeholder={`e.g. ${slotIdx === 0 ? 'Front Side' : slotIdx === 1 ? 'Back Side' : `File ${slotIdx + 1}`}`}
                              className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-900 focus:outline-none focus:border-indigo-600 focus:bg-white"
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 4. Prepress Quality & Design Policies */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Min Image Resolution
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            min="0.5"
                            value={minMegapixels}
                            onChange={(e) => setMinMegapixels(parseFloat(e.target.value) || 1.5)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold shrink-0">MP</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Max Upload Size
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="5"
                            max="200"
                            value={maxFileSizeMb}
                            onChange={(e) => setMaxFileSizeMb(parseInt(e.target.value, 10) || 50)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] text-slate-500 font-bold shrink-0">MB</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Design Studio Assistance
                        </label>
                        <select
                          value={designServicePolicy}
                          onChange={(e: any) => setDesignServicePolicy(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                          <option value="STANDARD">STANDARD (Product Default)</option>
                          <option value="REQUIRE_BRIEF">REQUIRE_BRIEF (Show Brief)</option>
                          <option value="SKIP_BRIEF">SKIP_BRIEF (Hide Brief)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Plain-English Live Rule Summary Banner */}
            <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl text-xs text-amber-950 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <RiSparklingFill className="w-4 h-4 text-amber-600" />
                <span>Live Natural-Language Rule Summary:</span>
              </div>
              <p className="font-medium text-slate-800 leading-relaxed">
                When customer selects{' '}
                <strong className="font-bold text-slate-950 underline decoration-amber-400">
                  {sourceGroup?.name || conditionGroupCode}
                </strong>{' '}
                matching{' '}
                {selectedConditionValues.length > 0 ? (
                  <span className="font-mono font-bold bg-amber-100 text-amber-950 px-1.5 py-0.5 rounded border border-amber-300">
                    [{selectedConditionValues.join(', ')}]
                  </span>
                ) : (
                  <span className="italic text-slate-400">no values checked</span>
                )}
                , the system will{' '}
                {isChargeAction ? (
                  <strong className="font-black text-emerald-800">
                    {actionType === 'APPLY_CHARGE' ? 'apply an additional fee of' : 'waive/remove the fee for'}{' '}
                    ₹{chargeAmount} ({chargeCalculationType}) titled &quot;{chargeName || name}&quot;
                  </strong>
                ) : isArtworkAction ? (
                  <strong className="font-black text-indigo-900">
                    dynamically configure {slotCount} artwork slot(s) (&quot;{slotLabelsList.slice(0, slotCount).join(', ')}&quot;) with upload status {artworkStatus} (Min {minMegapixels} MP, Max {maxFileSizeMb}MB)
                  </strong>
                ) : (
                  <>
                    <strong className="font-black text-indigo-900">{actionType}</strong>{' '}
                    <strong className="font-bold text-slate-950">{targetGroup?.name || targetGroupCode}</strong>
                    {targetOptionValue ? ` (specifically "${targetOptionValue}")` : ''}
                  </>
                )}
                .
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveRule}
                className="px-6 py-2.5 bg-[#FFED00] hover:bg-[#F2E100] text-slate-950 text-xs font-black rounded-xl border border-amber-300 shadow-sm transition active:scale-95 cursor-pointer"
              >
                {editingRuleIndex !== null ? 'Save Rule Changes' : 'Create Conditional Rule'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
