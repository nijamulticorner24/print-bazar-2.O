'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RiCloseLine,
  RiCheckLine,
  RiCheckboxCircleLine,
  RiAlertLine,
  RiUploadCloud2Line,
  RiFileTextLine,
  RiArrowRightLine,
  RiShoppingBag3Line,
  RiLoader4Line,
  RiInformationLine,
  RiDeleteBinLine,
  RiShieldCheckLine,
  RiAddLine,
  RiSubtractLine,
} from 'react-icons/ri';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui';

export interface CartDrawerArtworkSlot {
  slotKey: string;
  label: string;
  minMegapixels?: number;
  isRequired?: boolean;
  isCustomerSupplied?: boolean;
}

export interface CartDrawerArtworkConfig {
  status: 'REQUIRED' | 'OPTIONAL' | 'DISABLED';
  allowedFormats?: string[];
  maxFileSizeMb?: number;
  minimumMegapixels?: number;
  slots?: CartDrawerArtworkSlot[];
  requireDesignBrief?: boolean;
  showDesignBrief?: boolean;
  requireReferenceImage?: boolean;
  matchedRuleName?: string;
}

export interface CartDrawerArtworkFile {
  fileUrl: string;
  originalFileName: string;
  fileSize: number;
  mimeType?: string;
  storageKey?: string;
  slotKey?: string;
  slotLabel?: string;
  uploadedAt?: string;
}

