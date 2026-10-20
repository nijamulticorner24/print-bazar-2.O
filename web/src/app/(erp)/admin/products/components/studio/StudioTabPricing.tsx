'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  RiTableLine,
  RiAddLine,
  RiDeleteBin7Line,
  RiFilter3Line,
  RiSearch2Line,
  RiCheckLine,
  RiCloseLine,
  RiErrorWarningLine,
  RiInformationLine,
  RiRefreshLine,
  RiShieldCheckLine,
  RiArrowRightLine,
  RiEditLine,
  RiFileCopyLine,
  RiSparklingFill,
  RiPriceTag3Line,
  RiPaletteLine,
  RiPlayCircleLine,
  RiSettings4Line,
  RiCheckboxCircleLine,
  RiAlertFill,
  RiEqualizerLine,
  RiStackLine,
  RiCheckDoubleLine,
} from 'react-icons/ri';
import { ProductOptionGroup, ProductOption, api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { resolveArtworkConditions } from '@/lib/artwork-rule-resolver';
import { Modal } from '@/components/ui';

export interface MatrixRowItem {
  id?: string;
  minQty: number;
  maxQty: number;
  unitPrice: number | string;
  attributeCombination: Record<string, any>;
  isExcluded?: boolean;
  status?: 'ACTIVE' | 'EXCLUDED';
  label?: string;
  discountPercent?: number;
  exclusionReason?: string;
}

export interface StudioTabPricingProps {
  productId: string;
  pricingModel: string;
  setPricingModel?: (model: string) => void;
  basePrice: number | string;
  setBasePrice?: (val: number | string) => void;
  minQuantity: number;
  setMinQuantity?: (val: number) => void;
  maxQuantity?: number;
  optionGroups: ProductOptionGroup[];
  setOptionGroups?: React.Dispatch<React.SetStateAction<ProductOptionGroup[]>>;
  rules: any[];
  matrixRows: MatrixRowItem[];
  setMatrixRows: React.Dispatch<React.SetStateAction<MatrixRowItem[]>>;

  // Step 3 Design Pricing & Artwork (read-only reference in Step 4)
  designServiceRequirement?: string;
  designServiceFee?: number | string;
  artworkRequirement?: string;
  artworkFileFormats?: string[];
  defaultSize?: string;

  onChange?: () => void;
}

export type PricingMethodType = 'OPTION' | 'COMBINATION' | 'INCLUDED';

export interface SellableCombination {
  id: string; // normalized key: e.g. "paper:matte|printing_location:front"
  attributes: Record<string, string>;
  title: string;
  badges: Array<{ groupName: string; groupCode: string; optionLabel: string; value: string }>;
  pricesByQty: Record<number, number>; // { 100: 300, 250: 600, 500: 950 }
  isExcluded: boolean;
  exclusionReason?: string;
}

export function StudioTabPricing({
  productId,
  pricingModel,
  setPricingModel,
  basePrice,
  setBasePrice,
  minQuantity,
  setMinQuantity,
  maxQuantity,
  optionGroups,
  setOptionGroups,
  rules = [],
  matrixRows,
  setMatrixRows,
  designServiceRequirement = 'OPTIONAL',
  designServiceFee = 150,
  artworkRequirement = 'OPTIONAL',
  artworkFileFormats = ['PDF', 'AI', 'PSD'],
  defaultSize,
  onChange,
}: StudioTabPricingProps) {
  // Derived Reference Unit Price: Starting Reference Rate (₹) / Minimum Order Quantity = Reference Unit Price
  const startingReferenceRate = Number(basePrice) || 0;
  const moq = Math.max(1, Number(minQuantity) || 1);
  const referenceUnitPrice = Math.round((startingReferenceRate / moq) * 10000) / 10000;

  // View toggle: Combination Pricing Table (primary) vs Option Surcharges
  const [activePricingView, setActivePricingView] = useState<'MATRIX' | 'OPTIONS'>('MATRIX');

  // ---------------------------------------------------------------------------
  // 1. ACTIVE GROUP SELECTION (LEFT PANEL)
  // ---------------------------------------------------------------------------
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    optionGroups[0]?.id || ''
  );

  // Sync selected group if optionGroups changes
  useEffect(() => {
    if (optionGroups.length > 0 && !optionGroups.some((g) => g.id === selectedGroupId)) {
      setSelectedGroupId(optionGroups[0].id);
    }
  }, [optionGroups, selectedGroupId]);

  const activeGroup = useMemo(() => {
    return optionGroups.find((g) => g.id === selectedGroupId) || optionGroups[0] || null;
  }, [optionGroups, selectedGroupId]);

  // ---------------------------------------------------------------------------
  // 2. DETECT PRICING STATUS FOR EACH OPTION GROUP
  // ---------------------------------------------------------------------------
  const groupStatusMap = useMemo(() => {
    const map = new Map<
      string,
      {
        method: PricingMethodType | 'ERROR';
        label: string;
        badgeClass: string;
        description: string;
        nonZeroCount: number;
        hasError: boolean;
        errorMessage?: string;
      }
    >();

    for (const group of optionGroups) {
      const activeOptions = group.options.filter((o) => o.isActive !== false);

      // Check negative price modifiers
      const hasNegative = activeOptions.some((o) => Number(o.priceModifier) < 0);
      if (hasNegative) {
        map.set(group.id, {
          method: 'ERROR',
          label: 'Error: Negative Price',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          description: 'Contains invalid negative charge',
          nonZeroCount: 0,
          hasError: true,
          errorMessage: 'Option charges must be non-negative (≥ ₹0).',
        });
        continue;
      }

      // Check if group is part of combination matrix
      const isPartofMatrix = matrixRows.some((r) => {
        const c = (r.attributeCombination as any) || {};
        return c[group.code] !== undefined;
      });

      if (isPartofMatrix) {
        map.set(group.id, {
          method: 'COMBINATION',
          label: 'Combination-Based',
          badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
          description: 'Priced in sellable combination matrix',
          nonZeroCount: 0,
          hasError: false,
        });
        continue;
      }

      // Check if any option has independent price modifier > 0
      const nonZeroOptions = activeOptions.filter((o) => Number(o.priceModifier) > 0);
      if (nonZeroOptions.length > 0) {
        map.set(group.id, {
          method: 'OPTION',
          label: 'Option-Based Pricing',
          badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
          description: `${nonZeroOptions.length} choice(s) with additive charges`,
          nonZeroCount: nonZeroOptions.length,
          hasError: false,
        });
        continue;
      }

      // Otherwise marked as included in base price
      map.set(group.id, {
        method: 'INCLUDED',
        label: 'Included in Base Price',
        badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        description: '₹0 additional charge (covered in base)',
        nonZeroCount: 0,
        hasError: false,
      });
    }

    return map;
  }, [optionGroups, matrixRows]);

  // Method state for the currently active group
  const activeGroupStatus = activeGroup ? groupStatusMap.get(activeGroup.id) : null;
  const [activeMethodOverride, setActiveMethodOverride] = useState<PricingMethodType | null>(null);

  const currentMethod: PricingMethodType = useMemo(() => {
    if (activeMethodOverride) return activeMethodOverride;
    if (activeGroupStatus && activeGroupStatus.method !== 'ERROR') {
      return activeGroupStatus.method;
    }
    return 'INCLUDED';
  }, [activeMethodOverride, activeGroupStatus]);

  // Reset override when active group changes
  useEffect(() => {
    setActiveMethodOverride(null);
  }, [selectedGroupId]);

  // ---------------------------------------------------------------------------
  // 3. METHOD A: OPTION-BASED CHARGES DRAFT STATE & HANDLERS
  // ---------------------------------------------------------------------------
  const [optionChargesDraft, setOptionChargesDraft] = useState<Record<string, { amount: string; type: string }>>({});
  const [optionSuccessMsg, setOptionSuccessMsg] = useState<string | null>(null);

  // Initialize draft when activeGroup changes
  useEffect(() => {
    if (!activeGroup) return;
    const initialDraft: Record<string, { amount: string; type: string }> = {};
    for (const opt of activeGroup.options) {
      initialDraft[opt.id] = {
        amount: String(opt.priceModifier || 0),
        type: opt.priceModifierType || 'FIXED',
      };
    }
    setOptionChargesDraft(initialDraft);
    setOptionSuccessMsg(null);
  }, [activeGroup]);

  const handleOptionChargeChange = (optId: string, field: 'amount' | 'type', value: string) => {
    setOptionChargesDraft((prev) => ({
      ...prev,
      [optId]: {
        ...prev[optId],
        [field]: value,
      },
    }));
  };

  const handleSaveOptionCharges = () => {
    if (!activeGroup || !setOptionGroups) return;

    // Validate non-negative
    for (const opt of activeGroup.options) {
      const draft = optionChargesDraft[opt.id];
      const val = parseFloat(draft?.amount || '0');
      if (isNaN(val) || val < 0) {
        alert(`Option "${opt.label}" has an invalid amount. Charges must be non-negative.`);
        return;
      }
    }

    setOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroup.id) return g;
        return {
          ...g,
          options: g.options.map((opt) => {
            const draft = optionChargesDraft[opt.id];
            const numVal = parseFloat(draft?.amount || '0');
            return {
              ...opt,
              priceModifier: isNaN(numVal) ? 0 : numVal,
              priceModifierType: draft?.type || 'FIXED',
            };
          }),
        };
      })
    );

    // If this group was previously in matrixRows, clean it from matrixRows if user wants pure option-based
    const isInMatrix = matrixRows.some((r) => {
      const c = (r.attributeCombination as any) || {};
      return c[activeGroup.code] !== undefined;
    });

    if (isInMatrix) {
      // Clean this group from combination rows
      setMatrixRows((prev) => {
        return prev.map((r) => {
          const c = { ...(r.attributeCombination as any) || {} };
          delete c[activeGroup.code];
          return { ...r, attributeCombination: c };
        });
      });
    }

    setOptionSuccessMsg(`Option-based pricing saved successfully for "${activeGroup.name}".`);
    onChange?.();
    setTimeout(() => setOptionSuccessMsg(null), 3000);
  };

  // ---------------------------------------------------------------------------
  // 4. METHOD C: MARK INCLUDED IN BASE PRICE HANDLER
  // ---------------------------------------------------------------------------
  const handleMarkIncludedInBase = () => {
    if (!activeGroup || !setOptionGroups) return;

    setOptionGroups((prev) =>
      prev.map((g) => {
        if (g.id !== activeGroup.id) return g;
        return {
          ...g,
          options: g.options.map((opt) => ({
            ...opt,
            priceModifier: 0,
            priceModifierType: 'FIXED',
          })),
        };
      })
    );

    // Clean this group from combination rows if present
    setMatrixRows((prev) => {
      return prev.map((r) => {
        const c = { ...(r.attributeCombination as any) || {} };
        delete c[activeGroup.code];
        return { ...r, attributeCombination: c };
      });
    });

    // Reset draft state
    const newDraft: Record<string, { amount: string; type: string }> = {};
    for (const opt of activeGroup.options) {
      newDraft[opt.id] = { amount: '0', type: 'FIXED' };
    }
    setOptionChargesDraft(newDraft);

    setActiveMethodOverride('INCLUDED');
    setOptionSuccessMsg(`Group "${activeGroup.name}" is now marked as included in the base printing price (₹0 add-on).`);
    onChange?.();
    setTimeout(() => setOptionSuccessMsg(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // 5. METHOD B: COMBINATION-BASED PRICING MATRIX ENGINE
  // ---------------------------------------------------------------------------
  const [quantityColumns, setQuantityColumns] = useState<number[]>(() => {
    const set = new Set<number>();
    for (const r of matrixRows) {
      const q = Number(r.minQty);
      if (q > 0) set.add(q);
    }
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [100, 250, 500, 1000];
  });

  useEffect(() => {
    setQuantityColumns((prev) => {
      const set = new Set(prev);
      let changed = false;
      for (const r of matrixRows) {
        const q = Number(r.minQty);
        if (q > 0 && !set.has(q)) {
          set.add(q);
          changed = true;
        }
      }
      return changed ? Array.from(set).sort((a, b) => a - b) : prev;
    });
  }, [matrixRows]);

  // Participating combination groups
  const [participatingGroupCodes, setParticipatingGroupCodes] = useState<string[]>(() => {
    const set = new Set<string>();
    for (const r of matrixRows) {
      const c = (r.attributeCombination as any) || {};
      for (const k of Object.keys(c)) {
        if (!['discountPercent', 'label', 'offerName', 'isExcluded', 'status', 'exclusionReason', 'type', 'isBasePrice', 'price', 'totalPrice', 'quantity'].includes(k)) {
          set.add(k);
        }
      }
    }
    if (set.size > 0) return Array.from(set);
    return optionGroups.map((g) => g.code);
  });

  useEffect(() => {
    if (participatingGroupCodes.length === 0 && optionGroups.length > 0) {
      setParticipatingGroupCodes(optionGroups.map((g) => g.code));
    }
  }, [optionGroups, participatingGroupCodes.length]);

  const toggleParticipatingGroup = (code: string) => {
    setParticipatingGroupCodes((prev) => {
      if (prev.includes(code)) {
        if (prev.length <= 1) {
          alert('At least one group must be selected for the combination table.');
          return prev;
        }
        return prev.filter((c) => c !== code);
      }
      return [...prev, code];
    });
  };

  // Sellable combinations extraction
  const sellableCombinations: SellableCombination[] = useMemo(() => {
    const comboMap = new Map<
      string,
      {
        attributes: Record<string, string>;
        prices: Record<number, number>;
        isExcluded: boolean;
        exclusionReason?: string;
      }
    >();

    for (const row of matrixRows) {
      const c = (row.attributeCombination as any) || {};
      const keys = Object.keys(c)
        .filter(
          (k) =>
            ![
              'discountPercent',
              'label',
              'offerName',
              'isExcluded',
              'status',
              'exclusionReason',
              'type',
              'isBasePrice',
              'price',
              'totalPrice',
              'quantity',
            ].includes(k)
        )
        .sort();

      if (keys.length === 0) continue;
      const id = keys.map((k) => `${k}:${c[k]}`).join('|');

      if (!comboMap.has(id)) {
        const attrOnly: Record<string, string> = {};
        for (const k of keys) attrOnly[k] = String(c[k]);
        comboMap.set(id, {
          attributes: attrOnly,
          prices: {},
          isExcluded: Boolean(
            row.isExcluded || row.status === 'EXCLUDED' || c.isExcluded === true || c.status === 'EXCLUDED'
          ),
          exclusionReason: row.exclusionReason || c.exclusionReason,
        });
      }

      const qty = Number(row.minQty || c.quantity || 1);
      const rawPrice = c.price ?? c.totalPrice ?? Number(row.unitPrice || 0) * qty;
      if (qty > 0 && rawPrice !== undefined && rawPrice !== null) {
        comboMap.get(id)!.prices[qty] = Number(rawPrice);
      }
    }

    return Array.from(comboMap.entries()).map(([id, data]) => {
      const badges = Object.entries(data.attributes).map(([k, v]) => {
        const grp = optionGroups.find((g) => g.code === k);
        const opt = grp?.options.find((o) => o.value === v);
        return {
          groupName: grp?.name || k,
          groupCode: k,
          optionLabel: opt?.label || v,
          value: v,
        };
      });
      const title = badges.map((b) => b.optionLabel).join(' / ');

      return {
        id,
        attributes: data.attributes,
        title,
        badges,
        pricesByQty: data.prices,
        isExcluded: data.isExcluded,
        exclusionReason: data.exclusionReason,
      };
    });
  }, [matrixRows, optionGroups]);

  // Search & Filter
  const [comboSearchQuery, setComboSearchQuery] = useState('');
  const [comboFilter, setComboFilter] = useState<'ALL' | 'CONFIGURED' | 'MISSING'>('ALL');

  const filteredCombinations = useMemo(() => {
    return sellableCombinations.filter((combo) => {
      const hasAllPrices = quantityColumns.every(
        (q) => combo.pricesByQty[q] !== undefined && combo.pricesByQty[q] > 0
      );

      if (comboFilter === 'CONFIGURED' && !hasAllPrices) return false;
      if (comboFilter === 'MISSING' && hasAllPrices) return false;

      if (!comboSearchQuery.trim()) return true;
      const q = comboSearchQuery.toLowerCase();
      if (combo.title.toLowerCase().includes(q)) return true;
      if (
        combo.badges.some(
          (b) => b.optionLabel.toLowerCase().includes(q) || b.groupName.toLowerCase().includes(q)
        )
      ) {
        return true;
      }
      return false;
    });
  }, [sellableCombinations, quantityColumns, comboFilter, comboSearchQuery]);

  // ---------------------------------------------------------------------------
  // DIAGNOSTICS & SYSTEM AUDIT (Missing prices, overlapping tiers, duplicates)
  // ---------------------------------------------------------------------------
  const diagnostics = useMemo(() => {
    const list: Array<{ id: string; type: 'error' | 'warning' | 'info'; title: string; message: string }> = [];

    // 1. Missing Reference Base Price
    if (startingReferenceRate <= 0) {
      list.push({
        id: 'missing-base-rate',
        type: 'error',
        title: 'Starting Reference Rate is Missing or ₹0.00',
        message: 'A positive Starting Reference Rate is required to compute the Reference Unit Price.',
      });
    }

    // 2. Matrix Validation when in Manual Matrix Strategy
    if (pricingModel === 'MATRIX' || pricingModel === 'MANUAL') {
      if (sellableCombinations.length === 0) {
        list.push({
          id: 'missing-combinations',
          type: 'warning',
          title: 'No Sellable Combinations Configured',
          message: 'Manual pricing matrix is active, but no combinations are configured. Click "Add Combination" or "Generate Starter".',
        });
      }

      let missingCellCount = 0;
      for (const combo of sellableCombinations) {
        for (const q of quantityColumns) {
          const prc = combo.pricesByQty[q];
          if (prc === undefined || prc <= 0) {
            missingCellCount++;
          }
        }
      }
      if (missingCellCount > 0) {
        list.push({
          id: 'missing-prices',
          type: 'warning',
          title: `${missingCellCount} Missing or Zero Price Cell(s)`,
          message: 'Some combinations in the matrix have unconfigured or ₹0 rates. Unpriced combinations will be rejected during storefront quote and checkout.',
        });
      }
    }

    // 3. Overlapping or Inverted Quantity Ranges
    for (const r of matrixRows) {
      if (r.minQty > r.maxQty && r.maxQty > 0) {
        list.push({
          id: `invalid-range-${r.id}`,
          type: 'error',
          title: 'Invalid Quantity Range in Matrix',
          message: `Tier row has minQty (${r.minQty}) greater than maxQty (${r.maxQty}).`,
        });
        break;
      }
    }

    // 4. Potential Duplicate Charges
    // When an option group has independent surcharges AND is part of combination matrix
    for (const group of optionGroups) {
      const activeOpts = group.options.filter((o) => o.isActive !== false);
      const hasIndependentSurcharge = activeOpts.some((o) => Number(o.priceModifier) > 0);
      const isPartofMatrix = matrixRows.some((r) => {
        const c = (r.attributeCombination as any) || {};
        return c[group.code] !== undefined;
      });

      if (hasIndependentSurcharge && isPartofMatrix) {
        list.push({
          id: `duplicate-charge-${group.id}`,
          type: 'warning',
          title: `Potential Duplicate Charge: "${group.name}"`,
          message: `Option group "${group.name}" has independent option surcharges (+₹...) AND is configured inside Combination Matrix rows. Server pricing engine treats matrix combinations as authoritative and will suppress option surcharges to prevent double charging. Consider standardizing to either Method A (Option-based) or Method B (Combination-based).`,
        });
      }
    }

    return list;
  }, [startingReferenceRate, pricingModel, sellableCombinations, quantityColumns, matrixRows, optionGroups]);

  // Inline Price Change
  const handleCellPriceChange = (combo: SellableCombination, qty: number, newPriceVal: number) => {
    if (isNaN(newPriceVal) || newPriceVal < 0) return;

    setMatrixRows((prev) => {
      const rowId = `row-${combo.id}-${qty}`;
      const existingIdx = prev.findIndex((r) => {
        const c = (r.attributeCombination as any) || {};
        const matchesCombo = Object.keys(combo.attributes).every(
          (k) => String(c[k]) === String(combo.attributes[k])
        );
        return matchesCombo && Number(r.minQty) === qty;
      });

      const updatedRow: MatrixRowItem = {
        id: existingIdx >= 0 ? prev[existingIdx].id || rowId : rowId,
        minQty: qty,
        maxQty: qty,
        unitPrice: qty > 0 ? newPriceVal / qty : newPriceVal,
        attributeCombination: {
          ...combo.attributes,
          price: newPriceVal,
          totalPrice: newPriceVal,
          quantity: qty,
          isExcluded: combo.isExcluded,
          status: combo.isExcluded ? 'EXCLUDED' : 'ACTIVE',
        },
        isExcluded: combo.isExcluded,
        status: combo.isExcluded ? 'EXCLUDED' : 'ACTIVE',
      };

      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = updatedRow;
        return copy;
      } else {
        return [...prev, updatedRow];
      }
    });

    setPricingModel?.('MATRIX');
    onChange?.();
  };

  // Add / Duplicate Combination Modal
  const [isAddComboModalOpen, setIsAddComboModalOpen] = useState(false);
  const [newComboSelections, setNewComboSelections] = useState<Record<string, string>>({});
  const [newComboPrices, setNewComboPrices] = useState<Record<number, string>>({});
  const [comboFormError, setComboFormError] = useState<string | null>(null);

  const handleOpenAddComboModal = () => {
    const initSel: Record<string, string> = {};
    const groupsToUse = optionGroups.filter((g) => participatingGroupCodes.includes(g.code));
    for (const g of groupsToUse) {
      const activeOpts = g.options.filter((o) => o.isActive !== false);
      initSel[g.code] = activeOpts[0]?.value || '';
    }
    const initPrices: Record<number, string> = {};
    for (const q of quantityColumns) {
      initPrices[q] = '';
    }
    setNewComboSelections(initSel);
    setNewComboPrices(initPrices);
    setComboFormError(null);
    setIsAddComboModalOpen(true);
  };

  const handleOpenDuplicateModal = (combo: SellableCombination) => {
    setNewComboSelections({ ...combo.attributes });
    const prices: Record<number, string> = {};
    for (const q of quantityColumns) {
      prices[q] = combo.pricesByQty[q] !== undefined ? String(combo.pricesByQty[q]) : '';
    }
    setNewComboPrices(prices);
    setComboFormError(null);
    setIsAddComboModalOpen(true);
  };

  const handleSaveNewCombination = () => {
    const groupsToUse = optionGroups.filter((g) => participatingGroupCodes.includes(g.code));
    for (const g of groupsToUse) {
      if (!newComboSelections[g.code]) {
        setComboFormError(`Please select an option value for "${g.name}".`);
        return;
      }
    }

    const sortedKeys = Object.keys(newComboSelections).sort();
    const newId = sortedKeys.map((k) => `${k}:${newComboSelections[k]}`).join('|');

    if (sellableCombinations.some((c) => c.id === newId)) {
      setComboFormError('This exact combination already exists in the matrix. Each combination must be unique.');
      return;
    }

    const newRows: MatrixRowItem[] = [];
    for (const q of quantityColumns) {
      const rawPrice = parseFloat(newComboPrices[q] || '0');
      const prc = isNaN(rawPrice) ? 0 : rawPrice;
      newRows.push({
        id: `row-${newId}-${q}-${Date.now()}`,
        minQty: q,
        maxQty: q,
        unitPrice: q > 0 ? prc / q : prc,
        attributeCombination: {
          ...newComboSelections,
          price: prc,
          totalPrice: prc,
          quantity: q,
          status: 'ACTIVE',
        },
        isExcluded: false,
        status: 'ACTIVE',
      });
    }

    setMatrixRows((prev) => [...prev, ...newRows]);
    setPricingModel?.('MATRIX');
    setIsAddComboModalOpen(false);
    onChange?.();
  };

  const handleDeleteCombination = (combo: SellableCombination) => {
    if (!confirm(`Are you sure you want to remove combination "${combo.title}" and its configured rates?`)) {
      return;
    }

    setMatrixRows((prev) => {
      return prev.filter((r) => {
        const c = (r.attributeCombination as any) || {};
        const matchesCombo = Object.keys(combo.attributes).every(
          (k) => String(c[k]) === String(combo.attributes[k])
        );
        return !matchesCombo;
      });
    });

    onChange?.();
  };

  // Add Quantity Tier Modal
  const [isAddQtyModalOpen, setIsAddQtyModalOpen] = useState(false);
  const [newTierQty, setNewTierQty] = useState('');
  const [tierError, setTierError] = useState<string | null>(null);

  const handleAddQuantityTier = () => {
    const q = parseInt(newTierQty, 10);
    if (isNaN(q) || q <= 0) {
      setTierError('Quantity must be a positive integer.');
      return;
    }
    if (quantityColumns.includes(q)) {
      setTierError(`Quantity tier ${q} already exists.`);
      return;
    }

    setQuantityColumns((prev) => [...prev, q].sort((a, b) => a - b));
    setIsAddQtyModalOpen(false);
    setNewTierQty('');
    setTierError(null);
  };

  const handleRemoveQuantityColumn = (q: number) => {
    if (quantityColumns.length <= 1) {
      alert('At least one quantity tier column is required.');
      return;
    }
    if (confirm(`Remove quantity tier ${q.toLocaleString()} pcs from the combination matrix?`)) {
      setQuantityColumns((prev) => prev.filter((item) => item !== q));
      setMatrixRows((prev) => prev.filter((r) => Number(r.minQty) !== q));
      onChange?.();
    }
  };

  // Generate Starter Matrix for participating groups (Auto-Config Rates)
  const handleGenerateStarterCombinations = (forceOverwrite = false) => {
    const groupsToUse = optionGroups.filter(
      (g) => participatingGroupCodes.includes(g.code) && g.options.some((o) => o.isActive !== false)
    );
    if (groupsToUse.length === 0) {
      alert('Please select at least one participating option group with active choices.');
      return;
    }

    let overwrite = forceOverwrite;
    if (!overwrite && sellableCombinations.length > 0) {
      overwrite = confirm('Auto-config combinations: Click OK to regenerate and update rates for all combinations, or Cancel to only add missing combinations.');
    }

    // Build combinations
    let combos: Array<Record<string, string>> = [{}];
    for (const grp of groupsToUse) {
      const activeOpts = grp.options.filter((o) => o.isActive !== false);
      const nextCombos: Array<Record<string, string>> = [];
      for (const cur of combos) {
        for (const opt of activeOpts.slice(0, 4)) {
          nextCombos.push({ ...cur, [grp.code]: opt.value });
        }
      }
      combos = nextCombos;
    }

    const newRows: MatrixRowItem[] = [];
    const refRate = referenceUnitPrice > 0 ? referenceUnitPrice : 2.5;

    for (const combo of combos) {
      const sortedKeys = Object.keys(combo).sort();
      const id = sortedKeys.map((k) => `${k}:${combo[k]}`).join('|');
      if (!overwrite && sellableCombinations.some((c) => c.id === id)) continue;

      for (const q of quantityColumns) {
        const factor = q >= 1000 ? 0.75 : q >= 500 ? 0.85 : q >= 250 ? 0.92 : 1.0;
        const unitPrc = Math.round(refRate * factor * 100) / 100;
        const totalPrc = Math.round(unitPrc * q * 100) / 100;

        newRows.push({
          id: `starter-${id}-${q}-${Date.now()}`,
          minQty: q,
          maxQty: q,
          unitPrice: unitPrc,
          attributeCombination: {
            ...combo,
            price: totalPrc,
            totalPrice: totalPrc,
            quantity: q,
            status: 'ACTIVE',
          },
          isExcluded: false,
          status: 'ACTIVE',
        });
      }
    }

    if (overwrite) {
      setMatrixRows(newRows);
    } else {
      setMatrixRows((prev) => [...prev, ...newRows]);
    }
    setPricingModel?.('MATRIX');
    onChange?.();
  };

  // ---------------------------------------------------------------------------
  // 6. LIVE STOREFRONT PRICING SIMULATOR PREVIEW (SECTION 8)
  // ---------------------------------------------------------------------------
  const [previewSelections, setPreviewSelections] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const g of optionGroups) {
      const activeOpts = g.options.filter((o) => o.isActive !== false);
      const def = activeOpts.find((o) => o.isDefault) || activeOpts[0];
      if (def) init[g.code] = def.value;
    }
    return init;
  });

  const [previewQty, setPreviewQty] = useState<number>(quantityColumns[0] || minQuantity || 100);
  const [previewWantsDesign, setPreviewWantsDesign] = useState<boolean>(false);
  const [previewQuote, setPreviewQuote] = useState<any>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isCalculatingPreview, setIsCalculatingPreview] = useState<boolean>(false);

  // Sync preview selections when options change
  useEffect(() => {
    setPreviewSelections((prev) => {
      const next = { ...prev };
      for (const g of optionGroups) {
        const activeOpts = g.options.filter((o) => o.isActive !== false);
        if (!next[g.code] || !activeOpts.some((o) => o.value === next[g.code])) {
          const def = activeOpts.find((o) => o.isDefault) || activeOpts[0];
          if (def) next[g.code] = def.value;
        }
      }
      return next;
    });
  }, [optionGroups]);

  // Debounced quote calculation
  useEffect(() => {
    let active = true;
    const runQuote = async () => {
      setIsCalculatingPreview(true);
      setPreviewError(null);
      try {
        const optPayload = Object.entries(previewSelections).map(([k, v]) => ({
          optionCode: k,
          valueCode: v,
        }));

        if (productId) {
          const q = await api.calculateQuote({
            productId,
            quantity: previewQty,
            options: optPayload,
            fieldValues: previewSelections,
            hasDesignService: previewWantsDesign,
            deliveryMethod: 'COURIER',
          });
          if (active) setPreviewQuote(q);
        } else {
          // Local fallback simulator when product ID is pending save
          const startingRef = Number(basePrice) || 0;
          const currentMoq = Math.max(1, Number(minQuantity) || 1);
          const refUnitPrice = Math.round((startingRef / currentMoq) * 10000) / 10000;
          let optAddons = 0;
          const activeOptBreakdown: Array<{ groupCode: string; optionCode: string; priceModifier: number; subtotal: number }> = [];

          for (const g of optionGroups) {
            const chosen = g.options.find((o) => o.value === previewSelections[g.code]);
            if (chosen && Number(chosen.priceModifier) > 0) {
              const modifier = Number(chosen.priceModifier);
              optAddons += modifier;
              activeOptBreakdown.push({
                groupCode: g.code,
                optionCode: chosen.value,
                priceModifier: modifier,
                subtotal: Math.round(modifier * previewQty * 100) / 100,
              });
            }
          }

          const designFeeNum = previewWantsDesign ? Number(designServiceFee) || 0 : 0;
          const basePrintSubtotal = Math.round(refUnitPrice * previewQty * 100) / 100;
          const optSubtotal = Math.round(optAddons * previewQty * 100) / 100;
          const subtotal = Math.round((basePrintSubtotal + optSubtotal + designFeeNum) * 100) / 100;
          const tax = Math.round(subtotal * 0.18 * 100) / 100;
          const shipping = subtotal >= 1000 ? 0 : 100;

          if (active) {
            setPreviewQuote({
              startingReferenceRate: startingRef,
              referenceUnitPrice: refUnitPrice,
              baseUnitPrice: refUnitPrice,
              baseSubtotal: basePrintSubtotal,
              optionsSubtotal: optSubtotal,
              optionsBreakdown: activeOptBreakdown,
              unitPrice: refUnitPrice + optAddons,
              subtotal,
              totalTax: tax,
              estimatedShipping: shipping,
              designServiceFee: designFeeNum,
              grandTotal: Math.round((subtotal + tax + shipping) * 100) / 100,
              items: [
                {
                  productId: 'pending',
                  productName: 'Pending Product Preview',
                  quantity: previewQty,
                  startingReferenceRate: startingRef,
                  referenceUnitPrice: refUnitPrice,
                  baseUnitPrice: refUnitPrice,
                  baseSubtotal: basePrintSubtotal,
                  optionsBreakdown: activeOptBreakdown,
                  optionsSubtotal: optSubtotal,
                  conditionalChargesBreakdown: [],
                  conditionalChargesSubtotal: 0,
                  designServiceFee: designFeeNum,
                  preTaxSubtotal: subtotal,
                  taxSubtotal: tax,
                  lineTotal: Math.round((subtotal + tax) * 100) / 100,
                },
              ],
            });
          }
        }
      } catch (err: any) {
        if (active) {
          setPreviewError(err?.message || 'Selected configuration is unavailable in current matrix.');
          setPreviewQuote(null);
        }
      } finally {
        if (active) setIsCalculatingPreview(false);
      }
    };

    const timer = setTimeout(runQuote, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [
    productId,
    previewSelections,
    previewQty,
    previewWantsDesign,
    basePrice,
    designServiceFee,
    matrixRows,
    optionGroups,
  ]);

  // ---------------------------------------------------------------------------
  // 7. RENDER WORKSPACE
  // ---------------------------------------------------------------------------
  return (
    <div className="w-full space-y-6">
      {/* ================================================================== */}
      {/* SECTION 1: STUDIO HEADER & VIEW SWITCHER                           */}
      {/* ================================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Step 04
              </span>
              <span className="text-slate-300">•</span>
              <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">
                Commercial Pricing Matrix
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
              Configure sellable combination rates across quantity volume runs. You can auto-generate starter combinations or add and edit exact rates manually.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* View Switcher: Matrix Table vs Option Surcharges */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActivePricingView('MATRIX')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activePricingView === 'MATRIX'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RiTableLine className="w-4 h-4 text-amber-600" />
                <span>Combination Pricing Table</span>
                {sellableCombinations.length > 0 && (
                  <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded-full">
                    {sellableCombinations.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActivePricingView('OPTIONS')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  activePricingView === 'OPTIONS'
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RiPriceTag3Line className="w-4 h-4 text-blue-600" />
                <span>Option Surcharges (+₹)</span>
              </button>
            </div>

            {/* Design Pricing from Step 3 Notice */}
            <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-950 font-medium shrink-0">
              <RiPaletteLine className="w-4 h-4 text-amber-700 shrink-0" />
              <div>
                <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-900">
                  Step 3 Design Rate
                </span>
                <span className="text-[11px] text-amber-800">
                  {designServiceRequirement === 'DISABLED'
                    ? 'Design Service Disabled'
                    : `₹${designServiceFee} (Scope active)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* SECTION 2: COMBINATION PRICING TABLE (PRIMARY VIEW)                 */}
      {/* ================================================================== */}
      {activePricingView === 'MATRIX' && (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card space-y-5">
          {/* 1. Combination Groups Selection */}
          <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RiStackLine className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                  Select Combination Groups:
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                {participatingGroupCodes.length} of {optionGroups.length} groups selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {optionGroups.length === 0 ? (
                <span className="text-xs text-slate-400 italic">
                  No option groups configured yet. Configure groups in Step 2 first.
                </span>
              ) : (
                optionGroups.map((g) => {
                  const isPart = participatingGroupCodes.includes(g.code);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => toggleParticipatingGroup(g.code)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                        isPart
                          ? 'bg-amber-100 text-amber-950 border border-amber-300 shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isPart}
                        readOnly
                        className="w-3.5 h-3.5 rounded border-amber-400 text-amber-600 pointer-events-none"
                      />
                      <span>{g.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">({g.code})</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Quantity Tiers & Action Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            {/* Quantity Tiers Chips */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono font-bold text-slate-600 uppercase">
                Quantity Tiers:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quantityColumns.map((q) => (
                  <span
                    key={q}
                    className="inline-flex items-center gap-1 bg-white border border-slate-300 text-slate-800 font-mono text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs"
                  >
                    <span>{q.toLocaleString()} pcs</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveQuantityColumn(q)}
                      className="text-slate-400 hover:text-rose-600 p-0.5 cursor-pointer"
                      title="Remove Tier"
                    >
                      <RiCloseLine className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setIsAddQtyModalOpen(true)}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                >
                  <RiAddLine className="w-3.5 h-3.5" />
                  <span>Add Tier</span>
                </button>
              </div>
            </div>

            {/* Right Toolbar: Search, Auto-Config, Add Manual Entry */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <div className="relative min-w-[180px]">
                <RiSearch2Line className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search combinations..."
                  value={comboSearchQuery}
                  onChange={(e) => setComboSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:outline-none focus:border-amber-500 shadow-2xs"
                />
              </div>

              <button
                type="button"
                onClick={() => handleGenerateStarterCombinations()}
                className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title="Automatically calculate combinations and tiered rates from reference rate and volume discounts"
              >
                <RiSparklingFill className="w-4 h-4 text-indigo-600" />
                <span>Auto-Config Rates</span>
              </button>

              <button
                type="button"
                onClick={handleOpenAddComboModal}
                className="px-4 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-slate-950 text-xs font-black rounded-lg shadow-2xs border border-amber-300 transition cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <RiAddLine className="w-4 h-4" />
                <span>+ Add Manual Entry</span>
              </button>
            </div>
          </div>

          {/* 3. Combinations Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-600 font-mono">
                  {optionGroups
                    .filter((g) => participatingGroupCodes.includes(g.code))
                    .map((g) => (
                      <th key={g.id} className="py-3 px-3.5 whitespace-nowrap">
                        {g.name}
                      </th>
                    ))}
                  {quantityColumns.map((q) => (
                    <th key={q} className="py-3 px-3.5 text-right whitespace-nowrap">
                      <div>{q.toLocaleString()} pcs</div>
                      <span className="text-[9px] font-normal text-slate-400 lowercase">total ₹</span>
                    </th>
                  ))}
                  <th className="py-3 px-3.5 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredCombinations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={participatingGroupCodes.length + quantityColumns.length + 1}
                      className="p-12 text-center text-slate-400 italic space-y-2"
                    >
                      <p className="text-sm font-semibold text-slate-600">No combinations in table yet.</p>
                      <p className="text-xs text-slate-400">
                        Click <strong className="text-indigo-600">&quot;Auto-Config Rates&quot;</strong> to automatically generate combinations with tiered prices, or <strong className="text-amber-800">&quot;+ Add Manual Entry&quot;</strong> to add rows manually.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredCombinations.map((combo) => (
                    <tr key={combo.id} className="hover:bg-slate-50/70 transition-colors">
                      {optionGroups
                        .filter((g) => participatingGroupCodes.includes(g.code))
                        .map((g) => {
                          const val = combo.attributes[g.code];
                          const opt = g.options.find((o) => o.value === val);
                          return (
                            <td key={g.id} className="py-2.5 px-3.5 whitespace-nowrap">
                              <span className="font-bold text-slate-900">
                                {opt?.label || val || '—'}
                              </span>
                            </td>
                          );
                        })}

                      {quantityColumns.map((q) => {
                        const priceVal = combo.pricesByQty[q];
                        const isMissing = priceVal === undefined || priceVal <= 0;
                        const unitRate = priceVal > 0 ? (priceVal / q).toFixed(2) : '—';

                        return (
                          <td key={q} className="py-2 px-3.5 text-right">
                            <div className="inline-flex flex-col items-end">
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-[11px]">
                                  ₹
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={priceVal !== undefined ? priceVal : ''}
                                  onChange={(e) =>
                                    handleCellPriceChange(
                                      combo,
                                      q,
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  className={`w-28 pl-6 pr-2.5 py-1 text-right font-mono font-bold text-xs rounded-lg border focus:outline-none ${
                                    isMissing
                                      ? 'border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500'
                                      : 'border-slate-300 bg-white text-slate-900 focus:border-slate-900'
                                  }`}
                                  placeholder="0.00"
                                />
                              </div>
                              {!isMissing && (
                                <span className="text-[9px] font-mono text-slate-500 mt-0.5">
                                  ₹{unitRate}/pc
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenDuplicateModal(combo)}
                            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
                            title="Duplicate Combination"
                          >
                            <RiFileCopyLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCombination(combo)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition cursor-pointer"
                            title="Delete Combination"
                          >
                            <RiDeleteBin7Line className="w-3.5 h-3.5" />
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
      )}

      {/* ================================================================== */}
      {/* SECTION 3: OPTION-BASED SURCHARGES (SECONDARY VIEW)                */}
      {/* ================================================================== */}
      {activePricingView === 'OPTIONS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Product Option Groups List */}
          <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <RiStackLine className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-display">
                  Product Option Groups
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {optionGroups.length} Groups
              </span>
            </div>

            <div className="space-y-2">
              {optionGroups.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic">
                  No option groups configured. Configure groups in Step 2 first.
                </div>
              ) : (
                optionGroups.map((grp) => {
                  const isSelected = activeGroup?.id === grp.id;
                  const status = groupStatusMap.get(grp.id);

                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => {
                        setSelectedGroupId(grp.id);
                        setActiveMethodOverride(null);
                      }}
                      className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-400 bg-amber-50/70 shadow-sm ring-2 ring-amber-400/20'
                          : 'border-slate-200/90 bg-white hover:bg-slate-50/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block font-display">
                            {grp.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400 block">
                            {grp.code} • {grp.options.length} choice{grp.options.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        {status && (
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${status.badgeClass}`}
                          >
                            {status.label}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
                        <span className="truncate">{status?.description}</span>
                        <RiArrowRightLine
                          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                            isSelected ? 'text-amber-700 translate-x-0.5' : 'text-slate-300'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Selected Group Option Surcharges Workspace */}
          <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card space-y-6">
            {!activeGroup ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                Select an option group from the left panel to configure its option charges.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-slate-900 font-display">
                        {activeGroup.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {activeGroup.code}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Configure additive surcharges (+₹) or mark this group as included in the base rate.
                    </p>
                  </div>

                  {activeGroupStatus?.hasError && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-bold flex items-center gap-1.5">
                      <RiAlertFill className="w-4 h-4 text-rose-600" />
                      <span>{activeGroupStatus.errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Method Switcher between Option Surcharges & Included in Base */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveMethodOverride('OPTION')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentMethod === 'OPTION'
                        ? 'border-blue-500 bg-blue-50/70 shadow-2xs ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 block font-display">
                        Option-Based (+₹ Surcharge)
                      </span>
                      {currentMethod === 'OPTION' && <RiCheckLine className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Independent additive surcharge per choice.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveMethodOverride('INCLUDED')}
                    className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      currentMethod === 'INCLUDED'
                        ? 'border-emerald-500 bg-emerald-50/70 shadow-2xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 block font-display">
                        Included in Base (₹0.00)
                      </span>
                      {currentMethod === 'INCLUDED' && <RiCheckLine className="w-4 h-4 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      No separate charge; covered by base printing rate.
                    </p>
                  </button>
                </div>

                {/* Feedback Alert */}
                {optionSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                    <RiCheckLine className="w-4 h-4 text-emerald-600" />
                    <span>{optionSuccessMsg}</span>
                  </div>
                )}

                {/* Option-Based Table */}
                {currentMethod === 'OPTION' && (
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100/80 border-b border-slate-200 text-slate-600 uppercase font-mono text-[10px]">
                          <tr>
                            <th className="py-2.5 px-3">Option Choice</th>
                            <th className="py-2.5 px-3">Code Value</th>
                            <th className="py-2.5 px-3">Default</th>
                            <th className="py-2.5 px-3 w-44">Additional Surcharge (₹)</th>
                            <th className="py-2.5 px-3 w-36">Calculation Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {activeGroup.options
                            .filter((opt) => opt.isActive !== false)
                            .map((opt) => {
                              const draft = optionChargesDraft[opt.id] || { amount: '0', type: 'FIXED' };
                              const isInvalid = parseFloat(draft.amount) < 0;

                              return (
                                <tr key={opt.id} className="hover:bg-slate-50/60 transition-colors">
                                  <td className="py-2.5 px-3 font-bold text-slate-900">{opt.label}</td>
                                  <td className="py-2.5 px-3 font-mono text-slate-500">{opt.value}</td>
                                  <td className="py-2.5 px-3">
                                    {opt.isDefault ? (
                                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-900 rounded">
                                        Default
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <div className="relative">
                                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                                        +₹
                                      </span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="any"
                                        value={draft.amount}
                                        onChange={(e) =>
                                          handleOptionChargeChange(opt.id, 'amount', e.target.value)
                                        }
                                        className={`w-full pl-8 pr-2.5 py-1 bg-white border rounded-lg font-mono font-bold text-xs ${
                                          isInvalid
                                            ? 'border-rose-400 text-rose-700 bg-rose-50'
                                            : 'border-slate-300 text-slate-900 focus:border-blue-500'
                                        }`}
                                      />
                                    </div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <select
                                      value={draft.type}
                                      onChange={(e) =>
                                        handleOptionChargeChange(opt.id, 'type', e.target.value)
                                      }
                                      className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer"
                                    >
                                      <option value="FIXED">Flat (per unit)</option>
                                      <option value="PERCENTAGE">% of Base</option>
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSaveOptionCharges}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <RiCheckLine className="w-4 h-4" />
                        <span>Save Option-Based Rates</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Included in Base UI */}
                {currentMethod === 'INCLUDED' && (
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase font-mono block">
                        Active Choices in &quot;{activeGroup.name}&quot; (+₹0.00 each):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {activeGroup.options
                          .filter((opt) => opt.isActive !== false)
                          .map((opt) => (
                            <div
                              key={opt.id}
                              className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs"
                            >
                              <span className="font-bold text-slate-800">{opt.label}</span>
                              <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">
                                ₹0.00
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleMarkIncludedInBase}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                      >
                        <RiCheckLine className="w-4 h-4" />
                        <span>Confirm Included in Base Price</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SECTION 8: LIVE STOREFRONT PRICING SIMULATOR PREVIEW           */}
      {/* ============================================================== */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <RiPlayCircleLine className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 font-display">
              Live Storefront Pricing Preview
            </h3>
          </div>
          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
            Authoritative Server Quote Engine
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Test customer configurations live. The quote calculations below use the server quote engine to test base rates, option charges, Step 3 design pricing, tax, and delivery.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Left: Input Selectors */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {optionGroups.map((grp) => (
                <div key={grp.id} className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    {grp.name}
                  </label>
                  <select
                    value={previewSelections[grp.code] || ''}
                    onChange={(e) =>
                      setPreviewSelections((prev) => ({ ...prev, [grp.code]: e.target.value }))
                    }
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer"
                  >
                    {grp.options
                      .filter((opt) => opt.isActive !== false)
                      .map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.label} {Number(opt.priceModifier) > 0 ? `(+₹${opt.priceModifier})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {/* Quantity Run Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-bold text-slate-700 block">
                Quantity Run Size
              </label>
              <div className="flex flex-wrap gap-1.5">
                {quantityColumns.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setPreviewQty(q)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${
                      previewQty === q
                        ? 'bg-slate-950 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {q.toLocaleString()} pcs
                  </button>
                ))}
              </div>
            </div>

            {/* Design Service Toggle */}
            {designServiceRequirement !== 'DISABLED' && (
              <div className="pt-2">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Artwork & Design Service
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewWantsDesign(false)}
                    className={`p-2 rounded-lg text-xs font-bold border transition text-left cursor-pointer ${
                      !previewWantsDesign
                        ? 'bg-slate-950 text-white border-slate-950'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Customer Supplied Artwork
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewWantsDesign(true)}
                    className={`p-2 rounded-lg text-xs font-bold border transition text-left cursor-pointer ${
                      previewWantsDesign
                        ? 'bg-amber-400 text-slate-950 border-amber-400 font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Design Assistance (+₹{designServiceFee})
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: Calculated Price Breakdown Card */}
          <div className="p-4 bg-slate-50/90 border border-slate-200 rounded-xl space-y-3">
            <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
              Authoritative Quote Calculation
            </span>

            {isCalculatingPreview ? (
              <div className="p-6 text-center text-xs text-slate-400 font-mono animate-pulse">
                Calculating authoritative pricing...
              </div>
            ) : previewError ? (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-bold flex items-start gap-2">
                <RiAlertFill className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span>Unavailable in Matrix</span>
                  <p className="text-[11px] font-normal text-rose-700 mt-0.5">{previewError}</p>
                </div>
              </div>
            ) : previewQuote ? (
              (() => {
                const item = previewQuote.items?.[0];
                const refRate = Number(item?.referenceUnitPrice ?? previewQuote.referenceUnitPrice ?? referenceUnitPrice);
                const baseUnit = Number(item?.baseUnitPrice ?? previewQuote.baseUnitPrice ?? refRate);
                const baseSub = Number(item?.baseSubtotal ?? previewQuote.baseSubtotal ?? Math.round(refRate * previewQty * 100) / 100);
                const optSub = Number(item?.optionsSubtotal ?? previewQuote.optionsSubtotal ?? 0);
                const hasTierAdjustment = Math.abs(baseUnit - refRate) > 0.0001;

                return (
                  <div className="space-y-2.5 text-xs">
                    {/* Reference Base Rate */}
                    <div className="flex justify-between text-slate-700">
                      <div>
                        <span className="font-semibold block">Reference Base Rate</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Starting Ref: ₹{startingReferenceRate} ÷ MOQ {moq}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{refRate.toFixed(4)} / pc
                      </span>
                    </div>

                    {/* Base Print Subtotal */}
                    <div className="flex justify-between text-slate-700">
                      <div>
                        <span className="font-semibold block">Base Printing Price</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {previewQty} pcs × ₹{baseUnit.toFixed(4)}/pc
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(baseSub)}
                      </span>
                    </div>

                    {/* Tier Adjustment if rate differs */}
                    {hasTierAdjustment && (
                      <div className="flex justify-between text-blue-900 bg-blue-50/80 p-1.5 rounded-lg border border-blue-200 text-[11px]">
                        <span>Quantity Tier Adjustment</span>
                        <span className="font-mono font-bold">
                          {baseUnit < refRate ? '-' : '+'}{formatCurrency(Math.abs(Math.round((baseUnit - refRate) * previewQty * 100) / 100))}
                        </span>
                      </div>
                    )}

                    {/* Option Surcharges (Distinct from Base) */}
                    {optSub > 0 && (
                      <div className="flex justify-between text-slate-700">
                        <div>
                          <span className="font-semibold block">Option Surcharges</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            Independent choice modifiers
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">
                          +{formatCurrency(optSub)}
                        </span>
                      </div>
                    )}

                    {/* Design Service Fee (Step 3) - Single Flat Fee or ₹0 */}
                    <div className="flex justify-between text-slate-700">
                      <div>
                        <span className="font-semibold block">Design Service Fee</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {previewWantsDesign
                            ? 'Single flat fee applied once'
                            : 'Customer Artwork Provided (No Design Fee)'}
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {previewWantsDesign && Number(previewQuote.designServiceFee) > 0
                          ? `+${formatCurrency(Number(previewQuote.designServiceFee))}`
                          : '₹0.00'}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600 pt-2 border-t border-slate-200">
                      <span>Pre-Tax Subtotal</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(Number(previewQuote.subtotal || 0))}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Estimated GST (18%)</span>
                      <span className="font-mono font-bold text-slate-900">
                        +{formatCurrency(Number(previewQuote.totalTax || 0))}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-600">
                      <span>Shipping (Courier)</span>
                      <span className="font-mono font-bold text-slate-900">
                        {Number(previewQuote.estimatedShipping) === 0 ? (
                          <span className="text-emerald-700 font-bold">FREE</span>
                        ) : (
                          `+${formatCurrency(Number(previewQuote.estimatedShipping || 0))}`
                        )}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline">
                      <div>
                        <span className="text-xs font-black uppercase text-slate-900 block font-display">
                          Grand Total
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          ₹{(Number(previewQuote.grandTotal || 0) / Math.max(1, previewQty)).toFixed(2)}/pc all-inclusive
                        </span>
                      </div>
                      <span className="text-lg font-black font-mono text-slate-950">
                        {formatCurrency(Number(previewQuote.grandTotal || 0))}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : null}
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODALS: ADD COMBINATION & ADD QUANTITY TIER                        */}
      {/* ================================================================== */}
      {/* Modal 1: Add/Duplicate Combination */}
      {isAddComboModalOpen && (
        <Modal
          isOpen={isAddComboModalOpen}
          onClose={() => setIsAddComboModalOpen(false)}
          title="Add Manual Combination Entry"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select option choices for the participating groups and enter manual total prices for each quantity run.
            </p>

            {comboFormError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-bold flex items-center gap-2">
                <RiAlertFill className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{comboFormError}</span>
              </div>
            )}

            {/* Participating groups selects */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optionGroups
                .filter((g) => participatingGroupCodes.includes(g.code))
                .map((grp) => (
                  <div key={grp.id} className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">{grp.name}</label>
                    <select
                      value={newComboSelections[grp.code] || ''}
                      onChange={(e) =>
                        setNewComboSelections((prev) => ({ ...prev, [grp.code]: e.target.value }))
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-slate-900 cursor-pointer"
                    >
                      {grp.options
                        .filter((opt) => opt.isActive !== false)
                        .map((opt) => (
                        <option key={opt.id} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>

            {/* Quantity price inputs */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <span className="text-xs font-bold text-slate-800 block">
                Prices per Quantity Run Size (Total Amount in ₹):
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                {quantityColumns.map((q) => (
                  <div key={q} className="space-y-1">
                    <label className="text-[11px] font-mono text-slate-600 block">
                      {q.toLocaleString()} pcs
                    </label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        ₹
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={newComboPrices[q] || ''}
                        onChange={(e) =>
                          setNewComboPrices((prev) => ({ ...prev, [q]: e.target.value }))
                        }
                        className="w-full pl-7 pr-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddComboModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNewCombination}
                className="px-4 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-slate-950 text-xs font-black rounded-lg shadow-xs transition"
              >
                Add Combination Entry
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal 2: Add Quantity Tier */}
      {isAddQtyModalOpen && (
        <Modal
          isOpen={isAddQtyModalOpen}
          onClose={() => setIsAddQtyModalOpen(false)}
          title="Add Quantity Tier"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Add a new quantity column across all sellable combinations in the matrix (e.g. 2000, 5000).
            </p>

            {tierError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-bold">
                {tierError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">Quantity Run (pcs)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={newTierQty}
                onChange={(e) => setNewTierQty(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddQtyModalOpen(false)}
                className="px-3.5 py-1.5 border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddQuantityTier}
                className="px-4 py-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-slate-950 text-xs font-black rounded-lg shadow-xs transition"
              >
                Add Tier Column
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
