'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  artworkFile?: {
    fileUrl: string;
    originalFileName: string;
    fileSize: number;
    mimeType?: string;
    storageKey?: string;
  } | null;
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

  const [isUploading, setIsUploading] = useState(false);
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

  if (!isOpen) return null;

  const item = activeItem;
  const specs = item?.specificationsSnapshot || {};
  const qty = item?.quantity || 50;
  const unitPrice = item?.unitPrice || 65;
  const subtotal = item?.subtotal || unitPrice * qty;
  const tax = item?.taxAmount || Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = item?.grandTotal || subtotal + tax;

  const hasArtwork = Boolean(item?.artworkFile?.fileUrl);

  // File Upload Handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !item) return;

    // Validate size (max 50MB) and type
    const validExtensions = ['.pdf', '.ai', '.psd', '.eps', '.png', '.jpg', '.jpeg', '.tiff', '.zip'];
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext));
    if (!hasValidExt) {
      setUploadError('Please select a valid print-ready file (.pdf, .ai, .psd, .tiff, .png, .jpg)');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setUploadError('Artwork exceeds the maximum allowable size of 50 MB.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const res = await api.uploadArtwork(file, item.productId);
      const updatedArtwork = {
        fileUrl: res.fileUrl,
        originalFileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        storageKey: res.storageKey,
      };

      const updatedItem: CartDrawerItem = {
        ...item,
        artworkFile: updatedArtwork,
      };

      if (onUpdateItem) {
        onUpdateItem(updatedItem);
      }

      // Update storage
      updateCartStorage(updatedItem);
    } catch (err: any) {
      setUploadError(err?.message || 'Failed to upload artwork. Please try again.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveArtwork = () => {
    if (!item) return;
    const updatedItem: CartDrawerItem = {
      ...item,
      artworkFile: null,
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

                {/* Compact Spec Grid */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Box Style:</span>
                    <span className="font-semibold text-slate-900">
                      {specs.boxStyle || specs['Box Style'] || 'Lid & Base (2-Piece)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Dimensions (mm):</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {specs.length || 220} × {specs.width || 160} × {specs.height || 60} mm
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Calculated Volume:</span>
                    <span className="font-mono text-slate-700 font-medium">
                      {(
                        (Number(specs.length) || 220) *
                        (Number(specs.width) || 160) *
                        (Number(specs.height) || 60)
                      ).toLocaleString()}{' '}
                      mm³
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Board Thickness:</span>
                    <span className="font-semibold text-slate-900">
                      {specs.boardThickness || specs['Board Thickness'] || '1000 GSM (1.5 mm)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Outer Wrap Material:</span>
                    <span className="font-semibold text-slate-900">
                      {specs.outerWrap || specs['Outer Wrap Material'] || 'Coated Art Paper (157 GSM)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Finishing:</span>
                    <span className="font-semibold text-slate-900">
                      {specs.finishing || specs['Finishing Options'] || 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="text-slate-500 font-medium">Insert Option:</span>
                    <span className="font-semibold text-slate-900">
                      {specs.insert || specs['Insert Options'] || 'None'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 font-medium">Quantity:</span>
                    <span className="font-mono font-bold text-slate-950">
                      {qty} units
                    </span>
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* C. ARTWORK STATUS WORKFLOW                               */}
              {/* ======================================================== */}
              <div className="space-y-3 pt-5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <RiFileTextLine className="w-4 h-4 text-[#E3A008]" />
                    <span>Artwork Status</span>
                  </h4>
                  {hasArtwork ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <RiCheckLine className="w-3.5 h-3.5" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      <RiAlertLine className="w-3.5 h-3.5" />
                      Artwork Required
                    </span>
                  )}
                </div>

                {!hasArtwork ? (
                  <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <RiInformationLine className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-900 space-y-1">
                        <p className="font-semibold">Artwork is needed for fabrication</p>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          You can upload your print-ready die-line or vector design now, or provide it after checkout. Production begins after proof approval.
                        </p>
                      </div>
                    </div>

                    <div className="pt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="h-8 px-3.5 bg-white hover:bg-amber-100/60 text-slate-900 text-xs font-bold rounded-lg border border-amber-300 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        {isUploading ? (
                          <>
                            <RiLoader4Line className="w-3.5 h-3.5 animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <RiUploadCloud2Line className="w-3.5 h-3.5 text-amber-700" />
                            <span>Upload Artwork Now</span>
                          </>
                        )}
                      </button>
                      <span className="text-[11px] text-amber-700 font-mono">
                        PDF, AI, PSD, PNG (Max 50MB)
                      </span>
                    </div>

                    {uploadError && (
                      <p className="text-xs text-rose-600 font-medium pt-1">
                        {uploadError}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
                        <RiFileTextLine className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {item.artworkFile?.originalFileName}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {item.artworkFile?.fileSize
                            ? `${(item.artworkFile.fileSize / (1024 * 1024)).toFixed(2)} MB • Ready for Prepress`
                            : 'Validated'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="text-xs font-semibold text-slate-700 hover:text-black hover:underline px-2 py-1 cursor-pointer"
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        onClick={handleRemoveArtwork}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Remove artwork"
                      >
                        <RiDeleteBinLine className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.ai,.psd,.eps,.tiff,.png,.jpg,.jpeg,.zip"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

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
