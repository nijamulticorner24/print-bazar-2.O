'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RiShoppingCart2Line,
  RiUploadCloud2Line,
  RiCustomerService2Line,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiInformationLine,
  RiShieldCheckLine,
  RiTruckLine,
  RiAwardLine,
  RiTimeLine,
  RiBox3Line,
  RiStarFill,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCloseLine,
  RiArrowRightLine,
  RiShoppingBag3Line,
  RiGiftLine,
  RiSparklingFill,
  RiPaletteLine,
  RiEyeLine,
  RiMagicLine,
  RiFileList3Line,
  RiGroupLine,
  RiFileList2Line,
  RiCalendarEventLine,
  RiErrorWarningLine,
  RiAddLine,
  RiSubtractLine,
  RiLockLine,
  RiArrowUpCircleLine,
  RiLoader4Line,
} from 'react-icons/ri';
import {
  api,
  DynamicProduct,
  ProductOptionGroup,
  PersonalizationTemplate,
  PersonalizationPayload,
  PersonalizationItemEntry,
} from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CartDrawer, CartDrawerItem } from '@/components/cart/CartDrawer';
import { CustomerAuthModal } from '@/components/auth/CustomerAuthModal';
import { useAuth } from '@/lib/auth-context';
import { resolveArtworkConditions } from '@/lib/artwork-rule-resolver';

interface PresetDimension {
  id: string;
  name: string;
  length: number;
  width: number;
  height: number;
}

const DEFAULT_PRESET_DIMENSIONS: PresetDimension[] = [
  { id: 'jewellery', name: 'Jewellery', length: 100, width: 100, height: 40 },
  { id: 'a5', name: 'A5 Presentation', length: 220, width: 160, height: 60 },
  { id: 'apparel', name: 'Apparel', length: 300, width: 220, height: 80 },
  { id: 'perfume', name: 'Perfume', length: 120, width: 120, height: 140 },
  { id: 'custom', name: 'Custom Size', length: 220, width: 160, height: 60 },
];

// Fallback options for common option groups when DB options are not yet seeded
const FALLBACK_GROUP_OPTIONS: Record<string, Array<{ id: string; title: string; subtitle?: string }>> = {
  box_style: [
    { id: 'lid_base', title: 'Lid & Base', subtitle: '(2-Piece)' },
    { id: 'neck_shoulder', title: 'Neck & Shoulder', subtitle: '(3-Piece)' },
    { id: 'book_style', title: 'Book-Style', subtitle: '(Magnetic Flap)' },
    { id: 'drawer', title: 'Slide-Out Drawer', subtitle: '(Matchbox)' },
  ],
  board_thickness: [
    { id: '1000gsm', title: '1000 GSM', subtitle: '(1.5 mm)' },
    { id: '1200gsm', title: '1200 GSM', subtitle: '(2.0 mm)' },
    { id: '1500gsm', title: '1500 GSM', subtitle: '(2.5 mm)' },
    { id: '1800gsm', title: '1800 GSM', subtitle: '(3.0 mm)' },
  ],
  outer_wrap: [
    { id: 'coated_art', title: 'Coated Art Paper', subtitle: '(157 GSM)' },
    { id: 'wibalin_linen', title: 'Wibalin Linen', subtitle: '(Textured)' },
    { id: 'kraft_paper', title: 'Kraft Paper', subtitle: '(Natural)' },
    { id: 'pearl_metallic', title: 'Pearl Metallic', subtitle: '(Shimmer)' },
    { id: 'soft_touch', title: 'Soft Touch', subtitle: '(Luxury Matte)' },
  ],
  standee_size: [
    { id: '2.5x6', title: '2.5 × 6 Feet', subtitle: '(Standard Exhibition)' },
    { id: '2x5', title: '2.0 × 5 Feet', subtitle: '(Compact Retail)' },
    { id: '3x6', title: '3.0 × 6 Feet', subtitle: '(Wide Backdrop)' },
  ],
  media_type: [
    { id: 'star_flex', title: 'Star Flex (Matte)', subtitle: '(Anti-Glare Fabric)' },
    { id: 'grey_back', title: 'Grey Back Poly', subtitle: '(100% Non-Curl Opaque)' },
    { id: 'backlit_satin', title: 'Satin High-Gloss', subtitle: '(Vibrant Photo Media)' },
  ],
  paper_type: [
    { id: '350_matte', title: '350 GSM Matte', subtitle: '(Smooth Calendered)' },
    { id: '350_gloss', title: '350 GSM Gloss', subtitle: '(High Sheen Finish)' },
    { id: '400_velvet', title: '400 GSM Velvet Card', subtitle: '(Ultra-Thick Luxury)' },
  ],
  finishing: [
    { id: 'none', title: 'None' },
    { id: 'hot_foil', title: 'Hot Foil Stamping', subtitle: '(Gold / Silver)' },
    { id: 'embossing', title: 'Embossing', subtitle: '(3D Raised)' },
    { id: 'spot_uv', title: 'Spot Gloss UV', subtitle: '(High-Luster Accent)' },
    { id: 'matte_lam', title: 'Matte Lamination', subtitle: '(Velvet Touch)' },
    { id: 'gloss_lam', title: 'Gloss Lamination', subtitle: '(Crystal Clear)' },
  ],
  cutting_style: [
    { id: 'square_cut', title: 'Standard Square Cut', subtitle: '(90° Crisp Corners)' },
    { id: 'round_corners', title: 'Die-Cut Rounded', subtitle: '(6mm Radius Corners)' },
  ],
  insert: [
    { id: 'none', title: 'None' },
    { id: 'foam', title: 'Foam Insert', subtitle: '(High Density)' },
    { id: 'velvet_foam', title: 'Velvet Foam', subtitle: '(Luxury Flocked)' },
    { id: 'cardboard_divider', title: 'Cardboard Divider', subtitle: '(Die-Cut Partitions)' },
  ],
};

interface DynamicProductViewProps {
  product: DynamicProduct;
}