export interface CartDrawerItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  subtotal: number;
  taxAmount?: number;
  grandTotal?: number;
  specificationsSnapshot: Record<string, any>;
  selectedOptionsSummary?: Array<{
    fieldLabel?: string;
    optionLabel?: string;
    value?: string;
  }>;
  artworkConfig?: CartDrawerArtworkConfig;
  artworkFile?: CartDrawerArtworkFile | null;
  artworkFiles?: Record<string, CartDrawerArtworkFile>;
  designNotes?: string;
  personalization?: any;
  paymentMode?: 'FULL' | 'SPLIT_50';
  advanceAmount?: number;
  balanceAmount?: number;
  quote?: any;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeItem?: CartDrawerItem | null;
  onUpdateItem?: (updated: CartDrawerItem) => void;
  onProceedToCheckout?: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  activeItem,
  onUpdateItem,
  onProceedToCheckout,
}: CartDrawerProps) {
  const router = useRouter();
  const drawerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingSlotKey, setUploadingSlotKey] = useState<string | null>(null);
  const [activeUploadSlotKey, setActiveUploadSlotKey] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = useState(activeItem?.designNotes || '');
  const [isNotesExpanded, setIsNotesExpanded] = useState(false);

  // Sync customer notes when activeItem changes
  useEffect(() => {
    if (activeItem?.designNotes) {
      setCustomerNotes(activeItem.designNotes);
    }
  }, [activeItem?.designNotes]);

  // Lock body scroll and handle Escape key
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const item = activeItem;
  const specs = item?.specificationsSnapshot || {};
  const qty = item?.quantity || 50;
  const unitPrice = item?.unitPrice || 65;
  const subtotal = item?.subtotal || unitPrice * qty;
  const tax = item?.taxAmount || Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = item?.grandTotal || subtotal + tax;

  const artworkConfig = item?.artworkConfig;
  const artworkStatus = artworkConfig?.status || 'REQUIRED';
  const maxFileSizeMb = Number(artworkConfig?.maxFileSizeMb) || 50;
  const allowedFormats =
    artworkConfig?.allowedFormats && artworkConfig.allowedFormats.length > 0
      ? artworkConfig.allowedFormats
      : ['PDF', 'AI', 'PSD', 'EPS', 'TIFF', 'PNG', 'JPG', 'ZIP'];
  const acceptPattern = allowedFormats
    .map((fmt) => (fmt.startsWith('.') ? fmt.toLowerCase() : `.${fmt.toLowerCase()}`))
    .join(',');
  const formatsDisplayText = allowedFormats.join(', ');

  // Deterministically resolve slots: if 1 slot -> 1 slot, if 2 slots -> 2 slots
  const effectiveSlots: CartDrawerArtworkSlot[] = useMemo(() => {
    if (artworkConfig?.slots && artworkConfig.slots.length > 0) {
      return artworkConfig.slots;
    }
    if (artworkStatus !== 'DISABLED') {
      return [
        {
          slotKey: 'slot_1_front_side',
          label: 'Front Side',
          isRequired: artworkStatus === 'REQUIRED',
        },
      ];
    }
    return [];
  }, [artworkConfig?.slots, artworkStatus]);

  // Map of uploaded files per slotKey with fallback to legacy artworkFile
  const slotFilesMap: Record<string, CartDrawerArtworkFile> = useMemo(() => {
    const map: Record<string, CartDrawerArtworkFile> = { ...(item?.artworkFiles || {}) };
    if (item?.artworkFile && Object.keys(map).length === 0 && effectiveSlots.length > 0) {
      map[effectiveSlots[0].slotKey] = item.artworkFile;
    }
    return map;
  }, [item?.artworkFiles, item?.artworkFile, effectiveSlots]);

  const uploadedCount = useMemo(() => {
    return effectiveSlots.filter((slot) => Boolean(slotFilesMap[slot.slotKey]?.fileUrl)).length;
  }, [effectiveSlots, slotFilesMap]);

  const allRequiredUploaded = useMemo(() => {
    const requiredSlots = effectiveSlots.filter((s) => s.isRequired);
    if (requiredSlots.length === 0) {
      return uploadedCount > 0;
    }
    return requiredSlots.every((s) => Boolean(slotFilesMap[s.slotKey]?.fileUrl));
  }, [effectiveSlots, slotFilesMap, uploadedCount]);

  // Trigger file selection for a specific upload slot
  const triggerUploadForSlot = (slotKey: string) => {
    setActiveUploadSlotKey(slotKey);
    setUploadError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // File Upload Handler (Per-Slot)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetSlotKey = activeUploadSlotKey || effectiveSlots[0]?.slotKey;
    if (!file || !item || !targetSlotKey) return;

    // Validate size and extensions dynamically from artworkConfig
    const validExtensions = allowedFormats.map((f) =>
      f.startsWith('.') ? f.toLowerCase() : `.${f.toLowerCase()}`
    );
    if (validExtensions.includes('.jpg') && !validExtensions.includes('.jpeg')) {
      validExtensions.push('.jpeg');
    }

    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setUploadError(`Please select a valid print-ready file (${formatsDisplayText})`);
      return;
    }

    const maxBytes = maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setUploadError(`Artwork exceeds the maximum allowable size of ${maxFileSizeMb} MB.`);
      return;
    }

    setUploadingSlotKey(targetSlotKey);
    setUploadError(null);

    try {
      const res = await api.uploadArtwork(file, item.productId);
      const targetSlot = effectiveSlots.find((s) => s.slotKey === targetSlotKey);

      const newArtworkFile: CartDrawerArtworkFile = {
        fileUrl: res.fileUrl,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storageKey: res.storageKey,
        slotKey: targetSlotKey,
        slotLabel: targetSlot?.label || 'Artwork File',
        uploadedAt: new Date().toISOString(),
      };

      const updatedArtworkFiles: Record<string, CartDrawerArtworkFile> = {
        ...slotFilesMap,
        [targetSlotKey]: newArtworkFile,
      };

      // Keep primary artworkFile synchronized for backward compatibility
      const primaryFile = updatedArtworkFiles[effectiveSlots[0]?.slotKey] || newArtworkFile;

      const updatedItem: CartDrawerItem = {
        ...item,
        artworkFiles: updatedArtworkFiles,
        artworkFile: primaryFile,
      };

      if (onUpdateItem) {
        onUpdateItem(updatedItem);
      }

      // Update storage
      updateCartStorage(updatedItem);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload artwork. Please try again.');
    } finally {
      setUploadingSlotKey(null);
      setActiveUploadSlotKey(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveSlotArtwork = (slotKey: string) => {
    if (!item) return;
    const updatedArtworkFiles: Record<string, CartDrawerArtworkFile> = {
      ...slotFilesMap,
    };
    delete updatedArtworkFiles[slotKey];

    const remainingFiles = Object.values(updatedArtworkFiles);
    const primaryFile = remainingFiles.length > 0 ? remainingFiles[0] : null;

    const updatedItem: CartDrawerItem = {
      ...item,
      artworkFiles: updatedArtworkFiles,
      artworkFile: primaryFile,
    };

    if (onUpdateItem) {
      onUpdateItem(updatedItem);
    }
    updateCartStorage(updatedItem);
  };

  const handleNotesBlur = () => {
    if (!item) return;
    const updatedItem: CartDrawerItem = {
      ...item,
      designNotes: customerNotes,
    };
    if (onUpdateItem) {
      onUpdateItem(updatedItem);
    }
    updateCartStorage(updatedItem);
  };

  const updateCartStorage = (updatedItem: CartDrawerItem) => {
    try {
      const raw = localStorage.getItem('pb2_cart');
      let cart = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(cart)) cart = [];

      // Update or replace existing item matching sku or productId
      const idx = cart.findIndex(
        (it: any) => it.sku === updatedItem.sku || it.productId === updatedItem.productId
      );
      if (idx >= 0) {
        cart[idx] = updatedItem;
      } else {
        cart.push(updatedItem);
      }
      localStorage.setItem('pb2_cart', JSON.stringify(cart));
      sessionStorage.setItem('pb2_active_cart', JSON.stringify(updatedItem));
      window.dispatchEvent(new Event('cart-updated'));
    } catch (e) {
      console.warn('Storage sync warning', e);
    }
  };

  const handleCheckoutClick = () => {
    if (onProceedToCheckout) {
      onProceedToCheckout();
    } else {
      if (item) {
        sessionStorage.setItem('pb2_active_cart', JSON.stringify(item));
      }
      router.push('/checkout');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative w-full max-w-lg bg-white h-full shadow-2xl z-10 flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300"
      >
        {/* ======================================================== */}
        {/* A. DRAWER HEADER                                         */}
        {/* ======================================================== */}
        <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <RiCheckboxCircleLine className="w-5 h-5" />
            </div>
            <div>
              <h2 id="drawer-title" className="text-base font-bold text-slate-900 leading-tight">
                Added to Cart
              </h2>
              <p className="text-[11px] text-slate-500">
                Item successfully added to your order queue.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close drawer"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* SCROLLABLE BODY                                          */}
        {/* ======================================================== */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 divide-y divide-slate-100">
          {item ? (
            <>
              {/* ======================================================== */}
              {/* B. PRODUCT DETAILS SPECIFICATION LIST                    */}
              {/* ======================================================== */}
              <div className="space-y-4 pt-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      SKU: {item.sku || 'PRD-PKG-002'}
                    </span>
                    <h3 className="text-base font-black text-slate-950 mt-1 font-display">
                      {item.productName || 'Custom Luxury Rigid Box'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block font-mono">
                      {formatCurrency(unitPrice)} / unit
                    </span>
                    <span className="text-sm font-black text-slate-950 font-mono">
                      {formatCurrency(subtotal)}
                    </span>
                  </div>
                </div>

                {/* Specifications Grid */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                  {item.selectedOptionsSummary && item.selectedOptionsSummary.length > 0 ? (
                    item.selectedOptionsSummary.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 border-b border-slate-200/60 last:border-0"
                      >
                        <span className="text-slate-500 font-medium">
                          {opt.fieldLabel || 'Option'}:
                        </span>
                        <span className="font-semibold text-slate-900 text-right truncate max-w-[60%]">
                          {opt.optionLabel || opt.value}
                        </span>
                      </div>
                    ))
                  ) : (
                    <>
                      {specs.boxStyle && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium">Box Style:</span>
                          <span className="font-semibold text-slate-900">{specs.boxStyle}</span>
                        </div>
                      )}
                      {specs.dimensions && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium">Dimensions:</span>
                          <span className="font-mono font-semibold text-slate-900">{specs.dimensions}</span>
                        </div>
                      )}
                      {specs.boardThickness && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium">Board Thickness:</span>
                          <span className="font-semibold text-slate-900">{specs.boardThickness}</span>
                        </div>
                      )}
                      {specs.outerWrap && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium">Outer Wrap:</span>
                          <span className="font-semibold text-slate-900">{specs.outerWrap}</span>
                        </div>
                      )}
                      {specs.finishing && (
                        <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500 font-medium">Finishing:</span>
                          <span className="font-semibold text-slate-900">{specs.finishing}</span>
                        </div>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 font-medium">Quantity:</span>
                    <span className="font-mono font-bold text-slate-950">
                      {qty} units
                    </span>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* C. ARTWORK STATUS WORKFLOW (DYNAMIC MULTI-SLOT MATRIX)   */}
              {/* ======================================================== */}
              {artworkStatus === 'DISABLED' ? (
                <div className="pt-3">
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900">
                    <RiShieldCheckLine className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>No artwork upload required for this product. Ready for production.</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 pt-5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <RiFileTextLine className="w-4 h-4 text-[#E3A008]" />
                      <span>
                        Artwork Files ({uploadedCount}/{effectiveSlots.length} Attached)
                      </span>
                    </h4>
                    {allRequiredUploaded && uploadedCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <RiCheckLine className="w-3.5 h-3.5" />
                        {uploadedCount === effectiveSlots.length
                          ? 'All Uploaded'
                          : `${uploadedCount}/${effectiveSlots.length} Uploaded`}
                      </span>
                    ) : artworkStatus === 'REQUIRED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <RiAlertLine className="w-3.5 h-3.5" />
                        {effectiveSlots.length > 1
                          ? `${effectiveSlots.length} Uploads Required`
                          : 'Artwork Required'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        <RiInformationLine className="w-3.5 h-3.5" />
                        Artwork Optional
                      </span>
                    )}
                  </div>

                  {/* Format & Size Specs */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-lg font-mono">
                    <span className="truncate max-w-[65%]">Formats: {formatsDisplayText}</span>
                    <span className="shrink-0">Max {maxFileSizeMb} MB/slot</span>
                  </div>

                  {/* Configured Upload Slots (Dynamic based on selected options / matrix) */}
                  <div className="space-y-2.5">
                    {effectiveSlots.map((slot, index) => {
                      const file = slotFilesMap[slot.slotKey];
                      const hasFile = Boolean(file?.fileUrl);
                      const isThisSlotUploading = uploadingSlotKey === slot.slotKey;

                      return (
                        <div
                          key={slot.slotKey || index}
                          className={`p-3.5 rounded-xl border transition-all ${
                            hasFile
                              ? 'bg-emerald-50/40 border-emerald-200'
                              : slot.isRequired
                              ? 'bg-amber-50/40 border-amber-200/90'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          {/* Slot Header */}
                          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/60">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-slate-200/80 text-slate-700 font-mono text-[10px] font-bold flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="text-xs font-bold text-slate-900 font-display">
                                {slot.label}
                              </span>
                            </div>
                            <div>
                              {slot.isRequired ? (
                                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-2 py-0.5 rounded-full">
                                  Required
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                                  Optional
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Slot Body: Uploaded Card or Upload Trigger */}
                          <div className="pt-2.5">
                            {hasFile ? (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                                    <RiCheckboxCircleLine className="w-4 h-4 text-emerald-700" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">
                                      {file.originalFileName}
                                    </p>
                                    <p className="text-[10px] text-slate-500 font-mono">
                                      {file.fileSize
                                        ? `${(file.fileSize / (1024 * 1024)).toFixed(2)} MB • Ready for Prepress`
                                        : 'Validated'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => triggerUploadForSlot(slot.slotKey)}
                                    disabled={Boolean(uploadingSlotKey)}
                                    className="text-xs font-semibold text-slate-700 hover:text-black hover:underline px-2 py-1 cursor-pointer disabled:opacity-50"
                                  >
                                    Replace
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSlotArtwork(slot.slotKey)}
                                    disabled={Boolean(uploadingSlotKey)}
                                    className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-50"
                                    title="Remove file"
                                  >
                                    <RiDeleteBinLine className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0 text-slate-500">
                                  <RiUploadCloud2Line className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span className="text-[11px] truncate">
                                    {isThisSlotUploading
                                      ? `Uploading ${slot.label}...`
                                      : `Attach ${slot.label} design`}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => triggerUploadForSlot(slot.slotKey)}
                                  disabled={Boolean(uploadingSlotKey)}
                                  className="h-8 px-3.5 bg-white hover:bg-amber-100/70 text-slate-900 text-xs font-bold rounded-lg border border-amber-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                                >
                                  {isThisSlotUploading ? (
                                    <>
                                      <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                                      <span>Uploading...</span>
                                    </>
                                  ) : (
                                    <>
                                      <RiAddLine className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Upload {slot.label}</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {uploadError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <RiAlertLine className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 leading-relaxed pt-0.5">
                    {artworkStatus === 'REQUIRED'
                      ? 'Attach print-ready files for each side now, or submit post-checkout. Production begins upon digital proof sign-off.'
                      : 'Attach your artwork files now or proceed to checkout and coordinate with our design prepress team.'}
                  </p>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptPattern}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>
              )}

              {/* ======================================================== */}
              {/* D. ADDITIONAL DETAILS / PRODUCTION NOTES                 */}
              {/* ======================================================== */}
              <div className="space-y-2 pt-5">
                <button
                  type="button"
                  onClick={() => setIsNotesExpanded(!isNotesExpanded)}
                  className="flex items-center justify-between w-full text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-slate-900 cursor-pointer"
                >
                  <span>Special Fabrication Notes (Optional)</span>
                  <span className="text-slate-400 text-xs">
                    {isNotesExpanded ? 'Collapse ▲' : 'Add Notes ▼'}
                  </span>
                </button>

                {isNotesExpanded && (
                  <div className="pt-1 space-y-1">
                    <textarea
                      rows={2}
                      value={customerNotes}
                      onChange={(e) => setCustomerNotes(e.target.value)}
                      onBlur={handleNotesBlur}
                      placeholder="e.g. Include black satin ribbon puller on matchbox drawer; add thumb cutouts..."
                      className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors"
                    />
                    <p className="text-[10px] text-slate-400">
                      Saved notes will be appended to the master Job Card for shop-floor production.
                    </p>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* E. PRICING BREAKDOWN                                     */}
              {/* ======================================================== */}
              <div className="space-y-2.5 pt-5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>
                    Subtotal ({qty} units × {formatCurrency(unitPrice)})
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>GST (18% Commercial Printing)</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatCurrency(tax)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Shipping & Logistics</span>
                  <span className="text-emerald-700 font-semibold">
                    Standard Free Delivery
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between text-sm">
                  <span className="font-black text-slate-900 font-display">
                    Estimated Total
                  </span>
                  <span className="text-base font-black text-slate-950 font-mono">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center space-y-3">
              <RiShoppingBag3Line className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Your cart is empty</p>
              <p className="text-xs text-slate-400">Configure a product to add it to your order queue.</p>
            </div>
          )}
        </div>

        {/* ======================================================== */}
        {/* F. DRAWER ACTIONS (STICKY FOOTER)                        */}
        {/* ======================================================== */}
        <div className="p-6 border-t border-slate-200 bg-white space-y-2.5 flex-shrink-0 shadow-lg">
          <button
            type="button"
            onClick={handleCheckoutClick}
            disabled={!item}
            className="w-full h-12 bg-[#FFED00] hover:bg-[#F2E100] text-black font-bold text-sm rounded-xl border border-black/10 shadow-xs flex items-center justify-center gap-2 transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-50"
          >
            <span>Proceed to Checkout</span>
            <RiArrowRightLine className="w-4 h-4 stroke-[2.2]" />
          </button>

          <div className="flex items-center justify-between gap-2 pt-1 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-600 hover:text-black font-medium py-1 px-2 rounded hover:bg-slate-100 transition-colors cursor-pointer"
            >
              &larr; Continue Shopping
            </button>

            <Link
              href="/cart"
              onClick={onClose}
              className="text-slate-600 hover:text-black font-semibold py-1 px-2 rounded hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
            >
              <span>View Full Cart &rarr;</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
