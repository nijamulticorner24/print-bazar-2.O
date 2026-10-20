'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  DynamicProduct,
  ProductOptionGroup,
  ProductOption,
  ProductConfigurationRule,
  api,
  resolveImageUrl,
  ProductOptionRequirement,
} from '@/lib/api';
import { resolveArtworkConditions, matchesRuleCondition } from '@/lib/artwork-rule-resolver';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { formatCurrency, getEstimatedDeliveryText } from '@/lib/utils';
import {
  RiUploadCloud2Line,
  RiCheckLine,
  RiAlertFill,
  RiCloseLine,
  RiInformationLine,
  RiPaletteLine,
  RiShieldCheckLine,
  RiShoppingCart2Line,
  RiFlashlightLine,
  RiFileTextLine,
  RiDeleteBinLine,
  RiArrowRightLine,
  RiTruckLine,
  RiTimeLine,
  RiRulerLine,
  RiLockLine,
  RiMapPin2Line,
  RiCameraLine,
  RiCheckDoubleLine,
} from 'react-icons/ri';
import { Button, Badge, Modal } from '@/components/ui';

export interface FlowArtworkState {
  fileUrl: string;
  storageKey?: string;
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  actualMegapixels?: number | null;
  requiredMegapixels?: number;
  qualityStatus?: 'PASSED' | 'WARNING' | 'NOT_APPLICABLE';
  warningMessage?: string | null;
  warningAccepted?: boolean;
}

export interface FlowReferenceImageState {
  fileUrl: string;
  storageKey?: string;
  originalFileName: string;
  fileSize?: number;
}

export interface ProductConfigurationResult {
  product: DynamicProduct;
  quantity: number;
  fieldValues: Record<string, any>;
  hasArtwork: boolean;
  artworkFile: FlowArtworkState | null;
  artworkFiles?: Record<string, FlowArtworkState>;
  hasReferenceImage: boolean;
  referenceImage: FlowReferenceImageState | null;
  hasDesignService: boolean;
  designNotes: string;
  deliveryMethod: 'COURIER' | 'STORE_PICKUP';
  shippingPincode?: string;
  paymentMethod: 'ONLINE';
  paymentMode: 'FULL' | 'SPLIT_50';
  advanceAmount: number;
  balanceAmount: number;
  subtotal: number;
  grandTotal: number;
  quote: any;
}

export interface LivePricingSummary {
  grandTotal: number;
  subtotal: number;
  unitPrice: number;
  quantity: number;
  totalTax: number;
  shippingAmount: number;
  isCalculating: boolean;
  appliedOffer?: any;
  quote?: any;
}

export type StepId = 'SPECIFICATIONS' | 'QUANTITY_ARTWORK' | 'REVIEW';

export interface ProductConfigurationFlowProps {
  product: DynamicProduct;
  initialQuantity?: number;
  initialFieldValues?: Record<string, any>;
  isPreviewMode?: boolean;
  onPriceChange?: (summary: LivePricingSummary) => void;
  onAddToCart?: (result: ProductConfigurationResult) => void | Promise<void>;
  onBuyNow?: (result: ProductConfigurationResult) => void | Promise<void>;
}

