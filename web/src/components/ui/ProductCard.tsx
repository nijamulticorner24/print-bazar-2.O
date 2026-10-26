'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, ShoppingCart, User, Clock } from 'lucide-react';
import { useWishlist } from '@/lib/wishlist';

export interface ProductCardProps {
  id: string;
  name: string;
  description?: string;
  price: string | number;
  pricePrefix?: string;
  priceUnit?: string;
  href: string;
  image: string;
  fallbackImage?: string;
  tag?: string;
  sku?: string;
  categoryName?: string;
  productionDays?: number | string;
  actionText?: string;
  className?: string;
}

export function ProductCard({
  id,
  name,
  description,
  price,
  pricePrefix = 'FROM',
  priceUnit,
  href,
  image,
  fallbackImage = 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=800&auto=format&fit=crop&q=80',
  tag,
  sku,
  categoryName,
  productionDays,
  actionText = 'Add to cart',
  className = '',
}: ProductCardProps) {
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(id);

  // Format price string if number
  const displayPrice =
    typeof price === 'number'
      ? `₹${price.toLocaleString('en-IN')}`
      : price.startsWith('₹')
      ? price
      : `₹${price}`;

  const handleWishlistClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWishlist(id);
  };

  return (
    <Link
      href={href}
      className={`group relative bg-white rounded-[14px] border border-[#E5E7EB] hover:border-black/30 hover:shadow-lg hover:shadow-black/5 transition-all duration-200 overflow-hidden flex flex-col justify-between h-full touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFED00] focus-visible:ring-offset-2 ${className}`}
    >
      <div>
        {/* 1. Product Image Canvas with Top-Right Circular Wishlist Heart */}
        <div className="relative w-full aspect-[16/11] bg-[#F7F7F5] overflow-hidden border-b border-[#F1F5F9]">
          {/* Wishlist Button (Top-Right) */}
          <button
            type="button"
            onClick={handleWishlistClick}
            aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
            className="absolute top-2.5 right-2.5 z-20 h-8 w-8 rounded-full bg-white/90 backdrop-blur-xs hover:bg-white text-slate-600 hover:text-black flex items-center justify-center border border-black/5 shadow-xs transition-transform duration-150 active:scale-90"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                wishlisted
                  ? 'fill-[#FFED00] text-[#000000] stroke-[2.2]'
                  : 'text-slate-600 group-hover/btn:text-black'
              }`}
            />
          </button>

          {/* Product Image Asset */}
          <img
            src={image}
            alt={name}
            className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transform-none"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).src = fallbackImage;
            }}
          />
        </div>

        {/* 2. Structured Product Details Matching Reference */}
        <div className="p-3.5 sm:p-4 pb-2">
          {/* Badges Row: FEATURED & SKU */}
          <div className="flex items-center gap-1.5 flex-wrap min-h-[22px]">
            {tag && (
              <span className="inline-flex items-center bg-[#FFED00] text-black text-[9.5px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[4px] border border-black/10">
                {tag}
              </span>
            )}
            {sku && (
              <span className="inline-flex items-center bg-[#F1F5F9] text-[#64748B] text-[9.5px] font-mono font-medium px-2 py-0.5 rounded-[4px] border border-[#E2E8F0] truncate max-w-[120px]">
                {sku}
              </span>
            )}
          </div>

          {/* Product Name */}
          <h3 className="text-[14.5px] sm:text-[15.5px] font-bold text-[#111827] group-hover:text-black transition-colors leading-snug line-clamp-1 font-sans mt-1.5">
            {name}
          </h3>

          {/* Category with Outline User/Tag Icon */}
          {categoryName && (
            <div className="flex items-center gap-1 text-[11.5px] text-[#64748B] font-medium mt-0.5 truncate">
              <User className="h-3 w-3 text-[#94A3B8] shrink-0" />
              <span className="truncate">{categoryName}</span>
            </div>
          )}

          {/* Product Description */}
          {description && (
            <p className="text-[12px] text-[#64748B] line-clamp-2 leading-relaxed mt-1 font-sans min-h-[34px]">
              {description}
            </p>
          )}

          {/* Production SLA Badge (if available) */}
          {productionDays ? (
            <div className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-mono font-medium text-[#065F46] bg-[#ECFDF5] px-1.5 py-0.5 rounded-[4px] border border-[#A7F3D0] w-fit">
              <Clock className="h-2.5 w-2.5 text-[#065F46] stroke-[2.2] shrink-0" />
              <span>{productionDays}d Production SLA</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* 3. Pricing & Yellow Action Button */}
      <div className="p-3.5 sm:p-4 pt-1 mt-auto">
        <div className="pt-2 border-t border-[#F1F5F9] flex items-center justify-between gap-2 min-h-[44px]">
          {/* Price Section */}
          <div className="min-w-0">
            <span className="text-[9px] font-mono font-bold text-[#94A3B8] uppercase tracking-wider block leading-none">
              {pricePrefix}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5 flex-wrap">
              <span className="text-[17px] sm:text-[18px] font-bold text-[#111827] font-sans tabular-nums leading-none tracking-tight">
                {displayPrice}
              </span>
              {priceUnit && (
                <span className="text-[11px] text-[#64748B] font-normal leading-none truncate">
                  {priceUnit}
                </span>
              )}
            </div>
          </div>

          {/* Yellow Action CTA */}
          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-[8px] bg-[#FFED00] text-black text-[12px] sm:text-[12.5px] font-bold tracking-tight border border-black/10 shadow-2xs group-hover:bg-[#F2E100] active:scale-95 transition-all duration-150 shrink-0">
            <ShoppingCart className="h-3.5 w-3.5 stroke-[2.2]" />
            <span>{actionText}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
