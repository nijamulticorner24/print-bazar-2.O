'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  RiLoader4Line,
  RiAlertLine,
  RiArrowLeftLine,
} from 'react-icons/ri';
import {
  api,
  DynamicProduct,
} from '@/lib/api';
import {
  ProductConfigurationFlow,
  ProductConfigurationResult,
  LivePricingSummary,
} from '@/components/configurator/ProductConfigurationFlow';
import { RigidBoxProductView } from '@/components/products/RigidBoxProductView';
import { CartDrawer, CartDrawerItem } from '@/components/cart/CartDrawer';
import { useAuth } from '@/lib/auth-context';
import { CustomerAuthModal } from '@/components/auth/CustomerAuthModal';
import { Button } from '@/components/ui';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const slug = (params.slug as string) || '';

  const [product, setProduct] = useState<DynamicProduct | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingCheckoutResult, setPendingCheckoutResult] = useState<ProductConfigurationResult | null>(null);
  const [livePricing, setLivePricing] = useState<LivePricingSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cart Drawer State for generic products
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerCartItem, setDrawerCartItem] = useState<CartDrawerItem | null>(null);

  // Fetch Product Schema from API
  useEffect(() => {
    async function loadProduct() {
      setIsLoadingProduct(true);
      setErrorMsg(null);
      try {
        const prod = await api.getProductBySlug(slug);
        setProduct(prod);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Product not found or currently unavailable');
      } finally {
        setIsLoadingProduct(false);
      }
    }
    if (slug) {
      loadProduct();
    }
  }, [slug]);

  // Handle Add to Cart for standard configurator
  const handleAddToCart = (result: ProductConfigurationResult) => {
    const minQ = Math.max(1, Number(result.product.minQuantity) || 1);
    const refUnit = Number(result.product.basePrice || 0) / minQ;
    const subtotal = result.quote?.subtotal || (result.subtotal ?? (refUnit * result.quantity));
    const tax = result.quote?.totalTax || Math.round(subtotal * 0.18 * 100) / 100;
    const grandTotal = result.grandTotal || (subtotal + tax);
    const isSplit = result.paymentMode === 'SPLIT_50';
    const advanceAmount = isSplit ? (result.advanceAmount || Math.round(grandTotal * 0.5 * 100) / 100) : grandTotal;
    const balanceAmount = isSplit ? (result.balanceAmount || Math.round((grandTotal - advanceAmount) * 100) / 100) : 0;
    const unitPrice = result.quote?.unitPrice || (result.quantity > 0 ? subtotal / result.quantity : refUnit);

    const cartItem: CartDrawerItem = {
      productId: result.product.id,
      productName: result.product.name,
      sku: result.product.sku,
      quantity: result.quantity,
      unitPrice,
      totalPrice: subtotal,
      subtotal,
      taxAmount: tax,
      grandTotal,
      specificationsSnapshot: result.quote?.specificationsSnapshot || result.fieldValues || {},
      selectedOptionsSummary: result.quote?.selectedOptionsSummary || [],
      artworkFile: result.artworkFile
        ? {
            fileUrl: result.artworkFile.fileUrl,
            originalFileName: result.artworkFile.originalFileName,
            fileSize: result.artworkFile.fileSize,
            mimeType: result.artworkFile.mimeType,
            storageKey: result.artworkFile.storageKey,
          }
        : null,
      designNotes: result.designNotes,
      paymentMode: result.paymentMode || 'FULL',
      advanceAmount,
      balanceAmount,
      quote: result.quote,
    };

    let currentCart: any[] = [];
    try {
      const raw = localStorage.getItem('pb2_cart');
      if (raw) currentCart = JSON.parse(raw);
      if (!Array.isArray(currentCart)) currentCart = [];
    } catch {}

    const existingIdx = currentCart.findIndex((it: any) => it.sku === cartItem.sku || it.productId === cartItem.productId);
    if (existingIdx >= 0) {
      currentCart[existingIdx] = cartItem;
    } else {
      currentCart.push(cartItem);
    }

    localStorage.setItem('pb2_cart', JSON.stringify(currentCart));
    sessionStorage.setItem('pb2_active_cart', JSON.stringify(cartItem));
    window.dispatchEvent(new Event('cart-updated'));

    // Open side drawer
    setDrawerCartItem(cartItem);
    setIsDrawerOpen(true);
  };

  // Handle Direct Buy Now / Checkout
  const handleBuyNow = (result: ProductConfigurationResult) => {
    handleAddToCart(result);
    if (user && user.role === 'CUSTOMER') {
      router.push('/checkout');
    } else {
      setPendingCheckoutResult(result);
      setIsAuthModalOpen(true);
    }
  };

  if (isLoadingProduct) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 bg-[#F8FAFC]">
        <RiLoader4Line className="h-10 w-10 text-[#FFED00] animate-spin mb-4" />
        <span className="text-xs font-mono text-slate-500 uppercase font-bold tracking-wider">
          Loading Manufacturing Engine & Spec Matrices...
        </span>
      </div>
    );
  }

  if (errorMsg || !product) {
    return (
      <div className="mx-auto max-w-xl my-16 bg-white border border-rose-200 rounded-2xl p-8 text-center shadow-card">
        <RiAlertLine className="h-12 w-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-black text-slate-900 font-display">Product Unavailable</h2>
        <p className="text-xs text-slate-600 mt-2">{errorMsg || 'The requested product could not be found.'}</p>
        <Link href="/products" className="inline-block mt-6">
          <Button variant="primary" size="md">
            <RiArrowLeftLine className="h-4 w-4 mr-1.5" />
            <span>Return to Catalogue</span>
          </Button>
        </Link>
      </div>
    );
  }

  // Check if this is the approved Custom Luxury Rigid Box product
  const normalizedSlug = slug.toLowerCase().trim();
  const isRigidBox =
    normalizedSlug === 'custom-rigid-box' ||
    normalizedSlug === 'custom-luxury-rigid-box' ||
    normalizedSlug === 'rigid-box' ||
    normalizedSlug === 'custom-packaging' ||
    product.sku === 'PRD-PKG-002' ||
    product.slug === 'custom-rigid-box';

  if (isRigidBox) {
    return <RigidBoxProductView product={product} />;
  }

  // Standard dynamic product view for other catalog items
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wider">
            <Link href="/" className="hover:text-slate-800 transition-colors">
              Home
            </Link>
            <span>&gt;</span>
            <Link href="/products" className="hover:text-slate-800 transition-colors">
              Products
            </Link>
            <span>&gt;</span>
            <span className="text-slate-900 font-bold">{product.name}</span>
          </nav>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight font-display">
            {product.name}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600 max-w-3xl">
            {product.description ||
              'High-precision commercial print calibrated on Heidelberg offset & HP Indigo presses.'}
          </p>
        </div>

        <ProductConfigurationFlow
          product={product}
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          onPriceChange={setLivePricing}
        />

        <CartDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeItem={drawerCartItem}
          onUpdateItem={(up) => setDrawerCartItem(up)}
          onProceedToCheckout={() => {
            if (drawerCartItem) {
              sessionStorage.setItem('pb2_active_cart', JSON.stringify(drawerCartItem));
            }
            if (user) {
              router.push('/checkout');
            } else {
              setIsAuthModalOpen(true);
            }
          }}
        />

        <CustomerAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => {
            setIsAuthModalOpen(false);
            router.push('/checkout');
          }}
        />
      </div>
    </div>
  );
}