export function DynamicProductView({ product }: DynamicProductViewProps) {
  const router = useRouter();
  const { user } = useAuth();

  // Check if product specifically has dimensional input fields configured in DB or is custom rigid box
  const hasDimensionalInputs = useMemo(() => {
    const rawCodes = (product.optionGroups || []).map((g) => (g.code || '').toLowerCase());
    return (
      rawCodes.includes('box_length_mm') ||
      rawCodes.includes('length_mm') ||
      rawCodes.includes('dimensions_mm') ||
      product.slug === 'custom-rigid-box'
    );
  }, [product.optionGroups, product.slug]);

  // Curated Images: only use pink rigid box showcase for custom-rigid-box
  const galleryImages = useMemo(() => {
    if (product.images && product.images.length > 0) {
      return product.images.map((img) => ({
        url: img.url,
        alt: img.altText || product.name,
      }));
    }

    if (product.slug === 'custom-rigid-box') {
      return [
        {
          url: 'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?auto=format&fit=crop&w=1000&q=85',
          alt: 'Custom Luxury Rigid Box - Angled View with Gold Interior',
        },
        {
          url: 'https://images.unsplash.com/photo-1584824486509-112e4181ff6b?auto=format&fit=crop&w=1000&q=85',
          alt: 'Custom Rigid Box - Open Lid View with Gold Foil Monogram',
        },
        {
          url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1000&q=85',
          alt: 'Custom Rigid Box - Closed Box with Luxury Ribbon Accent',
        },
        {
          url: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1000&q=85',
          alt: 'Custom Rigid Box - Matchbox Slide Out Drawer Style',
        },
        {
          url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=1000&q=85',
          alt: 'Custom Rigid Box - Hot Foil Stamped Logo Close-Up',
        },
      ];
    }

    return [
      {
        url: product.category?.image || 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?auto=format&fit=crop&w=1000&q=85',
        alt: product.name,
      },
    ];
  }, [product.images, product.name, product.slug, product.category]);

  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isDesignerModalOpen, setIsDesignerModalOpen] = useState(false);

  // -------------------------------------------------------------
  // 1. OPTION GROUPS RESOLUTION (Strictly Connected Groups Only)
  // -------------------------------------------------------------
  const effectiveOptionGroups = useMemo(() => {
    const raw = product.optionGroups && product.optionGroups.length > 0 ? product.optionGroups : [];

    // Filter out internal dimension fields if handled by dimensional calculator
    const filtered = raw.filter(
      (g) => !['box_length_mm', 'box_width_mm', 'box_height_mm', 'length_mm', 'width_mm', 'height_mm'].includes(g.code)
    );

    // If product has option groups configured in DB, sort and return ONLY those!
    if (filtered.length > 0) {
      return [...filtered].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    // ONLY for custom-rigid-box showcase product if DB groups are empty
    if (product.slug === 'custom-rigid-box') {
      return [
        {
          id: 'box_style',
          name: 'Box Style',
          code: 'box_style',
          inputType: 'SELECT',
          description: 'Select structural architecture',
          isRequired: true,
          isCustomerVisible: true,
          sortOrder: 1,
          isActive: true,
          options: FALLBACK_GROUP_OPTIONS.box_style.map((o) => ({
            id: o.id,
            groupId: 'box_style',
            label: o.title,
            value: o.id,
            priceModifierType: 'FIXED',
            priceModifier: 0,
            sortOrder: 1,
            isDefault: o.id === 'lid_base',
            isActive: true,
          })),
        },
        {
          id: 'board_thickness',
          name: 'Board Thickness',
          code: 'board_thickness',
          inputType: 'SELECT',
          description: 'Rigid greyboard core density',
          isRequired: true,
          isCustomerVisible: true,
          sortOrder: 2,
          isActive: true,
          options: FALLBACK_GROUP_OPTIONS.board_thickness.map((o) => ({
            id: o.id,
            groupId: 'board_thickness',
            label: o.title,
            value: o.id,
            priceModifierType: 'FIXED',
            priceModifier: 0,
            sortOrder: 1,
            isDefault: o.id === '1000gsm',
            isActive: true,
          })),
        },
        {
          id: 'outer_wrap',
          name: 'Outer Wrap Material',
          code: 'outer_wrap',
          inputType: 'SELECT',
          description: 'Exterior specialty paper wrap',
          isRequired: true,
          isCustomerVisible: true,
          sortOrder: 3,
          isActive: true,
          options: FALLBACK_GROUP_OPTIONS.outer_wrap.map((o) => ({
            id: o.id,
            groupId: 'outer_wrap',
            label: o.title,
            value: o.id,
            priceModifierType: 'FIXED',
            priceModifier: 0,
            sortOrder: 1,
            isDefault: o.id === 'coated_art',
            isActive: true,
          })),
        },
        {
          id: 'finishing',
          name: 'Finishing Options',
          code: 'finishing',
          inputType: 'SELECT',
          description: 'Foil stamping, lamination & embossing',
          isRequired: false,
          isCustomerVisible: true,
          sortOrder: 4,
          isActive: true,
          options: FALLBACK_GROUP_OPTIONS.finishing.map((o) => ({
            id: o.id,
            groupId: 'finishing',
            label: o.title,
            value: o.id,
            priceModifierType: 'FIXED',
            priceModifier: 0,
            sortOrder: 1,
            isDefault: o.id === 'none',
            isActive: true,
          })),
        },
      ] as ProductOptionGroup[];
    }

    // STRICT: No unwanted options! Only return connected option groups.
    return [];
  }, [product.optionGroups, product.slug]);

  // Selections state (single values or multi-select arrays)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    for (const group of effectiveOptionGroups) {
      if (group.inputType === 'MULTI_SELECT' || group.selectionBehavior === 'MULTIPLE') {
        const defaults = (group.options || []).filter((o) => o.isDefault).map((o) => o.value);
        initial[group.code] = defaults;
      } else if (group.options && group.options.length > 0) {
        const def = group.options.find((o) => o.isDefault) || group.options[0];
        initial[group.code] = def.value;
      } else {
        const fallbacks = FALLBACK_GROUP_OPTIONS[group.code];
        if (fallbacks && fallbacks.length > 0) {
          initial[group.code] = fallbacks[0].id;
        }
      }
    }
    return initial;
  });

  // -------------------------------------------------------------
  // 2. PERSONALIZATION TEMPLATE ENGINE (/admin/personalization-templates)
  // -------------------------------------------------------------
  const [personalizationTemplate, setPersonalizationTemplate] = useState<PersonalizationTemplate | null>(
    product.personalizationTemplate || null
  );
  const [isLoadingPersonalization, setIsLoadingPersonalization] = useState(false);

  useEffect(() => {
    if (product.personalizationTemplate) {
      setPersonalizationTemplate(product.personalizationTemplate);
      return;
    }
    if (product.personalizationTemplateId && !personalizationTemplate) {
      setIsLoadingPersonalization(true);
      api
        .getPublicPersonalizationTemplate(product.personalizationTemplateId)
        .then((tmpl) => setPersonalizationTemplate(tmpl))
        .catch(() => {})
        .finally(() => setIsLoadingPersonalization(false));
    }
  }, [product.personalizationTemplate, product.personalizationTemplateId, personalizationTemplate]);

  // Personalization Shared & Itemized Values
  const [personalizationSharedValues, setPersonalizationSharedValues] = useState<Record<string, any>>({});
  const [personalizationItemValues, setPersonalizationItemValues] = useState<Array<Record<string, any>>>([]);
  const [isBulkPasteModalOpen, setIsBulkPasteModalOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [showAllPersonalizationItems, setShowAllPersonalizationItems] = useState(false);
  const [personalizationErrors, setPersonalizationErrors] = useState<Record<string, string>>({});

  // Dimensional State
  const [length, setLength] = useState(220);
  const [width, setWidth] = useState(160);
  const [height, setHeight] = useState(60);
  const [selectedPreset, setSelectedPreset] = useState('a5');

  const volume = useMemo(() => {
    return Math.max(0, length * width * height);
  }, [length, width, height]);

  // Quantity & Pricing Tiers
  const minQty = Math.max(1, Number(product.minQuantity) || 1);
  const maxQty = Math.max(minQty, Number(product.maxQuantity) || 100000);
  const baseRate = Math.max(1, Number(product.basePrice) || 500);

  // Price Increasing / Increment Mode from Product Configuration:
  // If product.quantityStep === 0 -> OFF (Fixed Quantities Only)
  // If product.quantityStep > 0 -> ON (Incremental based on step)
  const isIncrementalMode =
    product.quantityStep !== undefined && product.quantityStep !== null
      ? Number(product.quantityStep) > 0
      : true;
  const quantityStep = isIncrementalMode ? Math.max(1, Number(product.quantityStep) || 100) : 0;

  const quantityTiers = useMemo(() => {
    // 1. Strict priority: Check base rate tiers configured in Stage 5 Section 2 (Product Base Price by Quantity)
    const baseMatrices = (product.pricingMatrices || []).filter((m) => {
      const c = (m.attributeCombination as any) || {};
      const isBase =
        c.isBasePrice === true ||
        c.type === 'BASE' ||
        Object.keys(c).filter(
          (k) =>
            !['label', 'rangeLabel', 'discountPercent', 'isBasePrice', 'type', 'isExcluded', 'status', 'totalPrice', 'price'].includes(k)
        ).length === 0;
      return isBase && !c.isExcluded && c.status !== 'EXCLUDED' && (Number(m.unitPrice) > 0 || Number(c.totalPrice) > 0);
    });

    if (baseMatrices.length > 0) {
      const sorted = [...baseMatrices].sort((a, b) => Number(a.minQty) - Number(b.minQty));
      const tierList: Array<{
        quantity: number;
        minQty: number;
        maxQty: number;
        isRange: boolean;
        label: string;
        unitPrice: number;
        totalPrice: number;
        maxTotalPrice: number;
        isConfiguredFromMatrix: boolean;
      }> = [];

      for (const m of sorted) {
        const q = Number(m.minQty);
        const maxQ = m.maxQty && Number(m.maxQty) >= q ? Number(m.maxQty) : q;
        const isRange = maxQ > q;
        const c = (m.attributeCombination as any) || {};
        const exactTotal = c.totalPrice ?? c.price;
        const uPrice = Number(m.unitPrice) || (exactTotal && q > 0 ? Number(exactTotal) / q : 0);
        const tPrice =
          exactTotal !== undefined && exactTotal !== null && Number(exactTotal) > 0
            ? Number(exactTotal)
            : Math.round(uPrice * q);
        const maxTPrice = isRange ? Math.round(uPrice * maxQ) : tPrice;
        const label = c.label || m.label || (isRange ? `${q}–${maxQ} units` : `${q} units`);

        if (q > 0 && !tierList.some((t) => t.minQty === q && t.maxQty === maxQ)) {
          tierList.push({
            quantity: q,
            minQty: q,
            maxQty: maxQ,
            isRange,
            label,
            unitPrice: uPrice,
            totalPrice: tPrice,
            maxTotalPrice: maxTPrice,
            isConfiguredFromMatrix: true,
          });
        }
      }

      return tierList;
    }

    // 2. Secondary priority: Check any active pricing matrices from Stage 5
    if (product.pricingMatrices && product.pricingMatrices.length > 0) {
      const activeMatrices = product.pricingMatrices.filter((m) => {
        const c = (m.attributeCombination as any) || {};
        return !c.isExcluded && c.status !== 'EXCLUDED' && Number(m.unitPrice) > 0;
      });

      if (activeMatrices.length > 0) {
        const qtyMap = new Map<number, number>();
        for (const pm of activeMatrices) {
          const q = Number(pm.minQty);
          const price = Number(pm.unitPrice);
          if (q > 0 && (!qtyMap.has(q) || price < (qtyMap.get(q) ?? Infinity))) {
            qtyMap.set(q, price);
          }
        }

        const sortedQuantities = Array.from(qtyMap.keys()).sort((a, b) => a - b);
        return sortedQuantities.slice(0, 5).map((q) => {
          const unitPrice = qtyMap.get(q) || 1;
          return {
            quantity: q,
            minQty: q,
            maxQty: q,
            isRange: false,
            label: `${q} units`,
            unitPrice,
            totalPrice: Math.round(unitPrice * q),
            maxTotalPrice: Math.round(unitPrice * q),
            isConfiguredFromMatrix: true,
          };
        });
      }
    }

    // 3. Fallback when product has no matrix tiers configured in Stage 5:
    // Strictly compute linear prices from product.basePrice and minQuantity WITHOUT fake/random discounts!
    const officialBaseRate = Number(product.basePrice) || 500;
    const refUnitPrice = minQty > 0 ? officialBaseRate / minQty : officialBaseRate;
    const step = quantityStep > 0 ? quantityStep : minQty;
    const fallbackQuantities = [minQty, minQty + step, minQty + 2 * step, minQty + 4 * step, minQty + 9 * step];
    const uniqueQuantities = Array.from(new Set(fallbackQuantities)).filter((q) => q > 0);

    return uniqueQuantities.slice(0, 5).map((q) => {
      const unitP = Math.round(refUnitPrice * 100) / 100;
      return {
        quantity: q,
        minQty: q,
        maxQty: q,
        isRange: false,
        label: `${q} units`,
        unitPrice: unitP,
        totalPrice: Math.round(unitP * q),
        maxTotalPrice: Math.round(unitP * q),
        isConfiguredFromMatrix: false,
      };
    });
  }, [product.pricingMatrices, product.basePrice, minQty, quantityStep]);

  const [selectedQuantity, setSelectedQuantity] = useState<number>(() => {
    return quantityTiers[0]?.quantity || minQty;
  });

  // Identify active matched tier (handles range brackets like 51–100)
  const activeMatchedTier = useMemo(() => {
    return (
      quantityTiers.find((t) =>
        t.isRange
          ? selectedQuantity >= t.minQty && selectedQuantity <= t.maxQty
          : t.quantity === selectedQuantity
      ) ||
      quantityTiers.find((t) => t.quantity === selectedQuantity) ||
      quantityTiers[0]
    );
  }, [quantityTiers, selectedQuantity]);

  // Strict enforcement: If incremental mode is OFF, ensure selectedQuantity snaps to a valid fixed tier or range
  useEffect(() => {
    if (!isIncrementalMode && quantityTiers.length > 0) {
      const isMatchingTier = quantityTiers.some((t) =>
        t.isRange ? selectedQuantity >= t.minQty && selectedQuantity <= t.maxQty : t.quantity === selectedQuantity
      );
      if (!isMatchingTier) {
        setSelectedQuantity(quantityTiers[0].quantity);
      }
    }
  }, [isIncrementalMode, quantityTiers, selectedQuantity]);

  const handleDecrementQty = () => {
    if (!isIncrementalMode) return;
    setSelectedQuantity((prev) => Math.max(minQty, prev - quantityStep));
  };

  const handleIncrementQty = () => {
    if (!isIncrementalMode) return;
    setSelectedQuantity((prev) => Math.min(maxQty, prev + quantityStep));
  };

  const handleDirectQuantityChange = (val: number) => {
    if (!isIncrementalMode) return;
    const clamped = Math.max(minQty, Math.min(maxQty, val));
    setSelectedQuantity(clamped);
  };

  // Ensure personalizationItemValues matches selectedQuantity
  useEffect(() => {
    setPersonalizationItemValues((prev) => {
      const next = [...prev];
      while (next.length < selectedQuantity) {
        next.push({});
      }
      return next.slice(0, selectedQuantity);
    });
  }, [selectedQuantity]);

  // Artwork Upload State (Synced with Cart Drawer)
  const [uploadedArtwork, setUploadedArtwork] = useState<{
    fileUrl: string;
    originalFileName: string;
    fileSize: number;
    mimeType?: string;
    storageKey?: string;
  } | null>(null);

  // Authoritative Pricing State
  const [serverUnitPrice, setServerUnitPrice] = useState<number>(quantityTiers[0]?.unitPrice || baseRate);
  const [serverSubtotal, setServerSubtotal] = useState<number>(quantityTiers[0]?.totalPrice || baseRate);
  const [serverTax, setServerTax] = useState<number>(Math.round(baseRate * 0.18 * 100) / 100);
  const [serverGrandTotal, setServerGrandTotal] = useState<number>(
    baseRate + Math.round(baseRate * 0.18 * 100) / 100
  );
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);

  // Cart Drawer & Auth Modals
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [activeCartItem, setActiveCartItem] = useState<CartDrawerItem | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Server Quote Recalculation
  useEffect(() => {
    let isCancelled = false;

    async function fetchServerQuote() {
      setIsCalculatingPrice(true);
      try {
        const payloadFields: Record<string, any> = { ...selectedOptions };
        if (hasDimensionalInputs) {
          payloadFields.length_mm = length;
          payloadFields.width_mm = width;
          payloadFields.height_mm = height;
        }

        const quote = await api.calculateQuote({
          productId: product.id,
          quantity: selectedQuantity,
          fieldValues: payloadFields,
        });

        if (!isCancelled && quote) {
          const uPrice = quote.unitPrice ?? (quote.subtotal ? quote.subtotal / selectedQuantity : serverUnitPrice);
          const sTotal = quote.subtotal ?? (uPrice * selectedQuantity);
          const tax = quote.totalTax ?? Math.round(sTotal * 0.18 * 100) / 100;
          const gTotal = quote.grandTotal ?? (sTotal + tax);

          setServerUnitPrice(uPrice);
          setServerSubtotal(sTotal);
          setServerTax(tax);
          setServerGrandTotal(gTotal);
        }
      } catch (err) {
        if (!isCancelled) {
          const tier =
            quantityTiers.find((t) =>
              t.isRange
                ? selectedQuantity >= t.minQty && selectedQuantity <= t.maxQty
                : t.quantity === selectedQuantity
            ) || quantityTiers[0];

          if (tier) {
            const calculatedSubtotal =
              tier.isRange || selectedQuantity !== tier.quantity
                ? Math.round(tier.unitPrice * selectedQuantity)
                : tier.totalPrice;

            setServerUnitPrice(tier.unitPrice);
            setServerSubtotal(calculatedSubtotal);
            setServerTax(Math.round(calculatedSubtotal * 0.18 * 100) / 100);
            setServerGrandTotal(calculatedSubtotal + Math.round(calculatedSubtotal * 0.18 * 100) / 100);
          }
        }
      } finally {
        if (!isCancelled) {
          setIsCalculatingPrice(false);
        }
      }
    }

    fetchServerQuote();

    return () => {
      isCancelled = true;
    };
  }, [
    product.id,
    selectedQuantity,
    selectedOptions,
    length,
    width,
    height,
    hasDimensionalInputs,
    quantityTiers,
  ]);

  // Dimension Handlers
  const handleSelectPreset = (preset: PresetDimension) => {
    setSelectedPreset(preset.id);
    if (preset.id !== 'custom') {
      setLength(preset.length);
      setWidth(preset.width);
      setHeight(preset.height);
    }
  };

  const handleCustomDimensionChange = (type: 'L' | 'W' | 'H', val: number) => {
    setSelectedPreset('custom');
    if (type === 'L') setLength(val);
    if (type === 'W') setWidth(val);
    if (type === 'H') setHeight(val);
  };

  // Bulk Paste Handler for Per-Item Personalization
  const handleApplyBulkPaste = () => {
    if (!bulkPasteText.trim() || !personalizationTemplate) return;
    const lines = bulkPasteText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const perItemFields = personalizationTemplate.fields.filter((f) => f.scope === 'PER_ITEM');
    if (perItemFields.length === 0) return;

    const updated = [...personalizationItemValues];
    lines.forEach((line, lineIdx) => {
      if (lineIdx < selectedQuantity) {
        if (!updated[lineIdx]) updated[lineIdx] = {};
        // If multiple per-item fields, split by comma or tab
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        perItemFields.forEach((f, fIdx) => {
          if (parts[fIdx] !== undefined) {
            updated[lineIdx][f.code] = parts[fIdx].trim();
          } else if (fIdx === 0) {
            updated[lineIdx][f.code] = line.trim();
          }
        });
      }
    });

    setPersonalizationItemValues(updated);
    setIsBulkPasteModalOpen(false);
    setBulkPasteText('');
  };

  // Validation Before Add to Cart
  const validatePersonalization = (): boolean => {
    if (!personalizationTemplate || !personalizationTemplate.isActive) return true;
    const errors: Record<string, string> = {};

    // Validate PER_ORDER shared fields
    const sharedFields = personalizationTemplate.fields.filter((f) => f.scope === 'PER_ORDER');
    for (const f of sharedFields) {
      if (f.isRequired && !personalizationSharedValues[f.code]) {
        errors[f.code] = `${f.name} is required.`;
      }
    }

    // Validate PER_ITEM fields
    const perItemFields = personalizationTemplate.fields.filter((f) => f.scope === 'PER_ITEM');
    for (const f of perItemFields) {
      if (f.isRequired) {
        for (let i = 0; i < selectedQuantity; i++) {
          const val = personalizationItemValues[i]?.[f.code];
          if (!val || String(val).trim() === '') {
            errors[`item_${i}_${f.code}`] = `${f.name} is required for item #${i + 1}.`;
            break; // Stop at first missing item error for this field
          }
        }
      }
    }

    setPersonalizationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Resolve Artwork Matrix configuration dynamically from Product Setup Studio
  const resolvedArtwork = useMemo(() => {
    return resolveArtworkConditions(
      product.configurationRules || [],
      selectedOptions,
      {
        artworkRequirement: product.artworkRequirement || 'OPTIONAL',
        artworkFileFormats: product.artworkFileFormats,
        maxArtworkFileSizeMb: product.maxArtworkFileSizeMb,
        minimumArtworkMegapixels: product.minimumArtworkMegapixels ?? undefined,
        designServiceRequirement: product.designServiceRequirement,
      },
      product.optionGroups || []
    );
  }, [product, selectedOptions]);

  // Build the Authoritative Cart Item
  const buildCurrentCartItem = (): CartDrawerItem => {
    const specificationsSnapshot: Record<string, any> = {
      quantity: selectedQuantity,
      ...selectedOptions,
    };

    if (hasDimensionalInputs) {
      specificationsSnapshot.length = length;
      specificationsSnapshot.width = width;
      specificationsSnapshot.height = height;
      specificationsSnapshot.dimensions = `${length} × ${width} × ${height} mm`;
      specificationsSnapshot.volumeMm3 = volume;
    }

    const selectedOptionsSummary: Array<{ fieldLabel: string; value: string }> = [];

    if (hasDimensionalInputs) {
      selectedOptionsSummary.push({
        fieldLabel: 'Dimensions',
        value: `${length} × ${width} × ${height} mm`,
      });
    }

    for (const group of effectiveOptionGroups) {
      const selectedVal = selectedOptions[group.code];
      if (Array.isArray(selectedVal)) {
        selectedOptionsSummary.push({
          fieldLabel: group.name,
          value: selectedVal.join(', '),
        });
      } else {
        const optMatch = group.options?.find((o) => o.value === selectedVal);
        const fallbackMatch = FALLBACK_GROUP_OPTIONS[group.code]?.find((o) => o.id === selectedVal);
        const displayLabel = optMatch?.label || fallbackMatch?.title || selectedVal;

        if (displayLabel) {
          selectedOptionsSummary.push({
            fieldLabel: group.name,
            value: displayLabel,
          });
        }
      }
    }

    // Attach Personalization Payload if template active
    let personalizationPayload: PersonalizationPayload | null = null;
    if (personalizationTemplate && personalizationTemplate.isActive) {
      personalizationPayload = {
        templateId: personalizationTemplate.id,
        templateCode: personalizationTemplate.code,
        sharedValues: personalizationSharedValues,
        perItemEntries: Array.from({ length: selectedQuantity }, (_, idx) => ({
          itemIndex: idx + 1,
          values: personalizationItemValues[idx] || {},
        })),
      };

      // Add summary line
      selectedOptionsSummary.push({
        fieldLabel: 'Personalization',
        value: `${personalizationTemplate.name} (${selectedQuantity} units personalized)`,
      });
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity: selectedQuantity,
      unitPrice: serverUnitPrice,
      totalPrice: serverSubtotal,
      subtotal: serverSubtotal,
      taxAmount: serverTax,
      grandTotal: serverGrandTotal,
      specificationsSnapshot,
      selectedOptionsSummary,
      artworkConfig: {
        status: resolvedArtwork.artworkStatus,
        allowedFormats: resolvedArtwork.allowedFormats,
        maxFileSizeMb: resolvedArtwork.maxArtworkFileSizeMb,
        minimumMegapixels: resolvedArtwork.minimumArtworkMegapixels,
        slots: resolvedArtwork.slots,
        requireDesignBrief: resolvedArtwork.requireDesignBrief,
        showDesignBrief: resolvedArtwork.showDesignBrief,
        requireReferenceImage: resolvedArtwork.requireReferenceImage,
        matchedRuleName: resolvedArtwork.matchedRuleName,
      },
      artworkFile: uploadedArtwork,
      personalization: personalizationPayload,
      paymentMode: 'FULL',
    };
  };

  // Add to Cart
  const handleAddToCart = () => {
    if (!validatePersonalization()) {
      return;
    }

    const item = buildCurrentCartItem();

    try {
      const raw = localStorage.getItem('pb2_cart');
      let cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) cart = [];

      const existingIndex = cart.findIndex(
        (it: any) => it.sku === item.sku || it.productId === item.productId
      );
      if (existingIndex >= 0) {
        cart[existingIndex] = item;
      } else {
        cart.push(item);
      }
      localStorage.setItem('pb2_cart', JSON.stringify(cart));
      sessionStorage.setItem('pb2_active_cart', JSON.stringify(item));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (e) {
      console.warn('Storage error on Add to Cart', e);
    }

    setActiveCartItem(item);
    setIsCartDrawerOpen(true);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ======================================================== */}
      {/* BREADCRUMBS                                              */}
      {/* ======================================================== */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 font-medium tracking-tight">
          <Link href="/" className="hover:text-black transition-colors">
            Home
          </Link>
          <span className="text-slate-400">&gt;</span>
          <Link href="/products" className="hover:text-black transition-colors">
            Products
          </Link>
          <span className="text-slate-400">&gt;</span>
          <Link
            href={`/products?category=${product.category?.slug || 'all'}`}
            className="hover:text-black transition-colors"
          >
            {product.category?.name || 'All Products'}
          </Link>
          <span className="text-slate-400">&gt;</span>
          <span className="text-slate-900 font-semibold truncate">{product.name}</span>
        </nav>
      </div>

      {/* ======================================================== */}
      {/* MAIN TWO-COLUMN LAYOUT                                   */}
      {/* ======================================================== */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* ====================================================== */}
          {/* LEFT COLUMN: GALLERY & PRODUCT HIGHLIGHTS (~5 Cols)     */}
          {/* ====================================================== */}
          <div className="lg:col-span-5 space-y-8">
            {/* Main Product Showcase Box */}
            <div className="relative rounded-2xl overflow-hidden bg-[#EAE8E4] border border-slate-200/90 shadow-sm aspect-square flex items-center justify-center group">
              <div className="absolute top-4 left-4 z-10 bg-[#FFED00] text-black text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-md shadow-xs border border-amber-300">
                PREMIUM QUALITY
              </div>

              <img
                src={galleryImages[activeImageIdx]?.url || galleryImages[0]?.url}
                alt={galleryImages[activeImageIdx]?.alt || product.name}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-102"
              />

              {galleryImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImageIdx((prev) => (prev > 0 ? prev - 1 : galleryImages.length - 1))
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all cursor-pointer"
                    aria-label="Previous image"
                  >
                    <RiArrowLeftSLine className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveImageIdx((prev) => (prev < galleryImages.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 flex items-center justify-center shadow-md transition-all cursor-pointer"
                    aria-label="Next image"
                  >
                    <RiArrowRightSLine className="w-5 h-5" />
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(true)}
                className="absolute bottom-4 right-4 z-10 bg-white/95 hover:bg-white text-slate-900 text-xs font-bold px-3.5 py-1.5 rounded-lg shadow-sm border border-slate-200 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                {hasDimensionalInputs ? (
                  <>
                    <RiBox3Line className="w-4 h-4 text-amber-500" />
                    <span>View 3D</span>
                  </>
                ) : (
                  <>
                    <RiEyeLine className="w-4 h-4 text-amber-500" />
                    <span>Inspect Specs</span>
                  </>
                )}
              </button>
            </div>

            {/* Thumbnails Row */}
            {galleryImages.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {galleryImages.slice(0, 5).map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    className={`rounded-xl overflow-hidden aspect-square border-2 transition-all cursor-pointer bg-slate-100 ${
                      activeImageIdx === idx
                        ? 'border-[#FFED00] shadow-sm scale-98'
                        : 'border-slate-200/80 hover:border-slate-400 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Feature Highlights Block */}
            <div className="space-y-4 pt-2">
              <div>
                <h3 className="text-base font-bold text-slate-950 font-display">
                  {product.category?.name || 'Commercial Quality'}. Elevated.
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {product.description?.slice(0, 95) ||
                    'High-precision commercial print crafted for brands that value detail, quality and impact.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <RiBox3Line className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Premium Materials</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Certified commercial substrates & archival inks
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <RiPaletteLine className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Customisation</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Multiple sizes, custom finishes & add-ons
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <RiTimeLine className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Fast Turnaround</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {product.productionDays || 3} working days production SLA
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-1.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                    <RiCustomerService2Line className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">Expert Support</h4>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Design & pre-flight consultation
                  </p>
                </div>
              </div>
            </div>

            {/* Need Help Designing Banner */}
            <div className="relative rounded-2xl p-6 bg-slate-50 border border-slate-200/90 overflow-hidden flex items-center justify-between">
              <div className="space-y-2 z-10 max-w-[65%]">
                <h3 className="text-sm font-black text-slate-950 font-display">
                  Need Help Designing?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Our print & packaging experts are here to help you find the perfect solution for your brand.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsDesignerModalOpen(true)}
                    className="inline-flex items-center gap-1 px-4 py-2 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg border border-amber-300 shadow-2xs transition-colors cursor-pointer"
                  >
                    <span>Contact Designer</span>
                    <RiArrowRightLine className="w-3.5 h-3.5 stroke-[2]" />
                  </button>
                </div>
              </div>

              <div className="w-28 h-28 flex-shrink-0 relative opacity-95">
                <img
                  src={galleryImages[0]?.url}
                  alt="Packaging Support"
                  className="w-full h-full object-cover rounded-xl shadow-xs"
                />
              </div>
            </div>

            {/* Product Highlights Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider text-[11px]">
                Product Highlights
              </h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 text-center">
                  <div className="rounded-xl overflow-hidden aspect-square border border-slate-200">
                    <img
                      src={galleryImages[1]?.url || galleryImages[0]?.url}
                      alt="Premium Branding"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 block">
                    Premium Branding
                  </span>
                </div>

                <div className="space-y-1.5 text-center">
                  <div className="rounded-xl overflow-hidden aspect-square border border-slate-200">
                    <img
                      src={galleryImages[2]?.url || galleryImages[0]?.url}
                      alt="Luxury Presentation"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 block">
                    Luxury Presentation
                  </span>
                </div>

                <div className="space-y-1.5 text-center">
                  <div className="rounded-xl overflow-hidden aspect-square border border-slate-200">
                    <img
                      src={galleryImages[3]?.url || galleryImages[0]?.url}
                      alt="High Precision"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-[11px] font-bold text-slate-800 block">
                    High Precision
                  </span>
                </div>
              </div>
            </div>

            {/* Ideal For Section */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wider text-[11px]">
                Ideal For
              </h3>
              <div className="grid grid-cols-5 gap-2 text-center">
                <div className="space-y-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                    <RiShoppingBag3Line className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium leading-tight">
                    Retail Products
                  </span>
                </div>

                <div className="space-y-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                    <RiGiftLine className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium leading-tight">
                    Brand Presentation
                  </span>
                </div>

                <div className="space-y-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                    <RiSparklingFill className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium leading-tight">
                    Expos & Events
                  </span>
                </div>

                <div className="space-y-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                    <RiAwardLine className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium leading-tight">
                    Corporate Identity
                  </span>
                </div>

                <div className="space-y-1 flex flex-col items-center">
                  <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
                    <RiBox3Line className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-600 font-medium leading-tight">
                    Marketing Growth
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ====================================================== */}
          {/* RIGHT COLUMN: CONFIGURATION ENGINE (~7 Cols)           */}
          {/* ====================================================== */}
          <div className="lg:col-span-7 space-y-6">
            {/* Header Title & Badges */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#FFED00] text-black text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border border-amber-300">
                  {product.category?.name?.toUpperCase() || 'COMMERCIAL PRINT'}
                </span>
                <span className="text-xs font-mono font-medium text-slate-400">
                  SKU: {product.sku || 'PRD-PRINT-001'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight font-display">
                {product.name}
              </h1>

              {/* Rating & Stock */}
              <div className="flex items-center gap-3 pt-0.5 text-xs">
                <div className="flex items-center gap-1 text-amber-500 font-semibold">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <RiStarFill key={star} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                  <span className="text-slate-800 ml-1 font-bold">4.8</span>
                  <span className="text-slate-400">(124 reviews)</span>
                </div>

                <span className="text-slate-300">•</span>

                <div className="flex items-center gap-1 text-emerald-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>In Stock</span>
                </div>
              </div>

              {/* Starting Price from Stage 5 Pricing */}
              <div className="flex items-baseline gap-2 pt-1 pb-0.5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  Starting from
                </span>
                <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono">
                  {formatCurrency(Number(product.basePrice) || (quantityTiers[0]?.totalPrice ?? 0))}
                </span>
                <span className="text-xs font-mono text-slate-500">
                  (₹{((Number(product.basePrice) || (quantityTiers[0]?.totalPrice ?? 0)) / minQty).toFixed(2)}/unit for {minQty} pcs)
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                {product.description ||
                  'High-precision commercial print manufactured on calibrated Heidelberg and HP Indigo presses.'}
              </p>
            </div>

            {/* Checklist: 6 points in 2 columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 py-1">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Calibrated commercial-grade substrates & vibrant inks</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Multiple sizes, styles & customization formats</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Custom finishes: matte, gloss, UV, foil stamping</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Precision die-cut trims & reinforced hardware</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Low MOQ & progressive bulk discounts</span>
                </div>
                <div className="flex items-center gap-2">
                  <RiCheckLine className="w-4 h-4 text-amber-500 stroke-[2] flex-shrink-0" />
                  <span>Free pre-flight artwork proofing by experts</span>
                </div>
              </div>
            </div>

            {/* 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
                <RiTruckLine className="w-4 h-4 text-slate-700 mx-auto" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Production Time
                </span>
                <span className="text-xs font-bold text-slate-900 block">
                  {product.productionDays || 3} working days
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
                <RiBox3Line className="w-4 h-4 text-slate-700 mx-auto" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">MOQ</span>
                <span className="text-xs font-bold text-slate-900 block">{minQty} units</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center space-y-1">
                <RiCustomerService2Line className="w-4 h-4 text-slate-700 mx-auto" />
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                  Free Design Support
                </span>
                <span className="text-xs font-bold text-slate-900 block">Our team will help you</span>
              </div>
            </div>

            {/* Dynamic Step Indicator Bar */}
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-[11px] font-medium overflow-x-auto no-scrollbar gap-2">
              {hasDimensionalInputs && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="w-5 h-5 rounded-full bg-[#FFED00] text-black font-bold flex items-center justify-center text-[10px] shadow-2xs">
                    1
                  </span>
                  <span className="font-bold text-slate-900">Dimensions</span>
                </div>
              )}

              {effectiveOptionGroups.length > 0 && (
                <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-700">
                  <span className="w-5 h-5 rounded-full bg-[#FFED00] text-black font-bold flex items-center justify-center text-[10px] shadow-2xs">
                    {hasDimensionalInputs ? 2 : 1}
                  </span>
                  <span className="font-bold text-slate-900">Specifications</span>
                  <span className="text-slate-400 hidden sm:inline">({effectiveOptionGroups.length} options)</span>
                </div>
              )}

              {personalizationTemplate && personalizationTemplate.isActive && (
                <div className="flex items-center gap-1.5 flex-shrink-0 text-purple-700 font-bold">
                  <span className="w-5 h-5 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-[10px] shadow-2xs">
                    {(hasDimensionalInputs ? 1 : 0) + (effectiveOptionGroups.length > 0 ? 1 : 0) + 1}
                  </span>
                  <span>Personalization</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-shrink-0 text-slate-500">
                <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                  {(hasDimensionalInputs ? 1 : 0) + (effectiveOptionGroups.length > 0 ? 1 : 0) + (personalizationTemplate?.isActive ? 1 : 0) + 1}
                </span>
                <span>Quantity & Pricing</span>
              </div>
            </div>

            {/* ====================================================== */}
            {/* DIMENSIONS (MM) (When Product has Dimensional Inputs)  */}
            {/* ====================================================== */}
            {hasDimensionalInputs && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>1. Dimensions (mm)</span>
                    <RiInformationLine className="w-3.5 h-3.5 text-slate-400" />
                  </label>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-slate-900">
                      Volume: {volume.toLocaleString()} mm³
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono block">
                      ({length} × {width} × {height})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Length (L)</span>
                    <input
                      type="number"
                      min="50"
                      max="600"
                      value={length}
                      onChange={(e) => handleCustomDimensionChange('L', parseInt(e.target.value) || 0)}
                      className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Width (W)</span>
                    <input
                      type="number"
                      min="50"
                      max="600"
                      value={width}
                      onChange={(e) => handleCustomDimensionChange('W', parseInt(e.target.value) || 0)}
                      className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-slate-500">Height (H)</span>
                    <input
                      type="number"
                      min="20"
                      max="300"
                      value={height}
                      onChange={(e) => handleCustomDimensionChange('H', parseInt(e.target.value) || 0)}
                      className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {DEFAULT_PRESET_DIMENSIONS.map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer font-medium ${
                          isSelected
                            ? 'bg-[#FFED00] text-black font-bold border border-amber-300 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====================================================== */}
            {/* DYNAMIC OPTION GROUPS (From /admin/option-groups)       */}
            {/* ====================================================== */}
            {effectiveOptionGroups.map((group, groupIdx) => {
              const isMulti = group.inputType === 'MULTI_SELECT' || group.selectionBehavior === 'MULTIPLE';
              const isInputText = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE'].includes((group.inputType || '').toUpperCase());

              const options =
                group.options && group.options.length > 0
                  ? group.options.map((o) => {
                      let modifierText = '';
                      const numMod = Number(o.priceModifier);
                      if (numMod > 0) {
                        modifierText = o.priceModifierType === 'PERCENTAGE' ? `+${numMod}%` : `+₹${numMod.toFixed(0)}`;
                      }
                      return {
                        id: o.value,
                        title: o.label,
                        subtitle: modifierText || undefined,
                      };
                    })
                  : FALLBACK_GROUP_OPTIONS[group.code] || [];

              const currentVal = selectedOptions[group.code];

              const groupStepNum = (hasDimensionalInputs ? 1 : 0) + groupIdx + 1;

              // Handle Direct Text / Number / Date Input Groups
              if (isInputText) {
                return (
                  <div key={group.id || group.code} className="space-y-2">
                    <label className="text-xs font-bold text-slate-900 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span>{groupStepNum}. {group.name}</span>
                        {group.isRequired && <span className="text-rose-500 font-bold">*</span>}
                      </span>
                      {group.description && <span className="text-[10px] text-slate-400 font-normal">{group.description}</span>}
                    </label>

                    {group.inputType === 'TEXTAREA' ? (
                      <textarea
                        rows={2}
                        value={currentVal || ''}
                        onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [group.code]: e.target.value }))}
                        placeholder={group.description || `Enter ${group.name}...`}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                      />
                    ) : (
                      <input
                        type={group.inputType === 'NUMBER' ? 'number' : group.inputType === 'DATE' ? 'date' : 'text'}
                        value={currentVal || ''}
                        onChange={(e) => setSelectedOptions((prev) => ({ ...prev, [group.code]: e.target.value }))}
                        placeholder={group.description || `Enter ${group.name}...`}
                        className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
                      />
                    )}
                  </div>
                );
              }

              // Standard Visual Card Selectors
              return (
                <div key={group.id || group.code} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>
                        {groupStepNum}. {group.name}
                      </span>
                      {isMulti && <span className="text-[10px] text-amber-600 font-medium">(Select Multiple)</span>}
                      <RiInformationLine className="w-3.5 h-3.5 text-slate-400" />
                    </label>
                  </div>

                  <div
                    className={`grid gap-2.5 ${
                      options.length <= 4
                        ? 'grid-cols-2 sm:grid-cols-4'
                        : options.length <= 5
                        ? 'grid-cols-2 sm:grid-cols-5'
                        : 'grid-cols-3 sm:grid-cols-6'
                    }`}
                  >
                    {options.map((opt, optIdx) => {
                      const isSelected = isMulti
                        ? Array.isArray(currentVal) && currentVal.includes(opt.id)
                        : (currentVal || options[0]?.id) === opt.id;

                      const handleCardClick = () => {
                        if (isMulti) {
                          const currentArr = Array.isArray(currentVal) ? [...currentVal] : [];
                          const nextArr = isSelected
                            ? currentArr.filter((item) => item !== opt.id)
                            : [...currentArr, opt.id];
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [group.code]: nextArr,
                          }));
                        } else {
                          setSelectedOptions((prev) => ({
                            ...prev,
                            [group.code]: opt.id,
                          }));
                        }
                      };

                      return (
                        <button
                          key={`${group.code}-${opt.id || optIdx}`}
                          type="button"
                          onClick={handleCardClick}
                          className={`relative p-3 rounded-xl border text-center transition-all cursor-pointer ${
                            isSelected
                              ? 'border-2 border-[#FFED00] bg-amber-50/20 shadow-xs'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#FFED00] text-black flex items-center justify-center">
                              <RiCheckLine className="w-3 h-3 stroke-[2.5]" />
                            </div>
                          )}
                          <span className="text-xs font-bold text-slate-900 block">
                            {opt.title}
                          </span>
                          {opt.subtitle && (
                            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">
                              {opt.subtitle}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* ====================================================== */}
            {/* PERSONALIZATION SECTION (/admin/personalization-templates) */}
            {/* ====================================================== */}
            {personalizationTemplate && personalizationTemplate.isActive && (
              <div className="p-5 bg-gradient-to-br from-purple-50/40 via-white to-indigo-50/20 border border-purple-200 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-purple-100 pb-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-purple-700 text-xs font-black uppercase tracking-wider">
                      <RiMagicLine className="w-4 h-4" />
                      <span>Custom Personalization</span>
                    </div>
                    <h3 className="text-sm font-black text-slate-950 font-display">
                      {personalizationTemplate.name}
                    </h3>
                  </div>

                  <span className="text-[10px] font-mono font-bold bg-purple-100 text-purple-800 px-2.5 py-1 rounded-full border border-purple-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                    <span>
                      {personalizationTemplate.fields.some((f) => f.scope === 'PER_ITEM')
                        ? `${selectedQuantity} Items Configured`
                        : 'Order Level'}
                    </span>
                  </span>
                </div>

                {personalizationTemplate.description && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {personalizationTemplate.description}
                  </p>
                )}

                {/* 1. Shared Event Details (PER_ORDER) */}
                {personalizationTemplate.fields.filter((f) => f.scope === 'PER_ORDER').length > 0 && (
                  <div className="space-y-3 p-4 bg-white rounded-xl border border-purple-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800 block">
                      Shared Event & Commemoration Details
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {personalizationTemplate.fields
                        .filter((f) => f.scope === 'PER_ORDER')
                        .map((field) => {
                          const err = personalizationErrors[field.code];
                          return (
                            <div key={field.code} className="space-y-1">
                              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <span>{field.name}</span>
                                  {field.isRequired && <span className="text-rose-500 font-bold">*</span>}
                                </span>
                              </label>

                              {field.inputType === 'SELECT' && field.options && field.options.length > 0 ? (
                                <select
                                  value={personalizationSharedValues[field.code] || ''}
                                  onChange={(e) => {
                                    setPersonalizationSharedValues((prev) => ({
                                      ...prev,
                                      [field.code]: e.target.value,
                                    }));
                                    if (personalizationErrors[field.code]) {
                                      setPersonalizationErrors((prev) => {
                                        const cp = { ...prev };
                                        delete cp[field.code];
                                        return cp;
                                      });
                                    }
                                  }}
                                  className={`w-full h-9 px-3 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:bg-white ${
                                    err ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                                  }`}
                                >
                                  <option value="">Select {field.name}...</option>
                                  {field.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              ) : field.inputType === 'TEXTAREA' ? (
                                <textarea
                                  rows={2}
                                  placeholder={field.placeholder || ''}
                                  value={personalizationSharedValues[field.code] || ''}
                                  onChange={(e) => {
                                    setPersonalizationSharedValues((prev) => ({
                                      ...prev,
                                      [field.code]: e.target.value,
                                    }));
                                    if (personalizationErrors[field.code]) {
                                      setPersonalizationErrors((prev) => {
                                        const cp = { ...prev };
                                        delete cp[field.code];
                                        return cp;
                                      });
                                    }
                                  }}
                                  className={`w-full px-3 py-2 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:bg-white ${
                                    err ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                                  }`}
                                />
                              ) : (
                                <input
                                  type={field.inputType === 'DATE' ? 'date' : field.inputType === 'NUMBER' ? 'number' : 'text'}
                                  placeholder={field.placeholder || ''}
                                  value={personalizationSharedValues[field.code] || ''}
                                  onChange={(e) => {
                                    setPersonalizationSharedValues((prev) => ({
                                      ...prev,
                                      [field.code]: e.target.value,
                                    }));
                                    if (personalizationErrors[field.code]) {
                                      setPersonalizationErrors((prev) => {
                                        const cp = { ...prev };
                                        delete cp[field.code];
                                        return cp;
                                      });
                                    }
                                  }}
                                  className={`w-full h-9 px-3 text-xs bg-slate-50 border rounded-lg focus:outline-none focus:bg-white ${
                                    err ? 'border-rose-400 bg-rose-50' : 'border-slate-200'
                                  }`}
                                />
                              )}
                              {err && <p className="text-[10px] text-rose-500 font-semibold">{err}</p>}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* 2. Itemized Recipient Details (PER_ITEM) */}
                {personalizationTemplate.fields.filter((f) => f.scope === 'PER_ITEM').length > 0 && (
                  <div className="space-y-3 p-4 bg-white rounded-xl border border-purple-100">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
                        Individual Names / Line Items ({selectedQuantity} Units)
                      </span>

                      <button
                        type="button"
                        onClick={() => setIsBulkPasteModalOpen(true)}
                        className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded-md border border-purple-200 transition-colors"
                      >
                        <RiFileList3Line className="w-3.5 h-3.5" />
                        <span>Bulk Paste Names</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {Array.from({ length: selectedQuantity })
                        .slice(0, showAllPersonalizationItems || selectedQuantity <= 5 ? selectedQuantity : 5)
                        .map((_, itemIdx) => {
                          const perItemFields = personalizationTemplate.fields.filter((f) => f.scope === 'PER_ITEM');
                          return (
                            <div
                              key={itemIdx}
                              className="p-2.5 bg-slate-50/70 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center gap-2"
                            >
                              <span className="text-[11px] font-mono font-bold text-slate-500 sm:w-16 flex-shrink-0">
                                #{itemIdx + 1}
                              </span>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                                {perItemFields.map((field) => {
                                  const errKey = `item_${itemIdx}_${field.code}`;
                                  const err = personalizationErrors[errKey];
                                  return (
                                    <div key={field.code} className="space-y-0.5">
                                      <input
                                        type="text"
                                        placeholder={`${field.name}${field.isRequired ? ' *' : ''}`}
                                        value={personalizationItemValues[itemIdx]?.[field.code] || ''}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setPersonalizationItemValues((prev) => {
                                            const next = [...prev];
                                            if (!next[itemIdx]) next[itemIdx] = {};
                                            next[itemIdx][field.code] = val;
                                            return next;
                                          });
                                          if (personalizationErrors[errKey]) {
                                            setPersonalizationErrors((prev) => {
                                              const cp = { ...prev };
                                              delete cp[errKey];
                                              return cp;
                                            });
                                          }
                                        }}
                                        className={`w-full h-8 px-2.5 text-xs bg-white border rounded-md focus:outline-none focus:border-purple-500 ${
                                          err ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                                        }`}
                                      />
                                      {err && <p className="text-[9px] text-rose-500 font-medium">{err}</p>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                      {selectedQuantity > 5 && (
                        <button
                          type="button"
                          onClick={() => setShowAllPersonalizationItems(!showAllPersonalizationItems)}
                          className="w-full py-2 text-xs font-bold text-purple-700 hover:text-purple-900 border border-purple-200 rounded-lg bg-purple-50/50 hover:bg-purple-100/50 transition-colors cursor-pointer"
                        >
                          {showAllPersonalizationItems
                            ? 'Collapse to 5 items'
                            : `View & edit all ${selectedQuantity} items`}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ====================================================== */}
            {/* QUANTITY & PRICING                                     */}
            {/* ====================================================== */}
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>
                      {(hasDimensionalInputs ? 1 : 0) +
                        effectiveOptionGroups.length +
                        (personalizationTemplate?.isActive ? 1 : 0) +
                        1}
                      . Quantity & Pricing
                    </span>
                    <RiInformationLine className="w-3.5 h-3.5 text-slate-400" />
                  </label>

                  {isIncrementalMode ? (
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/90 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <RiArrowUpCircleLine className="w-3 h-3 text-amber-600" />
                      Step: +{quantityStep} units
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                      <RiLockLine className="w-3 h-3 text-slate-500" />
                      Fixed Quantities Only
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedQuantity(quantityTiers[0]?.quantity || minQty);
                  }}
                  className="text-xs text-slate-500 hover:text-black hover:underline cursor-pointer"
                >
                  Reset Quantity
                </button>
              </div>

              {/* Quantity Pricing Cards (Fixed Counts & Bulk Range Brackets) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {quantityTiers.map((tier, idx) => {
                  const isSelected = tier.isRange
                    ? selectedQuantity >= tier.minQty && selectedQuantity <= tier.maxQty
                    : selectedQuantity === tier.quantity;

                  const displayTotalPrice = isSelected
                    ? serverSubtotal
                    : tier.isRange
                    ? tier.totalPrice
                    : tier.totalPrice;

                  const displayUnitPrice = isSelected && !tier.isRange ? serverUnitPrice : tier.unitPrice;

                  return (
                    <button
                      key={`qty-tier-${tier.minQty}-${tier.maxQty}-${idx}`}
                      type="button"
                      onClick={() => {
                        setSelectedQuantity(tier.quantity);
                      }}
                      className={`relative p-3 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-2 border-[#FFED00] bg-amber-50/20 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#FFED00] text-black flex items-center justify-center">
                          <RiCheckLine className="w-3 h-3 stroke-[2.5]" />
                        </div>
                      )}

                      {tier.isRange && (
                        <span className="inline-block px-1.5 py-0.2 mb-1 rounded text-[8px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Bulk Range
                        </span>
                      )}

                      <span className="text-xs font-bold text-slate-800 block">
                        {tier.isRange ? `${tier.minQty}–${tier.maxQty} units` : `${tier.quantity} units`}
                      </span>

                      <span className="text-sm font-black text-slate-950 font-mono block mt-0.5">
                        {isSelected
                          ? formatCurrency(displayTotalPrice)
                          : tier.isRange
                          ? `From ${formatCurrency(tier.totalPrice)}`
                          : formatCurrency(displayTotalPrice)}
                      </span>

                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        ₹{displayUnitPrice.toFixed(2)} / unit
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Bulk Range Alert Banner */}
              {activeMatchedTier?.isRange && (
                <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-center justify-between text-xs text-amber-950">
                  <div className="flex items-center gap-2">
                    <RiSparklingFill className="w-4 h-4 text-amber-600 shrink-0" />
                    <div>
                      <span className="font-bold">Bulk Range Applied: </span>
                      <span>
                        Ordering <strong>{selectedQuantity} units</strong> qualifies for the{' '}
                        <strong className="font-mono">{activeMatchedTier.minQty}–{activeMatchedTier.maxQty} pcs</strong> rate (
                        <strong className="font-mono">₹{activeMatchedTier.unitPrice.toFixed(2)} / unit</strong>
                        ). Price = <strong className="font-mono">{selectedQuantity} × ₹{activeMatchedTier.unitPrice.toFixed(2)} = {formatCurrency(serverSubtotal)}</strong>.
                      </span>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block font-mono font-bold text-amber-800 text-[11px] bg-amber-100/90 px-2 py-0.5 rounded border border-amber-300 shrink-0">
                    ₹{activeMatchedTier.unitPrice.toFixed(2)}/pc Active
                  </span>
                </div>
              )}

              {/* If Incremental Mode: Custom Stepper & Increment Controller */}
              {isIncrementalMode ? (
                <div className="p-3 bg-slate-50/90 border border-slate-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        Custom Quantity Stepper
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Adjust order count in increments of {quantityStep} units
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={handleDecrementQty}
                        disabled={selectedQuantity <= minQty}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-800 font-bold transition shadow-2xs cursor-pointer"
                        title={`Decrease by ${quantityStep}`}
                      >
                        <RiSubtractLine className="w-3.5 h-3.5" />
                      </button>

                      <div className="relative">
                        <input
                          type="number"
                          min={minQty}
                          max={maxQty}
                          step={quantityStep}
                          value={selectedQuantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              handleDirectQuantityChange(val);
                            }
                          }}
                          className="w-24 h-8 px-2 text-center text-xs font-bold font-mono bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleIncrementQty}
                        disabled={selectedQuantity >= maxQty}
                        className="w-8 h-8 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-slate-800 font-bold transition shadow-2xs cursor-pointer"
                        title={`Increase by ${quantityStep}`}
                      >
                        <RiAddLine className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Quick step jump chips */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-200/70">
                    <span className="text-[11px] font-medium text-slate-500">Quick add:</span>
                    {[quantityStep, quantityStep * 2, quantityStep * 5].map((stepAdd) => (
                      <button
                        key={stepAdd}
                        type="button"
                        onClick={() => handleDirectQuantityChange(selectedQuantity + stepAdd)}
                        className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300 transition cursor-pointer"
                      >
                        +{stepAdd} units
                      </button>
                    ))}
                    <span className="text-[11px] text-slate-400 font-mono ml-auto">
                      Min: {minQty} | Max: {maxQty}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-2 text-xs text-slate-700 font-medium">
                  <RiLockLine className="w-4 h-4 text-slate-500 shrink-0" />
                  <span>
                    This product is available exclusively in the <strong>predefined fixed quantities</strong> shown above. Custom quantity increments are disabled.
                  </span>
                </div>
              )}

              <div className="p-2.5 bg-emerald-50 border border-emerald-200/90 rounded-xl flex items-center gap-2 text-xs text-emerald-900 font-medium">
                <RiCheckboxCircleLine className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Higher quantity gives you lower per unit cost and better savings.</span>
              </div>
            </div>

            {/* Validation Error Banner */}
            {Object.keys(personalizationErrors).length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800 font-semibold">
                <RiErrorWarningLine className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>Please complete the required personalization fields highlighted above.</span>
              </div>
            )}

            {/* ====================================================== */}
            {/* AUTHORITATIVE PRICING SUMMARY CARD (STAGE 5 DRIVEN)    */}
            {/* ====================================================== */}
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-card space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-400">
                      Authoritative Quotation
                    </span>
                    {isCalculatingPrice ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-300">
                        <RiLoader4Line className="w-3 h-3 animate-spin" />
                        Calculating...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <RiCheckboxCircleLine className="w-3 h-3" />
                        Stage 5 Verified
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-300 font-mono">
                    {selectedQuantity} units × ₹{serverUnitPrice.toFixed(2)} / unit
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-black font-mono text-white">
                    {formatCurrency(serverSubtotal)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Subtotal (Excl. Tax)
                  </div>
                </div>
              </div>

              {/* Price Details Bar */}
              <div className="pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-300 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Estimated GST (18%):</span>
                  <span className="font-mono text-slate-200">+{formatCurrency(serverTax)}</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-white">
                  <span className="text-slate-300">Total Payable:</span>
                  <span className="font-mono text-amber-400 font-black text-base">{formatCurrency(serverGrandTotal)}</span>
                </div>
              </div>
            </div>

            {/* ====================================================== */}
            {/* PRIMARY & SECONDARY CTA BUTTONS                        */}
            {/* ====================================================== */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isCalculatingPrice}
                className="w-full h-12 bg-[#FFED00] hover:bg-[#F2E100] text-black font-bold text-sm rounded-xl border border-black/10 shadow-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] cursor-pointer"
              >
                <RiShoppingCart2Line className="w-5 h-5" />
                <span>Add to Cart</span>
              </button>

              <div>
                <button
                  type="button"
                  onClick={() => setIsDesignerModalOpen(true)}
                  className="w-full h-11 px-4 bg-white hover:bg-slate-50 text-slate-900 text-xs font-bold rounded-xl border border-slate-300 flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-2xs"
                >
                  <RiCustomerService2Line className="w-4 h-4 text-slate-700" />
                  <span>No Design? Contact Designer</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* BOTTOM TRUST FOOTER STRIP                                */}
      {/* ======================================================== */}
      <div className="border-t border-slate-200 bg-slate-50/70 py-6 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-xs text-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-2xs">
                <RiShieldCheckLine className="w-5 h-5 text-slate-800" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Secure Payments</span>
                <span className="text-[11px] text-slate-500">100% secure & encrypted</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-2xs">
                <RiAwardLine className="w-5 h-5 text-slate-800" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Professional Production</span>
                <span className="text-[11px] text-slate-500">Advanced printing technology</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-2xs">
                <RiCheckboxCircleLine className="w-5 h-5 text-slate-800" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Quality Assurance</span>
                <span className="text-[11px] text-slate-500">Strict quality checks</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-900 shadow-2xs">
                <RiTruckLine className="w-5 h-5 text-slate-800" />
              </div>
              <div>
                <span className="font-bold text-slate-900 block">On-Time Delivery</span>
                <span className="text-[11px] text-slate-500">Across India</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* CART SIDE DRAWER                                         */}
      {/* ======================================================== */}
      <CartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
        activeItem={activeCartItem}
        onUpdateItem={(updated) => setActiveCartItem(updated)}
        onProceedToCheckout={() => {
          if (activeCartItem) {
            sessionStorage.setItem('pb2_active_cart', JSON.stringify(activeCartItem));
          }
          if (user) {
            router.push('/checkout');
          } else {
            setIsAuthModalOpen(true);
          }
        }}
      />

      {/* Checkout Authentication Gate Modal */}
      <CustomerAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          router.push('/checkout');
        }}
      />

      {/* Bulk Paste Modal for Per-Item Personalization */}
      {isBulkPasteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RiFileList3Line className="w-5 h-5 text-purple-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Bulk Paste Recipient Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-slate-600">
                Paste one line per item (up to {selectedQuantity} items). If multiple fields, separate by comma or tab from Excel/Sheets.
              </p>
              <textarea
                rows={8}
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="Rahul Verma&#10;Priya Sharma&#10;Amit Patel"
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:bg-white focus:border-purple-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsBulkPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApplyBulkPaste}
                disabled={!bulkPasteText.trim()}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors"
              >
                Apply Names ({bulkPasteText.split('\n').filter((l) => l.trim()).length} parsed)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3D / High-Res Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RiBox3Line className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Technical Preview: {product.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <div className="aspect-square bg-gradient-to-b from-slate-100 to-slate-200 rounded-xl flex flex-col items-center justify-center p-6 text-center space-y-3 relative overflow-hidden">
              <img
                src={galleryImages[0]?.url}
                alt="Product Preview"
                className="w-56 h-56 object-contain drop-shadow-2xl transition-transform hover:scale-105"
              />
              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-slate-800">
                  SKU: {product.sku} • {product.category?.name || 'Commercial Quality'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Calibrated on Heidelberg & HP Indigo Press Plant • ISO 12647-2 Ready
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(false)}
              className="w-full h-10 bg-slate-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}

      {/* Designer Support Helpline Modal */}
      {isDesignerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <RiCustomerService2Line className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Print & Packaging Specialist</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDesignerModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <RiCloseLine className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Need custom die-lines, structural inserts, or artwork layout assistance for{' '}
              <strong>{product.name}</strong>? Our specialists are available for consultation.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs">
              <p className="font-semibold text-slate-800">Direct Desk Helpline:</p>
              <p className="text-amber-800 font-mono font-bold">+91 (022) 2840-2100</p>
              <p className="text-slate-500 text-[11px]">Email: support@printbazzar.in (Mon-Sat 9AM-8PM IST)</p>
            </div>

            <button
              type="button"
              onClick={() => setIsDesignerModalOpen(false)}
              className="w-full h-10 bg-[#FFED00] hover:bg-[#F2E100] text-black text-xs font-bold rounded-lg transition-colors border border-amber-300"
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