export function ProductConfigurationFlow({
  product,
  initialQuantity,
  initialFieldValues,
  isPreviewMode = false,
  onPriceChange,
  onAddToCart,
  onBuyNow,
}: ProductConfigurationFlowProps) {
  // ---------------------------------------------------------------------------
  // 1. EXTRACT OPTION GROUPS (Dynamic Setup Studio Architecture)
  // ---------------------------------------------------------------------------
  const rawGroups: ProductOptionGroup[] = useMemo(() => {
    if (product.optionGroups && product.optionGroups.length > 0) {
      return [...product.optionGroups].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    // Backward compatibility for legacy product structure
    if (product.fields && product.fields.length > 0) {
      return product.fields.map((f: any) => ({
        id: f.id,
        productId: product.id,
        name: f.label || f.name,
        code: f.key || f.code,
        inputType: f.type || 'SELECT',
        description: f.description,
        isRequired: Boolean(f.isRequired),
        isCustomerVisible: f.isCustomerVisible !== false,
        sortOrder: f.sortOrder || 0,
        isActive: true,
        options: (f.options || []).map((o: any) => ({
          id: o.id,
          groupId: f.id,
          label: o.label || o.name,
          value: o.value || o.code,
          priceModifierType: o.priceModifierType || 'FIXED',
          priceModifier: o.priceModifier || 0,
          sortOrder: o.sortOrder || 0,
          isDefault: Boolean(o.isDefault),
          isActive: o.isActive !== false,
          fileCount: o.fileCount,
          fileSlotLabels: o.fileSlotLabels,
          minMegapixels: o.minMegapixels,
        })),
      }));
    }
    return [];
  }, [product.optionGroups, product.fields, product.id]);

  // Selections state (groupCode -> selected option value)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = { ...(initialFieldValues || {}) };
    for (const group of rawGroups) {
      if (initial[group.code] === undefined && group.options && group.options.length > 0) {
        const defaultOpt = group.options.find((o) => o.isDefault && o.isActive) || group.options[0];
        if (defaultOpt) {
          initial[group.code] = defaultOpt.value;
        }
      }
    }
    return initial;
  });

  // Ensure defaults populated on initial load or group change
  useEffect(() => {
    setSelectedOptions((prev) => {
      let changed = false;
      const updated = { ...prev };
      for (const group of rawGroups) {
        if (updated[group.code] === undefined && group.options && group.options.length > 0) {
          const defaultOpt = group.options.find((o) => o.isDefault && o.isActive) || group.options[0];
          if (defaultOpt) {
            updated[group.code] = defaultOpt.value;
            changed = true;
          }
        }
      }
      return changed ? updated : prev;
    });
  }, [rawGroups]);

  // ---------------------------------------------------------------------------
  // 2. REAL-TIME CONDITIONAL RULES EVALUATION ENGINE
  // ---------------------------------------------------------------------------
  const {
    visibleGroups,
    groupStatusMap,
    optionStatusMap,
    forcedArtworkRequired,
    artworkConfigOverrides,
  } = useMemo(() => {
    const rules: ProductConfigurationRule[] = product.configurationRules || [];
    const grpStatus: Record<
      string,
      { isRequired: boolean; isDisabled: boolean; disabledReason?: string; isHidden: boolean }
    > = {};
    const optStatus: Record<string, { isVisible: boolean; isDisabled: boolean }> = {};
    let forceArtwork = false;
    const overrides: Array<{
      artworkStatus?: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';
      slotCount?: number;
      slotLabels?: string[];
      minMegapixels?: number;
      maxFileSizeMb?: number;
      designServicePolicy?: 'STANDARD' | 'REQUIRE_BRIEF' | 'SKIP_BRIEF';
    }> = [];

    // Initialize group statuses from baseline
    for (const g of rawGroups) {
      grpStatus[g.code] = {
        isRequired: g.isRequired,
        isDisabled: false,
        isHidden: g.isCustomerVisible === false,
      };
    }

    // Evaluate rules deterministically
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const conditionMet = matchesRuleCondition(rule, selectedOptions);

      // 1. Group / Option Actions (Target Group specific)
      if (rule.targetGroupCode && grpStatus[rule.targetGroupCode]) {
        switch (rule.actionType) {
          case 'HIDE':
            if (conditionMet) {
              // GUARD: Printing location must NOT be hidden solely because design is not required
              const isPrintingLoc = /print(ing)?_?(loc(ation)?|side)/i.test(rule.targetGroupCode);
              const isDesignCond = /design/i.test(rule.conditionGroupCode || '');
              if (isPrintingLoc && isDesignCond) {
                break;
              }

              if (rule.targetOptionValue) {
                optStatus[`${rule.targetGroupCode}:${rule.targetOptionValue}`] = {
                  isVisible: false,
                  isDisabled: false,
                };
              } else {
                grpStatus[rule.targetGroupCode].isHidden = true;
              }
            }
            break;
          case 'SHOW':
            if (!conditionMet) {
              const isPrintingLoc = /print(ing)?_?(loc(ation)?|side)/i.test(rule.targetGroupCode);
              const isDesignCond = /design/i.test(rule.conditionGroupCode || '');
              if (isPrintingLoc && isDesignCond) {
                break;
              }

              if (rule.targetOptionValue) {
                optStatus[`${rule.targetGroupCode}:${rule.targetOptionValue}`] = {
                  isVisible: false,
                  isDisabled: false,
                };
              } else {
                grpStatus[rule.targetGroupCode].isHidden = true;
              }
            }
            break;
          case 'REQUIRE':
            if (conditionMet) {
              grpStatus[rule.targetGroupCode].isRequired = true;
            }
            break;
          case 'DISABLE':
            if (conditionMet) {
              if (rule.targetOptionValue) {
                optStatus[`${rule.targetGroupCode}:${rule.targetOptionValue}`] = {
                  isVisible: true,
                  isDisabled: true,
                };
              } else {
                grpStatus[rule.targetGroupCode].isDisabled = true;
                grpStatus[rule.targetGroupCode].disabledReason = `Conditional on ${rule.conditionGroupCode}`;
              }
            }
            break;
        }
      }

      // 2. Artwork Target Effects (Independent of targetGroupCode)
      if (conditionMet) {
        if (rule.actionType === 'REQUIRE_ARTWORK_FILES') {
          forceArtwork = true;
          if (rule.actionPayload && typeof rule.actionPayload === 'object') {
            overrides.push({ ...rule.actionPayload, artworkStatus: 'REQUIRED' });
          } else {
            overrides.push({ artworkStatus: 'REQUIRED' });
          }
        } else if (rule.actionType === 'CONFIGURE_ARTWORK') {
          if (rule.actionPayload && typeof rule.actionPayload === 'object') {
            overrides.push(rule.actionPayload);
          }
        }
      }
    }

    const filtered = rawGroups.filter((g) => !grpStatus[g.code]?.isHidden);
    return {
      visibleGroups: filtered,
      groupStatusMap: grpStatus,
      optionStatusMap: optStatus,
      forcedArtworkRequired: forceArtwork,
      artworkConfigOverrides: overrides,
    };
  }, [rawGroups, product.configurationRules, selectedOptions]);

  // Handle SET_DEFAULT conditional rules
  useEffect(() => {
    const rules: ProductConfigurationRule[] = product.configurationRules || [];
    for (const rule of rules) {
      if (!rule.isActive || rule.actionType !== 'SET_DEFAULT' || !rule.targetGroupCode || !rule.targetOptionValue) continue;
      const conditionMet = matchesRuleCondition(rule, selectedOptions);
      if (conditionMet && selectedOptions[rule.targetGroupCode] !== rule.targetOptionValue) {
        setSelectedOptions((prev) => ({ ...prev, [rule.targetGroupCode!]: rule.targetOptionValue }));
      }
    }
  }, [product.configurationRules, selectedOptions]);

  // Auto-sanitize selections if an option is hidden or disabled by rule
  useEffect(() => {
    let changed = false;
    const sanitized = { ...selectedOptions };
    for (const group of visibleGroups) {
      const val = sanitized[group.code];
      const optKey = `${group.code}:${val}`;
      const isOptHidden = optionStatusMap[optKey]?.isVisible === false;
      const isOptDisabled = optionStatusMap[optKey]?.isDisabled === true;
      if (isOptHidden || isOptDisabled) {
        const validOpt = group.options?.find((o) => {
          const k = `${group.code}:${o.value}`;
          return o.isActive && optionStatusMap[k]?.isVisible !== false && !optionStatusMap[k]?.isDisabled;
        });
        if (validOpt) {
          sanitized[group.code] = validOpt.value;
          changed = true;
        }
      }
    }
    if (changed) {
      setSelectedOptions(sanitized);
    }
  }, [visibleGroups, optionStatusMap, selectedOptions]);

  const handleOptionChange = (groupCode: string, val: any) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupCode]: val,
    }));
  };

  // ---------------------------------------------------------------------------
  // 3. ARTWORK & DYNAMIC MULTI-SLOT RESOLUTION ENGINE
  // ---------------------------------------------------------------------------
  const resolvedArtwork = useMemo(() => {
    return resolveArtworkConditions(
      product.configurationRules || [],
      selectedOptions,
      {
        artworkRequirement: product.artworkRequirement,
        maxArtworkFileSizeMb: product.maxArtworkFileSizeMb ?? undefined,
        minimumArtworkMegapixels: product.minimumArtworkMegapixels ?? undefined,
        artworkFileFormats: product.artworkFileFormats,
        designServiceRequirement: product.designServiceRequirement,
      },
      rawGroups
    );
  }, [product, selectedOptions, rawGroups]);

  const artworkReq = resolvedArtwork.artworkStatus;
  const maxFileSizeMb = resolvedArtwork.maxArtworkFileSizeMb;
  const minMegapixels = resolvedArtwork.minimumArtworkMegapixels;
  const allowedFormats = resolvedArtwork.allowedFormats;
  const activeSlotConfigs = resolvedArtwork.slots;

  const [slotFiles, setSlotFiles] = useState<Record<string, FlowArtworkState>>({});
  const [uploadingSlots, setUploadingSlots] = useState<Record<string, boolean>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string>>({});

  // Active slot keys set for branch tracking
  const activeSlotKeys = useMemo(() => new Set(activeSlotConfigs.map((s) => s.slotKey)), [activeSlotConfigs]);

  // Only return files whose slots are actively configured; inactive branch files are omitted
  const activeSlotFiles = useMemo(() => {
    const res: Record<string, FlowArtworkState> = {};
    for (const [k, v] of Object.entries(slotFiles)) {
      if (activeSlotKeys.has(k)) {
        res[k] = v;
      }
    }
    return res;
  }, [activeSlotKeys, slotFiles]);

  // Prune inactive branch files from state whenever branch changes
  useEffect(() => {
    setSlotFiles((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (!activeSlotKeys.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeSlotKeys]);

  // File upload handler with resolution and size check
  const handleFileUpload = async (slotKey: string, file: File) => {
    setUploadingSlots((prev) => ({ ...prev, [slotKey]: true }));
    setSlotErrors((prev) => ({ ...prev, [slotKey]: '' }));

    const slotCfg = activeSlotConfigs.find((s) => s.slotKey === slotKey);
    const targetMinMP = slotCfg?.minMegapixels || minMegapixels;

    // Check file size
    const maxBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setSlotErrors((prev) => ({
        ...prev,
        [slotKey]: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${maxFileSizeMb}MB.`,
      }));
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
      return;
    }

    // Client-side image resolution check if raster image
    const isImageFile = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(file.name);
    if (isImageFile && !/\.svg$/i.test(file.name)) {
      try {
        const imageRes = await new Promise<{ width: number; height: number; megapixels: number }>((resolve, reject) => {
          const img = new Image();
          const objectUrl = URL.createObjectURL(file);
          img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const w = img.naturalWidth || img.width;
            const h = img.naturalHeight || img.height;
            const mp = Math.round(((w * h) / 1000000) * 100) / 100;
            resolve({ width: w, height: h, megapixels: mp });
          };
          img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Invalid image. Could not read image dimensions.'));
          };
          img.src = objectUrl;
        });

        if (imageRes.megapixels < targetMinMP) {
          setSlotErrors((prev) => ({
            ...prev,
            [slotKey]: `Image resolution is ${imageRes.megapixels} MP (${imageRes.width}×${imageRes.height}px). Minimum ${targetMinMP} MP is recommended for crisp printing.`,
          }));
        }
      } catch (err: any) {
        console.warn('Image verification check:', err);
      }
    }

    try {
      const res = await api.uploadArtwork(file, product.id, targetMinMP);
      const state: FlowArtworkState = {
        fileUrl: res.fileUrl,
        storageKey: res.storageKey,
        originalFileName: res.originalFileName,
        fileSize: res.fileSize,
        mimeType: res.mimeType,
        width: res.width,
        height: res.height,
        actualMegapixels: res.actualMegapixels,
        requiredMegapixels: targetMinMP,
        qualityStatus: res.qualityStatus,
        warningMessage: res.warningMessage,
        warningAccepted: res.qualityStatus === 'PASSED',
      };
      setSlotFiles((prev) => ({ ...prev, [slotKey]: state }));
    } catch (err: any) {
      setSlotErrors((prev) => ({
        ...prev,
        [slotKey]: err?.message || 'Failed to upload artwork file',
      }));
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotKey]: false }));
    }
  };

  const handleFileRemove = (slotKey: string) => {
    setSlotFiles((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setSlotErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // 4. DESIGN ASSISTANCE STATE
  // ---------------------------------------------------------------------------
  const designReq: ProductOptionRequirement = product.designServiceRequirement || 'DISABLED';
  const baselineDesignFee = Number((product as any).designServiceFee ?? (product as any).designServicePrice) || 0;
  const [wantsDesignService, setWantsDesignService] = useState<boolean>(() => designReq === 'REQUIRED');
  const [designNotes, setDesignNotes] = useState<string>('');

  useEffect(() => {
    if (designReq === 'REQUIRED') {
      setWantsDesignService(true);
    } else if (designReq === 'DISABLED') {
      setWantsDesignService(false);
    }
  }, [designReq]);

  // Sync wantsDesignService with rule policy or selected options
  useEffect(() => {
    if (resolvedArtwork.requireDesignBrief) {
      setWantsDesignService(true);
      return;
    }
    const designOpt =
      selectedOptions['design_service'] ??
      selectedOptions['design_required'] ??
      selectedOptions['design'];
    if (designOpt !== undefined) {
      const isYes =
        String(designOpt).toLowerCase() === 'yes' ||
        String(designOpt).toLowerCase() === 'true' ||
        String(designOpt).toLowerCase() === 'required';
      setWantsDesignService(isYes);
    }
  }, [resolvedArtwork.requireDesignBrief, selectedOptions]);

  // Delivery & Payment
  const [deliveryMethod, setDeliveryMethod] = useState<'COURIER' | 'STORE_PICKUP'>('COURIER');
  const [shippingPincode, setShippingPincode] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pb2_user_pincode') || '';
    }
    return '';
  });
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'SPLIT_50'>('FULL');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);

  // ---------------------------------------------------------------------------
  // 5. PRODUCTION QUANTITY ENGINE (Dynamic Combination Pricing Support)
  // ---------------------------------------------------------------------------
  const isCombinationPricing = useMemo(() => {
    if (product.pricingModel === 'BASE_ONLY') return false;
    if (!product.pricingMatrices || product.pricingMatrices.length === 0) return false;
    return product.pricingMatrices.some((m: any) => {
      const c = m.attributeCombination || {};
      const keys = Object.keys(c).filter(
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
          ].includes(k),
      );
      return keys.length > 0;
    });
  }, [product.pricingModel, product.pricingMatrices]);

  const matchingCombinationTiers = useMemo(() => {
    if (!isCombinationPricing || !product.pricingMatrices) return [];

    const matching = product.pricingMatrices.filter((m: any) => {
      const c = m.attributeCombination || {};
      const keys = Object.keys(c).filter(
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
          ].includes(k),
      );
      if (keys.length === 0) return false;
      return keys.every((k) => String(selectedOptions[k]) === String(c[k]));
    });

    return matching
      .map((m: any) => {
        const c = m.attributeCombination || {};
        const qty = Number(m.minQty || c.quantity || 1);
        const totalPrice = Number(c.price ?? c.totalPrice ?? Number(m.unitPrice || 0) * qty);
        const unitPrice = qty > 0 ? totalPrice / qty : Number(m.unitPrice || 0);
        const isExcluded = Boolean(c.isExcluded || c.status === 'EXCLUDED');
        return {
          id: m.id,
          quantity: qty,
          totalPrice,
          unitPrice,
          isExcluded,
          exclusionReason: c.exclusionReason,
        };
      })
      .filter((t) => t.isExcluded || t.totalPrice > 0 || t.unitPrice > 0)
      .sort((a, b) => a.quantity - b.quantity);
  }, [isCombinationPricing, product.pricingMatrices, selectedOptions]);

  const validCombinationTiers = useMemo(() => {
    return matchingCombinationTiers.filter((t) => !t.isExcluded && t.totalPrice > 0);
  }, [matchingCombinationTiers]);

  const hasActiveCombinationTiers = isCombinationPricing && validCombinationTiers.length > 0;
  const isExplicitlyExcluded = isCombinationPricing && matchingCombinationTiers.some((t) => t.isExcluded);
  const isMissingMatrixCombo = isCombinationPricing && product.pricingModel === 'MATRIX' && validCombinationTiers.length === 0;

  const minQty = Math.max(1, Number(product.minQuantity) || 1);
  const maxQty = Number(product.maxQuantity) || 100000;
  const rawStep = Number((product as any).quantityStep);
  const qtyStep = rawStep > 0 ? rawStep : minQty >= 100 ? 100 : minQty >= 50 ? 50 : 25;

  const [quantity, setQuantity] = useState<number>(() => {
    if (hasActiveCombinationTiers && validCombinationTiers.length > 0) {
      return validCombinationTiers[0].quantity;
    }
    if (initialQuantity && initialQuantity >= minQty) return initialQuantity;
    return minQty;
  });

  // Automatically update quantity when selected combination changes to one of its configured quantities
  useEffect(() => {
    if (hasActiveCombinationTiers && validCombinationTiers.length > 0) {
      if (!validCombinationTiers.some((t) => t.quantity === quantity)) {
        setQuantity(validCombinationTiers[0].quantity);
      }
    } else if (quantity < minQty) {
      setQuantity(minQty);
    }
  }, [hasActiveCombinationTiers, validCombinationTiers, quantity, minQty]);

  const quickPresets = useMemo(() => {
    const list = [
      minQty,
      minQty + 1 * qtyStep,
      minQty + 2 * qtyStep,
      minQty + 4 * qtyStep,
      minQty + 9 * qtyStep,
      minQty + 19 * qtyStep,
      minQty + 49 * qtyStep,
    ].filter((v, i, arr) => v <= maxQty && arr.indexOf(v) === i);
    return list.slice(0, 6);
  }, [minQty, maxQty, qtyStep]);

  // Reference Unit Price Calculation: Starting Reference Rate ÷ MOQ
  const referenceUnitPrice = useMemo(() => {
    const startingRate = Number(product.basePrice || 0);
    const mQty = Math.max(1, Number(product.minQuantity) || 1);
    return startingRate > 0 ? Math.round((startingRate / mQty) * 10000) / 10000 : 0;
  }, [product.basePrice, product.minQuantity]);

  // Option price modifiers fallback total (per-unit and fixed)
  const fallbackOptionModifiers = useMemo(() => {
    let perUnit = 0;
    let fixed = 0;
    for (const group of visibleGroups) {
      const selectedVal = selectedOptions[group.code];
      if (selectedVal === undefined || selectedVal === null) continue;
      const opt = group.options?.find((o) => String(o.value) === String(selectedVal));
      if (!opt) continue;
      const mod = Number(opt.priceModifier || 0);
      if (mod <= 0) continue;
      if (opt.priceModifierType === 'PERCENTAGE') {
        perUnit += (referenceUnitPrice * mod) / 100;
      } else {
        perUnit += mod;
      }
    }
    return { perUnit, fixed };
  }, [visibleGroups, selectedOptions, referenceUnitPrice]);

  // ---------------------------------------------------------------------------
  // 6. LIVE AUTHORITATIVE QUOTE ENGINE
  // ---------------------------------------------------------------------------
  const [quote, setQuote] = useState<any>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    let isCurrent = true;
    const fetchQuote = async () => {
      setIsCalculatingQuote(true);
      setQuoteError(null);
      try {
        const optionPayload = Object.entries(selectedOptions).map(([optionCode, valueCode]) => ({
          optionCode,
          valueCode: String(valueCode),
        }));

        const q = await api.calculateQuote({
          productId: product.id,
          quantity: Number(quantity) || minQty,
          options: optionPayload,
          fieldValues: selectedOptions,
          hasArtwork: Object.keys(activeSlotFiles).length > 0,
          hasDesignService: wantsDesignService,
          deliveryMethod,
          shippingPincode:
            deliveryMethod === 'COURIER' && shippingPincode.trim().length >= 3
              ? shippingPincode.trim()
              : undefined,
          paymentMethod: 'ONLINE',
          isCod: false,
        });

        if (isCurrent) {
          setQuote(q);
        }
      } catch (err: any) {
        if (isCurrent) {
          setQuoteError(err?.message || 'Unable to calculate server quote');
        }
      } finally {
        if (isCurrent) {
          setIsCalculatingQuote(false);
        }
      }
    };

    const timer = setTimeout(fetchQuote, 150);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [
    product.id,
    quantity,
    minQty,
    selectedOptions,
    activeSlotFiles,
    wantsDesignService,
    deliveryMethod,
    shippingPincode,
  ]);

  // Live monetary values
  const effectiveDesignFee = useMemo(() => {
    if (quote?.designServiceFee !== undefined && quote?.designServiceFee !== null) {
      return Number(quote.designServiceFee);
    }
    if (resolvedArtwork?.designFee !== undefined && resolvedArtwork?.designFee !== null) {
      return Number(resolvedArtwork.designFee);
    }
    return baselineDesignFee;
  }, [quote?.designServiceFee, resolvedArtwork?.designFee, baselineDesignFee]);

  const computedSubtotal = useMemo(() => {
    if (quote?.subtotal !== undefined && quote?.subtotal !== null) {
      return Number(quote.subtotal);
    }
    if (hasActiveCombinationTiers) {
      const matched = validCombinationTiers.find((t) => t.quantity === quantity);
      if (matched) return matched.totalPrice;
    }
    const baseTotal = (referenceUnitPrice + fallbackOptionModifiers.perUnit) * quantity + fallbackOptionModifiers.fixed;
    return Math.round(baseTotal * 100) / 100;
  }, [quote?.subtotal, hasActiveCombinationTiers, validCombinationTiers, quantity, referenceUnitPrice, fallbackOptionModifiers]);

  const computedTax = useMemo(() => {
    return Number(quote?.totalTax || Math.round(computedSubtotal * 0.18 * 100) / 100);
  }, [quote?.totalTax, computedSubtotal]);

  const computedShipping = useMemo(() => {
    if (deliveryMethod === 'STORE_PICKUP') return 0;
    return Number(quote?.shippingAmount ?? quote?.estimatedShipping ?? 0);
  }, [deliveryMethod, quote?.shippingAmount, quote?.estimatedShipping]);

  const computedGrandTotal = useMemo(() => {
    return Number(quote?.grandTotal || Math.round((computedSubtotal + computedTax + computedShipping) * 100) / 100);
  }, [quote?.grandTotal, computedSubtotal, computedTax, computedShipping]);

  const computedAdvanceAmount = useMemo(() => {
    if (paymentMode === 'SPLIT_50') {
      return Math.round(computedGrandTotal * 0.5 * 100) / 100;
    }
    return computedGrandTotal;
  }, [paymentMode, computedGrandTotal]);

  const computedBalanceAmount = useMemo(() => {
    if (paymentMode === 'SPLIT_50') {
      return Math.round((computedGrandTotal - computedAdvanceAmount) * 100) / 100;
    }
    return 0;
  }, [paymentMode, computedGrandTotal, computedAdvanceAmount]);

  // Broadcast live dynamic pricing updates to parent page
  useEffect(() => {
    if (!onPriceChange) return;
    const unitPrice = quantity > 0 ? computedSubtotal / quantity : referenceUnitPrice;
    onPriceChange({
      grandTotal: computedGrandTotal,
      subtotal: computedSubtotal,
      unitPrice: quote?.unitPrice ? Number(quote.unitPrice) : unitPrice,
      quantity,
      totalTax: computedTax,
      shippingAmount: computedShipping,
      isCalculating: isCalculatingQuote,
      appliedOffer: quote?.appliedOffer,
      quote,
    });
  }, [
    computedGrandTotal,
    computedSubtotal,
    computedTax,
    computedShipping,
    quantity,
    isCalculatingQuote,
    quote,
    referenceUnitPrice,
    onPriceChange,
  ]);

  // ---------------------------------------------------------------------------
  // 7. REAL-TIME VALIDATION ENGINE
  // ---------------------------------------------------------------------------
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const g of visibleGroups) {
      if (groupStatusMap[g.code]?.isRequired && !selectedOptions[g.code]) {
        errors.push(`Please select an option for: ${g.name}`);
      }
    }
    if (isExplicitlyExcluded) {
      errors.push('The selected specification combination is not supported for production.');
    } else if (isMissingMatrixCombo) {
      errors.push('This combination is currently unavailable. Please select another configuration.');
    } else if (hasActiveCombinationTiers) {
      if (!validCombinationTiers.some((t) => t.quantity === quantity)) {
        errors.push('Please select a valid quantity configured for this combination.');
      }
    } else {
      if (quantity < minQty) {
        errors.push(`Minimum production volume is ${minQty.toLocaleString()} units.`);
      }
      if (quantity > maxQty) {
        errors.push(`Maximum production volume is ${maxQty.toLocaleString()} units.`);
      }
    }
    if (artworkReq === 'REQUIRED') {
      for (const slot of activeSlotConfigs) {
        // If customer selected design service, only require artwork for slots customer is responsible for supplying
        const needsCustomerUpload = wantsDesignService
          ? slot.isRequired && slot.isCustomerSupplied !== false
          : slot.isRequired;
        if (needsCustomerUpload && !activeSlotFiles[slot.slotKey]) {
          errors.push(`Artwork upload required for: ${slot.label}`);
        }
      }
    }
    if (resolvedArtwork.requireDesignBrief && wantsDesignService && !designNotes.trim()) {
      errors.push('Design notes / content instructions are required for this service.');
    }
    if (!termsAccepted) {
      errors.push('Please confirm and accept the Design Proof Approval Policy.');
    }
    return errors;
  }, [
    visibleGroups,
    groupStatusMap,
    selectedOptions,
    isExplicitlyExcluded,
    isMissingMatrixCombo,
    hasActiveCombinationTiers,
    validCombinationTiers,
    quantity,
    minQty,
    maxQty,
    artworkReq,
    wantsDesignService,
    activeSlotConfigs,
    activeSlotFiles,
    resolvedArtwork.requireDesignBrief,
    designNotes,
    termsAccepted,
  ]);

  const isValid = validationErrors.length === 0;

  // Build snapshot for cart & checkout
  const buildResult = (): ProductConfigurationResult => {
    const snapshot: Record<string, any> = {};
    for (const g of visibleGroups) {
      const val = selectedOptions[g.code];
      const opt = g.options?.find((o) => String(o.value) === String(val));
      snapshot[g.code] = {
        label: g.name,
        value: val,
        displayValue: opt ? opt.label : String(val),
        priceModifier: opt ? Number(opt.priceModifier || 0) : 0,
      };
    }

    const primaryFile = Object.values(activeSlotFiles)[0] || null;

    return {
      product,
      quantity,
      fieldValues: selectedOptions,
      hasArtwork: Object.keys(activeSlotFiles).length > 0,
      artworkFile: primaryFile,
      artworkFiles: activeSlotFiles,
      hasReferenceImage: false,
      referenceImage: null,
      hasDesignService: wantsDesignService,
      designNotes,
      deliveryMethod,
      shippingPincode: deliveryMethod === 'COURIER' && shippingPincode.trim() ? shippingPincode.trim() : undefined,
      paymentMethod: 'ONLINE',
      paymentMode,
      advanceAmount: computedAdvanceAmount,
      balanceAmount: computedBalanceAmount,
      subtotal: computedSubtotal,
      grandTotal: computedGrandTotal,
      quote: {
        ...(quote || {}),
        subtotal: computedSubtotal,
        totalTax: computedTax,
        shippingAmount: computedShipping,
        grandTotal: computedGrandTotal,
        paymentMode,
        advanceAmount: computedAdvanceAmount,
        balanceAmount: computedBalanceAmount,
        specificationsSnapshot: snapshot,
      },
    };
  };

  const handleAddToCartClick = async () => {
    if (!isValid || !onAddToCart) return;
    setIsSubmitting(true);
    try {
      await onAddToCart(buildResult());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBuyNowClick = async () => {
    if (!isValid || !onBuyNow) return;
    setIsSubmitting(true);
    try {
      await onBuyNow(buildResult());
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 8. CONTINUOUS SINGLE-FLOW ORDERING INTERFACE
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* ------------------------------------------------------------------ */}
      {/* SECTION 1: SPECIFICATIONS & MATERIALS                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-card space-y-6">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Section 01
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Manufacturing Specs
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-display mt-0.5">
              Select Specifications & Options
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose paper stocks, coating, finishes, and production parameters.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
            {visibleGroups.length} Options
          </span>
        </div>

        <div className="space-y-6">
          {/* Standard Dimensions (if configured) */}
          {product.defaultSize && (
            <div className="p-4 bg-slate-50 border border-slate-200/90 rounded-xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center flex-shrink-0 font-bold border border-amber-200/60 shadow-2xs">
                  <RiRulerLine className="h-4 w-4 text-[#E3A008]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                    Finished Dimensions
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {product.defaultSize}
                  </span>
                </div>
              </div>
              <Badge variant="blue">Standard Format</Badge>
            </div>
          )}

          {/* Dynamic Option Groups with Conditional Rule Engine */}
          {visibleGroups.map((group) => {
            const status = groupStatusMap[group.code];
            return (
              <div key={group.id} className="pb-5 border-b border-slate-100 last:border-0 last:pb-0">
                <DynamicFieldRenderer
                  field={{
                    ...group,
                    isRequired: status?.isRequired ?? group.isRequired,
                  }}
                  value={selectedOptions[group.code]}
                  onChange={(val) => handleOptionChange(group.code, val)}
                  disabled={status?.isDisabled}
                  disabledReason={status?.disabledReason}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 2: PRODUCTION RUN VOLUME                                   */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-card space-y-4">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Section 02
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Batch Scale
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-display mt-0.5">
              Production Run Volume
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {hasActiveCombinationTiers
                ? 'Select a configured quantity and verified rate for this exact specification.'
                : 'Select production run size. Higher quantities qualify for tier volume discounts.'}
            </p>
          </div>
          {hasActiveCombinationTiers ? (
            <span className="text-xs text-slate-500 font-mono">
              <strong className="text-slate-900">{validCombinationTiers.length}</strong> available tier(s)
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-mono">
              Min: <strong className="text-slate-900">{minQty.toLocaleString()}</strong> pcs
            </span>
          )}
        </div>

        {isExplicitlyExcluded ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
            <RiAlertFill className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Incompatible Option Combination</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                {matchingCombinationTiers.find((t) => t.isExcluded)?.exclusionReason ||
                  'This specific combination of options is not supported for manufacturing.'}
              </p>
            </div>
          </div>
        ) : isMissingMatrixCombo ? (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-3">
            <RiAlertFill className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">This combination is currently unavailable.</p>
              <p className="text-rose-800 text-[11px] mt-0.5">
                This combination is currently unavailable. Please select another configuration.
              </p>
            </div>
          </div>
        ) : hasActiveCombinationTiers ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
              <span>Select from configured quantities for this combination:</span>
              <span className="text-[11px] font-mono text-slate-400">Total Price (excl. tax)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {validCombinationTiers.map((tier) => {
                const isSel = quantity === tier.quantity;
                return (
                  <button
                    key={tier.id || tier.quantity}
                    type="button"
                    onClick={() => setQuantity(tier.quantity)}
                    className={`p-3.5 rounded-xl text-left border transition-all cursor-pointer relative ${
                      isSel
                        ? 'border-slate-950 bg-slate-950 text-white shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 text-slate-900'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-mono font-black text-lg ${isSel ? 'text-white' : 'text-slate-900'}`}>
                        {tier.quantity.toLocaleString()}
                      </span>
                      <span className={`text-[10px] font-mono font-bold uppercase ${isSel ? 'text-slate-400' : 'text-slate-400'}`}>
                        Pcs
                      </span>
                    </div>
                    <div className={`mt-1 text-sm font-bold ${isSel ? 'text-amber-400' : 'text-slate-900'}`}>
                      {formatCurrency(tier.totalPrice)}
                    </div>
                    <div className={`text-[11px] font-mono ${isSel ? 'text-slate-300' : 'text-slate-500'}`}>
                      ₹{tier.unitPrice.toFixed(2)}/pc
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Non-combination fallback: Stepper & quick presets */
          <>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900">Custom Run Volume</span>
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-200">
                    Step: +{qtyStep.toLocaleString()}
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Select quantity in exact increments of {qtyStep.toLocaleString()} units
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(minQty, q - qtyStep))}
                  disabled={quantity <= minQty}
                  className="h-10 w-10 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer text-lg"
                >
                  -
                </button>
                <input
                  type="number"
                  min={minQty}
                  max={maxQty}
                  step={qtyStep}
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setQuantity(val);
                  }}
                  className="w-28 h-10 bg-white border border-slate-300 rounded-xl text-center font-mono font-bold text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + qtyStep))}
                  disabled={quantity >= maxQty}
                  className="h-10 w-10 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer text-lg"
                >
                  +
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {quickPresets.map((preset) => {
                const isSel = quantity === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setQuantity(preset)}
                    className={`py-3 px-2 rounded-xl text-center border transition-all cursor-pointer ${
                      isSel
                        ? 'border-slate-950 bg-slate-950 text-white shadow-md'
                        : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="font-mono font-black text-base">
                      {preset.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase font-mono text-slate-400">
                      Units
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 3: ARTWORK & PREPRESS SETUP                                */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-card space-y-5">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Section 03
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Prepress & Design
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-display mt-0.5">
              Artwork Files & Prepress
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload print-ready files or request our professional design studio service.
            </p>
          </div>
          {artworkReq === 'DISABLED' ? (
            <Badge variant="zinc">No Artwork Required</Badge>
          ) : artworkReq === 'REQUIRED' ? (
            <Badge variant="yellow">Mandatory for Print</Badge>
          ) : (
            <Badge variant="zinc">Optional Upload</Badge>
          )}
        </div>

        {/* Artwork Disabled Notice */}
        {artworkReq === 'DISABLED' && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3 text-xs text-slate-600">
            <RiInformationLine className="h-5 w-5 text-slate-400 flex-shrink-0" />
            <span>
              Artwork file upload is not required for this product configuration. Production will proceed using standard automated typesetting.
            </span>
          </div>
        )}

        {/* Artwork File Upload Slots */}
        {artworkReq !== 'DISABLED' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Formats: <strong className="text-slate-800">{allowedFormats.join(', ')}</strong> • Max {maxFileSizeMb}MB • Min {minMegapixels} MP
              </span>
              <span className="font-mono font-bold text-slate-700">
                {activeSlotConfigs.length} {activeSlotConfigs.length === 1 ? 'Slot' : 'Slots'} Configured
              </span>
            </div>

            {/* Upload Slots Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {activeSlotConfigs.map((slot) => {
                const uploaded = slotFiles[slot.slotKey];
                const isUploading = Boolean(uploadingSlots[slot.slotKey]);
                const errorMsg = slotErrors[slot.slotKey];

                return (
                  <div
                    key={slot.slotKey}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <RiCameraLine className="h-4 w-4 text-purple-600" />
                        <span>{slot.label}</span>
                        {slot.isRequired && (!wantsDesignService || slot.isCustomerSupplied !== false) && (
                          <span className="text-rose-500 font-black">*</span>
                        )}
                      </span>
                      {uploaded ? (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                          <RiCheckLine className="h-3 w-3 stroke-[3]" /> Uploaded
                        </span>
                      ) : wantsDesignService && slot.isCustomerSupplied === false ? (
                        <span className="text-[10px] font-mono font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded">
                          Design Team Scope
                        </span>
                      ) : null}
                    </div>

                    {uploaded ? (
                      <div className="p-3 bg-white border border-purple-200 rounded-lg flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {uploaded.originalFileName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            {(uploaded.fileSize / (1024 * 1024)).toFixed(2)} MB • {uploaded.actualMegapixels ? `${uploaded.actualMegapixels} MP` : 'Print Ready'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleFileRemove(slot.slotKey)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-md hover:bg-rose-50 cursor-pointer"
                          title="Remove file"
                        >
                          <RiDeleteBinLine className="h-4 w-4" />
                        </button>
                      </div>
                    ) : wantsDesignService && slot.isCustomerSupplied === false ? (
                      <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-xl text-center space-y-1">
                        <RiPaletteLine className="h-6 w-6 text-purple-600 mx-auto" />
                        <div className="text-xs font-bold text-purple-900">
                          Artwork Created by PB Design Studio
                        </div>
                        <div className="text-[11px] text-purple-700">
                          Our prepress designers will compose the {slot.label} file according to your design brief and instructions.
                        </div>
                      </div>
                    ) : (
                      <label
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const f = e.dataTransfer.files?.[0];
                          if (f) handleFileUpload(slot.slotKey, f);
                        }}
                        className="border-2 border-dashed border-slate-300 hover:border-purple-500 bg-white hover:bg-purple-50/20 p-5 rounded-xl text-center block cursor-pointer transition-colors"
                      >
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(slot.slotKey, f);
                            e.target.value = '';
                          }}
                        />
                        {isUploading ? (
                          <div className="text-xs font-bold text-purple-700 animate-pulse">
                            Uploading & verifying resolution...
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <RiUploadCloud2Line className="h-6 w-6 text-slate-400 mx-auto" />
                            <div className="text-xs font-bold text-slate-800">
                              Click or drag {slot.label} file
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              PDF, AI, PSD, CDR, TIFF or High-Res Image
                            </div>
                          </div>
                        )}
                      </label>
                    )}

                    {errorMsg && (
                      <p className="text-[11px] text-rose-600 font-medium">
                        {errorMsg}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Design Studio Service Add-on */}
        {designReq !== 'DISABLED' && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RiPaletteLine className="h-5 w-5 text-amber-700" />
                  <div>
                    <span className="text-xs font-black uppercase text-amber-950 block">
                      Professional Design Studio Assistance
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Our prepress artists vectorize, layout, and prepare your print proof
                    </span>
                  </div>
                </div>
                {effectiveDesignFee > 0 && (
                  <span className="text-xs font-mono font-bold text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded">
                    +{formatCurrency(effectiveDesignFee)}
                  </span>
                )}
              </div>

              {designReq === 'OPTIONAL' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={wantsDesignService}
                    onChange={(e) => setWantsDesignService(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-300 text-slate-900 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-slate-900">
                    Yes, I want professional design assistance for this order
                  </span>
                </label>
              )}

              {wantsDesignService && (
                <div className="pt-2">
                  <label className="text-[11px] font-bold text-slate-800 block mb-1">
                    Design Notes & Content Instructions {resolvedArtwork.requireDesignBrief ? '(Required)' : '(Optional)'}
                  </label>
                  <textarea
                    rows={2}
                    value={designNotes}
                    onChange={(e) => setDesignNotes(e.target.value)}
                    placeholder="Enter brand guidelines, text content, color codes, or instructions for our design team..."
                    className="w-full p-2.5 bg-white border border-amber-300/80 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 shadow-2xs"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 4: DELIVERY & FULFILLMENT                                  */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-card space-y-4">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Section 04
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Logistics & SLA
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-display mt-0.5">
              Delivery & Turnaround
            </h2>
          </div>

          {(() => {
            const delivery = getEstimatedDeliveryText(product.productionDays || 2);
            return (
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1.5">
                <RiTruckLine className="h-4 w-4 text-emerald-700" />
                <span>Est. Delivery: {delivery.deliveryRange}</span>
              </span>
            );
          })()}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => setDeliveryMethod('COURIER')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              deliveryMethod === 'COURIER'
                ? 'border-slate-950 bg-slate-950 text-white shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
            }`}
          >
            <div className="font-bold text-xs">Doorstep Courier</div>
            <div className="text-[10px] opacity-75">Express dispatch direct to address</div>
          </button>

          <button
            type="button"
            onClick={() => setDeliveryMethod('STORE_PICKUP')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              deliveryMethod === 'STORE_PICKUP'
                ? 'border-slate-950 bg-slate-950 text-white shadow-xs'
                : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
            }`}
          >
            <div className="font-bold text-xs">Store Pickup</div>
            <div className="text-[10px] opacity-75">Collect from central print hub (Free)</div>
          </button>
        </div>

        {deliveryMethod === 'COURIER' && (
          <div className="pt-2">
            <input
              type="text"
              maxLength={6}
              value={shippingPincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '');
                setShippingPincode(v);
                if (typeof window !== 'undefined') localStorage.setItem('pb2_user_pincode', v);
              }}
              placeholder="Enter 6-digit delivery pincode (e.g. 560001)..."
              className="w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-slate-950"
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SECTION 5: ORDER SUMMARY & AUTHORITATIVE PRICE BREAKDOWN           */}
      {/* ------------------------------------------------------------------ */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-elevated space-y-5">
        <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black uppercase text-amber-600 tracking-wider">
                Section 05
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Order Review
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight font-display mt-0.5">
              Live Price & Confirmation
            </h2>
          </div>
          {isCalculatingQuote && (
            <span className="text-[11px] font-mono text-amber-700 animate-pulse font-bold">
              Updating server quote...
            </span>
          )}
        </div>

        {/* Selected Specifications Chips */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
          <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">
            Selected Configuration
          </span>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-bold text-slate-900">
              Quantity: {quantity.toLocaleString()} pcs
            </span>
            {visibleGroups.map((g) => {
              const val = selectedOptions[g.code];
              const opt = g.options?.find((o) => String(o.value) === String(val));
              return (
                <span
                  key={g.id}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-md font-bold text-slate-800"
                >
                  <span className="text-slate-400 font-normal">{g.name}:</span> {opt ? opt.label : String(val || 'None')}
                </span>
              );
            })}
            {Object.keys(activeSlotFiles).length > 0 && (
              <span className="px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-md font-bold text-purple-900 flex items-center gap-1">
                <RiCheckLine className="h-3 w-3 stroke-[3]" /> {Object.keys(activeSlotFiles).length} Files Attached
              </span>
            )}
            {wantsDesignService && (
              <span className="px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md font-bold text-amber-900">
                Design Service
              </span>
            )}
            {Array.isArray(quote?.appliedCharges) && quote.appliedCharges.length > 0 && (
              <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md font-bold text-emerald-900 flex items-center gap-1">
                🏷️ {quote.appliedCharges.length} Configured Fee(s)
              </span>
            )}
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-2.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Base Production ({quantity.toLocaleString()} pcs)</span>
            <span className="font-mono font-bold text-slate-900">
              {formatCurrency(Number(quote?.baseSubtotal ?? (referenceUnitPrice * quantity)))}
            </span>
          </div>

          {Number(quote?.dynamicModifiersTotal || quote?.optionsCost || 0) > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Material & Finish Upgrades</span>
              <span className="font-mono font-bold text-slate-900">
                +{formatCurrency(Number(quote?.dynamicModifiersTotal || quote?.optionsCost || 0))}
              </span>
            </div>
          )}

          {/* Generic Conditional Additional Charges */}
          {Array.isArray(quote?.appliedCharges) && quote.appliedCharges.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {quote.appliedCharges.map((ch: any, idx: number) => (
                <div
                  key={ch.chargeId || idx}
                  className="flex justify-between items-center text-emerald-950 font-bold bg-emerald-50/80 p-2.5 rounded-lg border border-emerald-200"
                >
                  <div>
                    <span className="text-xs flex items-center gap-1.5">
                      <span>🏷️</span>
                      <span>{ch.name || ch.chargeId}</span>
                      {ch.calculationType && ch.calculationType !== 'FIXED' && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200/60 text-emerald-900">
                          {ch.calculationType}
                        </span>
                      )}
                    </span>
                    {ch.description && (
                      <span className="text-[10px] text-emerald-800 font-medium block pl-5">
                        {ch.description}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    +{formatCurrency(Number(ch.amount || 0))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {wantsDesignService && effectiveDesignFee > 0 && (
            <div className="flex justify-between text-amber-950 font-bold bg-amber-50/60 p-2 rounded-lg border border-amber-200">
              <span>Professional Design Studio Fee</span>
              <span className="font-mono">+{formatCurrency(effectiveDesignFee)}</span>
            </div>
          )}

          {Number(quote?.appliedOffer?.savingsAmount || quote?.discountAmount || 0) > 0 && (
            <div className="flex justify-between items-center text-emerald-900 font-bold bg-emerald-50 p-2 rounded-lg border border-emerald-300">
              <span>🎉 Volume Offer Savings ({quote?.appliedOffer?.discountPercent || quote?.discountPercent}% OFF)</span>
              <span className="font-mono text-emerald-700">
                -{formatCurrency(Number(quote?.appliedOffer?.savingsAmount || quote?.discountAmount))}
              </span>
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex justify-between text-slate-600">
            <span>Pre-tax Subtotal</span>
            <span className="font-mono font-bold text-slate-900">{formatCurrency(computedSubtotal)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Estimated GST (18%)</span>
            <span className="font-mono font-bold text-slate-900">+{formatCurrency(computedTax)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span>Fulfillment ({deliveryMethod === 'STORE_PICKUP' ? 'Self Pickup' : 'Courier'})</span>
            <span className="font-mono font-bold text-slate-900">
              {deliveryMethod === 'STORE_PICKUP' ? (
                <span className="text-emerald-700">FREE</span>
              ) : computedShipping === 0 ? (
                <span className="text-emerald-700">FREE</span>
              ) : (
                `+${formatCurrency(computedShipping)}`
              )}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 block">
                Total Order Value
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                ₹{(computedGrandTotal / Math.max(1, quantity)).toFixed(2)} / unit all-inclusive
              </span>
            </div>
            <span className="text-2xl sm:text-3xl font-black text-slate-950 font-display">
              {formatCurrency(computedGrandTotal)}
            </span>
          </div>
        </div>

        {/* Payment Terms Selector: Full vs 50% Split */}
        <div className="pt-4 border-t border-slate-100 space-y-2.5">
          <label className="text-xs font-black uppercase tracking-wider text-slate-900 block">
            Payment Terms
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPaymentMode('FULL')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                paymentMode === 'FULL'
                  ? 'border-slate-950 bg-slate-950 text-white shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
              }`}
            >
              <div className="text-xs font-bold">100% Full Settlement</div>
              <div className="text-base font-mono font-black mt-0.5">{formatCurrency(computedGrandTotal)}</div>
              <div className="text-[10px] opacity-75">Production queue priority</div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMode('SPLIT_50')}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                paymentMode === 'SPLIT_50'
                  ? 'border-slate-950 bg-slate-950 text-white shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-400 text-slate-800'
              }`}
            >
              <div className="text-xs font-bold">50% Advance Milestone</div>
              <div className="text-base font-mono font-black mt-0.5">{formatCurrency(computedAdvanceAmount)}</div>
              <div className="text-[10px] opacity-75">Balance before dispatch</div>
            </button>
          </div>
        </div>

        {/* Proof Approval Terms Checkbox */}
        <div className="pt-3 border-t border-slate-100">
          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-slate-300 text-slate-950 focus:ring-0 cursor-pointer"
            />
            <span>
              I have reviewed all specifications and agree to the{' '}
              <strong className="text-slate-900 underline">Design Proof Approval Policy</strong>.
              I understand that once sent to press, specifications cannot be modified.
            </span>
          </label>
        </div>

        {/* Real-time Validation Notices */}
        {!isValid && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs space-y-1">
            <div className="font-bold text-rose-800 flex items-center gap-1.5">
              <RiAlertFill className="h-4 w-4 flex-shrink-0" />
              <span>Please complete required items before ordering:</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-rose-700 pl-1">
              {validationErrors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        {!isPreviewMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={!isValid || isSubmitting}
              onClick={handleAddToCartClick}
              className="w-full"
            >
              <RiShoppingCart2Line className="h-4 w-4 mr-2" />
              <span>Add to Cart</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!isValid || isSubmitting}
              onClick={handleBuyNowClick}
              className="w-full"
            >
              <span>Proceed to Checkout</span>
              <RiArrowRightLine className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
