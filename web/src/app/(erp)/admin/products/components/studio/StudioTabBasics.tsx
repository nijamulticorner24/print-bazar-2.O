'use client';

import React, { useRef } from 'react';
import {
  RiImage2Line,
  RiDeleteBin7Line,
  RiSparklingFill,
  RiCheckLine,
  RiUploadCloud2Line,
  RiTruckLine,
  RiInformationLine,
} from 'react-icons/ri';
import { ProductCategoryItem, ProductImageItem, ProductOptionRequirement, api } from '@/lib/api';

export interface StudioTabBasicsProps {
  name: string;
  setName: (v: string) => void;
  slug: string;
  setSlug: (v: string) => void;
  sku: string;
  setSku: (v: string) => void;
  categoryId: string;
  setCategoryId: (v: string) => void;
  categories: ProductCategoryItem[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  setStatus: (v: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') => void;
  basePrice: number | string;
  setBasePrice: (v: number | string) => void;
  pricingModel: string;
  setPricingModel: (v: string) => void;
  minQuantity: number;
  setMinQuantity: (v: number) => void;
  quantityStep: number;
  setQuantityStep: (v: number) => void;
  maxQuantity: number;
  setMaxQuantity: (v: number) => void;
  productionDays: number;
  setProductionDays: (v: number) => void;
  description: string;
  setDescription: (v: string) => void;
  defaultSize: string;
  setDefaultSize: (v: string) => void;
  isFeatured: boolean;
  setIsFeatured: (v: boolean) => void;

  // Logistics
  shippingChargeType: string;
  setShippingChargeType: (v: string) => void;
  courierCharge: number | string;
  setCourierCharge: (v: number | string) => void;
  freeShippingThreshold: number | string;
  setFreeShippingThreshold: (v: number | string) => void;
  allowCod: boolean;
  setAllowCod: (v: boolean) => void;
  codSurcharge: number | string;
  setCodSurcharge: (v: number | string) => void;

  // Media
  images: ProductImageItem[];
  setImages: React.Dispatch<React.SetStateAction<ProductImageItem[]>>;
  isNew: boolean;
  productId: string;

  // Baseline Artwork & Design Policy (Contextually integrated)
  artworkRequirement?: ProductOptionRequirement;
  setArtworkRequirement?: React.Dispatch<React.SetStateAction<ProductOptionRequirement>> | ((v: any) => void);
  artworkFileFormats?: string[];
  setArtworkFileFormats?: React.Dispatch<React.SetStateAction<string[]>>;
  maxArtworkFileSizeMb?: number;
  setMaxArtworkFileSizeMb?: React.Dispatch<React.SetStateAction<number>> | ((v: any) => void);
  minimumArtworkMegapixels?: number;
  setMinimumArtworkMegapixels?: React.Dispatch<React.SetStateAction<number>> | ((v: any) => void);
  designServiceRequirement?: ProductOptionRequirement;
  setDesignServiceRequirement?: React.Dispatch<React.SetStateAction<ProductOptionRequirement>> | ((v: any) => void);
  designServiceFee?: number | string;
  setDesignServiceFee?: React.Dispatch<React.SetStateAction<number | string>> | ((v: any) => void);

  onChange?: () => void;
}

export function StudioTabBasics({
  name,
  setName,
  slug,
  setSlug,
  sku,
  setSku,
  categoryId,
  setCategoryId,
  categories,
  status,
  setStatus,
  basePrice,
  setBasePrice,
  pricingModel,
  setPricingModel,
  minQuantity,
  setMinQuantity,
  quantityStep,
  setQuantityStep,
  maxQuantity,
  setMaxQuantity,
  productionDays,
  setProductionDays,
  description,
  setDescription,
  defaultSize,
  setDefaultSize,
  isFeatured,
  setIsFeatured,
  shippingChargeType,
  setShippingChargeType,
  courierCharge,
  setCourierCharge,
  freeShippingThreshold,
  setFreeShippingThreshold,
  allowCod,
  setAllowCod,
  codSurcharge,
  setCodSurcharge,
  images,
  setImages,
  isNew,
  productId,
  artworkRequirement = 'OPTIONAL',
  setArtworkRequirement,
  artworkFileFormats = ['PDF', 'AI', 'PSD', 'CDR', 'TIFF', 'PNG', 'JPG'],
  setArtworkFileFormats,
  maxArtworkFileSizeMb = 50,
  setMaxArtworkFileSizeMb,
  minimumArtworkMegapixels = 1.5,
  setMinimumArtworkMegapixels,
  designServiceRequirement = 'DISABLED',
  setDesignServiceRequirement,
  designServiceFee = 0,
  setDesignServiceFee,
  onChange,
}: StudioTabBasicsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);

  // Auto-slug generator
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    onChange?.();
    if (isNew || !slug) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
      );
    }
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
    try {
      if (productId && !isNew) {
        const uploaded = await api.adminUploadProductImage(productId, file);
        setImages((prev) => [...prev, uploaded]);
      } else {
        const uploaded = await api.uploadMedia(file);
        setImages((prev) => [
          ...prev,
          {
            id: `temp-${Date.now()}`,
            productId: productId || 'temp',
            url: uploaded.url,
            storageKey: uploaded.filename,
            altText: name || 'Product image',
            sortOrder: prev.length,
            isPrimary: prev.length === 0,
          },
        ]);
      }
      onChange?.();
    } catch (err: any) {
      alert(err?.message || 'Failed to upload product media');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetPrimary = (index: number) => {
    setImages((prev) =>
      prev.map((img, idx) => ({
        ...img,
        isPrimary: idx === index,
      }))
    );
    onChange?.();
  };

  const handleDeleteImage = (index: number) => {
    setImages((prev) => {
      const copy = prev.filter((_, idx) => idx !== index);
      if (copy.length > 0 && !copy.some((img) => img.isPrimary)) {
        copy[0].isPrimary = true;
      }
      return copy;
    });
    onChange?.();
  };

  return (
    <div className="space-y-6 w-full">
      {/* 1. Core Identification */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <span>Product Core Identification & Categorization</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder="e.g. Premium Business Cards"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              URL Slug <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                onChange?.();
              }}
              placeholder="e.g. premium-business-cards"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product SKU <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={sku}
              onChange={(e) => {
                setSku(e.target.value);
                onChange?.();
              }}
              placeholder="e.g. SKU-VC-001"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono uppercase focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category <span className="text-rose-500">*</span>
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Catalogue Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as any);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="DRAFT">DRAFT (Hidden from storefront)</option>
              <option value="PUBLISHED">PUBLISHED (Live on storefront)</option>
              <option value="ARCHIVED">ARCHIVED (Discontinued)</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Starting Reference Rate (₹)
            </label>
            <input
              type="number"
              step="0.01"
              value={basePrice}
              onChange={(e) => {
                setBasePrice(e.target.value);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono font-bold focus:outline-none focus:border-amber-500 shadow-2xs"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Total reference amount for MOQ ({minQuantity} pcs). Reference Unit Price: <strong className="text-slate-900 font-mono">₹{(Number(basePrice) / Math.max(1, Number(minQuantity))).toFixed(4)}/pc</strong>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Qty (MOQ)</label>
            <input
              type="number"
              value={minQuantity}
              onChange={(e) => {
                setMinQuantity(parseInt(e.target.value, 10) || 1);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
            <p className="text-[10px] text-slate-400 mt-1">Starting reference threshold for unit pricing.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Qty Increment Step</label>
            <input
              type="number"
              value={quantityStep}
              onChange={(e) => {
                setQuantityStep(parseInt(e.target.value, 10) || 1);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Production SLA (Days)</label>
            <input
              type="number"
              value={productionDays}
              onChange={(e) => {
                setProductionDays(parseInt(e.target.value, 10) || 1);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Default Standard Size</label>
            <input
              type="text"
              value={defaultSize}
              onChange={(e) => {
                setDefaultSize(e.target.value);
                onChange?.();
              }}
              placeholder='e.g. 3.5" x 2" (89 x 51 mm)'
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                onChange?.();
              }}
              placeholder="Detailed commercial print specifications, finishes, and paper quality..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="checkbox"
            id="featured_check"
            checked={isFeatured}
            onChange={(e) => {
              setIsFeatured(e.target.checked);
              onChange?.();
            }}
            className="w-4 h-4 rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
          />
          <label htmlFor="featured_check" className="text-xs font-semibold text-slate-800 cursor-pointer">
            Feature this product on homepage & primary print catalogue banners
          </label>
        </div>
      </div>

      {/* 2. Shipping & Logistics */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
          <RiTruckLine className="w-4 h-4 text-amber-600" />
          <span>Fulfillment, Courier Rates & Logistics</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Shipping Charge Model</label>
            <select
              value={shippingChargeType}
              onChange={(e) => {
                setShippingChargeType(e.target.value);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-amber-500 shadow-2xs cursor-pointer"
            >
              <option value="DEFAULT">DEFAULT (Calculated based on store rules)</option>
              <option value="FIXED">FIXED (Explicit per-order charge)</option>
              <option value="FREE">FREE (Free delivery on this item)</option>
              <option value="QUANTITY_BASED">QUANTITY_BASED (Scales per item)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Courier Charge (₹)</label>
            <input
              type="number"
              value={courierCharge}
              onChange={(e) => {
                setCourierCharge(e.target.value);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Free Shipping Threshold (₹)</label>
            <input
              type="number"
              value={freeShippingThreshold}
              onChange={(e) => {
                setFreeShippingThreshold(e.target.value);
                onChange?.();
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:border-amber-500 shadow-2xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">COD Handling</label>
            <div className="flex items-center gap-3 mt-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowCod}
                  onChange={(e) => {
                    setAllowCod(e.target.checked);
                    onChange?.();
                  }}
                  className="rounded text-amber-500 border-slate-300 focus:ring-amber-500 cursor-pointer"
                />
                <span>Allow COD</span>
              </label>

              {allowCod && (
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">+₹</span>
                  <input
                    type="number"
                    value={codSurcharge}
                    onChange={(e) => {
                      setCodSurcharge(e.target.value);
                      onChange?.();
                    }}
                    placeholder="50"
                    className="w-16 bg-white border border-slate-300 rounded px-1.5 py-1 text-xs text-slate-900 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">fee</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Media Gallery */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <RiImage2Line className="w-4 h-4 text-amber-600" />
              <span>Product Gallery & Storefront Media ({images.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload crisp images showcasing printed samples, paper textures, and mockups.
            </p>
          </div>

          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUploadImage}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-[#FFED00] hover:bg-[#F2E100] text-[#0F172A] font-bold text-xs px-3.5 py-2 rounded-lg border border-[#E3A008]/40 shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RiUploadCloud2Line className="w-4 h-4" />
              <span>{isUploading ? 'Uploading...' : 'Upload Media'}</span>
            </button>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="p-8 border-2 border-dashed border-slate-200 rounded-xl text-center text-slate-400 text-xs">
            No media uploaded yet. Click &quot;Upload Media&quot; to add storefront photos.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {images.map((img, idx) => (
              <div
                key={img.id || idx}
                className={`relative group rounded-xl border overflow-hidden bg-slate-50 ${
                  img.isPrimary ? 'border-amber-500 ring-2 ring-amber-400' : 'border-slate-200'
                }`}
              >
                <div className="aspect-square w-full overflow-hidden bg-slate-100 flex items-center justify-center">
                  <img src={img.url} alt={img.altText || name} className="w-full h-full object-cover" />
                </div>

                {img.isPrimary && (
                  <span className="absolute top-1.5 left-1.5 bg-amber-500 text-black text-[9px] font-black uppercase px-1.5 py-0.5 rounded shadow">
                    Primary
                  </span>
                )}

                <div className="p-2 bg-white flex items-center justify-between gap-1 text-[11px]">
                  {!img.isPrimary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx)}
                      className="text-[10px] font-semibold text-slate-600 hover:text-amber-600"
                    >
                      Make Primary
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(idx)}
                    className="text-rose-500 hover:text-rose-700 ml-auto p-1 rounded"
                    title="Delete image"
                  >
                    <RiDeleteBin7Line className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
