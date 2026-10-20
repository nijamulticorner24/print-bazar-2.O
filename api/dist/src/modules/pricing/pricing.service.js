"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const shipping_gst_service_1 = require("../shipping-gst/shipping-gst.service");
function normalizeKey(str) {
    if (!str)
        return '';
    return String(str).toLowerCase().trim().replace(/[\s-]+/g, '_');
}
function matchesRuleCondition(rule, userSelections) {
    if (rule.isActive === false)
        return false;
    const payload = rule.actionPayload || {};
    if (payload.conditionCombination && typeof payload.conditionCombination === 'object') {
        const entries = Object.entries(payload.conditionCombination);
        if (entries.length === 0)
            return false;
        return entries.every(([grpCode, optVal]) => {
            const userVal = userSelections[grpCode];
            if (userVal === undefined || userVal === null)
                return false;
            return normalizeKey(userVal) === normalizeKey(optVal);
        });
    }
    const condVal = userSelections[rule.conditionGroupCode];
    if (condVal === undefined || condVal === null)
        return false;
    const normUser = normalizeKey(condVal);
    const normRule = normalizeKey(rule.conditionOptionValue);
    if (rule.conditionOperator === 'EQUALS') {
        return normUser === normRule;
    }
    if (rule.conditionOperator === 'NOT_EQUALS') {
        return normUser !== normRule;
    }
    if (rule.conditionOperator === 'IN') {
        const arr = Array.isArray(rule.conditionOptionValue)
            ? rule.conditionOptionValue.map((v) => normalizeKey(String(v)))
            : String(rule.conditionOptionValue).split(',').map((s) => normalizeKey(s));
        return arr.includes(normUser);
    }
    if (rule.conditionOperator === 'GREATER_THAN') {
        return Number(condVal) > Number(rule.conditionOptionValue);
    }
    if (rule.conditionOperator === 'LESS_THAN') {
        return Number(condVal) < Number(rule.conditionOptionValue);
    }
    return normUser === normRule;
}
let PricingService = class PricingService {
    prisma;
    shippingGstService;
    constructor(prisma, shippingGstService) {
        this.prisma = prisma;
        this.shippingGstService = shippingGstService;
    }
    async calculateQuote(dto) {
        let product = await this.prisma.product.findFirst({
            where: {
                OR: [
                    { id: dto.productId },
                    { slug: dto.productId },
                    { sku: dto.productId },
                ],
            },
            include: {
                optionGroups: {
                    include: {
                        options: {
                            orderBy: { sortOrder: 'asc' },
                        },
                    },
                    orderBy: { sortOrder: 'asc' },
                },
                configurationRules: {
                    where: { isActive: true },
                },
                pricingMatrices: {
                    orderBy: { minQty: 'asc' },
                },
            },
        });
        if (!product) {
            product = await this.prisma.product.findFirst({
                where: { status: 'PUBLISHED' },
                include: {
                    optionGroups: {
                        include: {
                            options: {
                                orderBy: { sortOrder: 'asc' },
                            },
                        },
                        orderBy: { sortOrder: 'asc' },
                    },
                    configurationRules: {
                        where: { isActive: true },
                    },
                    pricingMatrices: {
                        orderBy: { minQty: 'asc' },
                    },
                },
            });
        }
        if (!product) {
            throw new common_1.NotFoundException(`Product with ID '${dto.productId}' not found`);
        }
        if (dto.quantity < product.minQuantity) {
            throw new common_1.BadRequestException(`Minimum quantity for ${product.name} is ${product.minQuantity}`);
        }
        if (dto.quantity > product.maxQuantity) {
            throw new common_1.BadRequestException(`Maximum quantity for ${product.name} is ${product.maxQuantity}`);
        }
        const userSelections = { ...(dto.fieldValues || {}) };
        if (dto.options && dto.options.length > 0) {
            for (const opt of dto.options) {
                if (!userSelections[opt.optionCode]) {
                    userSelections[opt.optionCode] = opt.valueCode;
                }
            }
        }
        let optionsUnitModifier = 0;
        let percentageModifierTotal = 0;
        const groupOptionModifiers = new Map();
        const selectedOptionsSummary = [];
        const specificationsSnapshot = {};
        const optionGroups = product.optionGroups || product.options || [];
        const configurationRules = product.configurationRules || [];
        for (const group of optionGroups) {
            let isVisible = true;
            for (const rule of configurationRules) {
                if (rule.isActive === false)
                    continue;
                if (rule.targetGroupCode === group.code) {
                    const conditionMet = matchesRuleCondition(rule, userSelections);
                    if ((rule.actionType === 'HIDE' || rule.actionType === 'HIDE_OPTION') && conditionMet) {
                        const isPrintingLocation = /print(ing)?_?(loc(ation)?|side)/i.test(rule.targetGroupCode || '');
                        const isDesignCondition = /design/i.test(rule.conditionGroupCode || '');
                        if (isPrintingLocation && isDesignCondition) {
                            continue;
                        }
                        isVisible = false;
                    }
                    else if (rule.actionType === 'SHOW' && !conditionMet) {
                        const isPrintingLocation = /print(ing)?_?(loc(ation)?|side)/i.test(rule.targetGroupCode || '');
                        const isDesignCondition = /design/i.test(rule.conditionGroupCode || '');
                        if (isPrintingLocation && isDesignCondition) {
                            continue;
                        }
                        isVisible = false;
                    }
                }
            }
            if (!isVisible) {
                delete userSelections[group.code];
                continue;
            }
            for (const rule of configurationRules) {
                if (rule.isActive === false)
                    continue;
                if (rule.targetGroupCode === group.code && rule.targetOptionValue) {
                    const conditionMet = matchesRuleCondition(rule, userSelections);
                    if ((rule.actionType === 'HIDE' || rule.actionType === 'HIDE_OPTION') && conditionMet) {
                        if (normalizeKey(userSelections[group.code]) === normalizeKey(rule.targetOptionValue)) {
                            delete userSelections[group.code];
                        }
                    }
                }
            }
            const groupOptions = group.options || group.values || [];
            const selectedVal = userSelections[group.code];
            if (group.isRequired && (selectedVal === undefined || selectedVal === null || selectedVal === '')) {
                const defaultOpt = groupOptions.find((o) => o.isDefault) || groupOptions[0];
                if (defaultOpt) {
                    userSelections[group.code] = defaultOpt.value || defaultOpt.code;
                }
            }
            const activeVal = userSelections[group.code];
            if (activeVal === undefined || activeVal === null || activeVal === '') {
                continue;
            }
            const matchedOption = groupOptions.find((o) => (o.value || o.code) === String(activeVal));
            if (matchedOption) {
                const modVal = Number(matchedOption.priceModifier || 0);
                if (modVal < 0) {
                    throw new common_1.BadRequestException(`Option charge for '${matchedOption.label || matchedOption.name || group.name}' cannot be negative.`);
                }
                groupOptionModifiers.set(group.code, { modVal, type: matchedOption.priceModifierType || 'FIXED' });
                if (matchedOption.priceModifierType === 'FIXED' || matchedOption.priceModifierType === 'PER_UNIT') {
                    optionsUnitModifier += modVal;
                }
                else if (matchedOption.priceModifierType === 'PERCENTAGE') {
                    percentageModifierTotal += modVal;
                }
                selectedOptionsSummary.push({
                    optionName: group.name || group.label,
                    optionCode: group.code,
                    valueName: matchedOption.label || matchedOption.name,
                    valueCode: matchedOption.value || matchedOption.code,
                    priceModifier: modVal,
                });
                specificationsSnapshot[group.code] = {
                    label: group.label || group.name,
                    value: matchedOption.value || matchedOption.code,
                    displayValue: matchedOption.label || matchedOption.name,
                    priceModifier: modVal,
                };
            }
            else {
                specificationsSnapshot[group.code] = {
                    label: group.label || group.name,
                    value: activeVal,
                    displayValue: String(activeVal),
                };
            }
        }
        const startingReferenceRate = Number(product.basePrice || 0);
        const minQuantity = Math.max(1, Number(product.minQuantity) || 1);
        const referenceUnitPrice = startingReferenceRate > 0
            ? Math.round((startingReferenceRate / minQuantity) * 10000) / 10000
            : 0;
        const originalBasePrice = startingReferenceRate;
        let baseUnitPrice = referenceUnitPrice;
        let appliedOffer = null;
        const availableOffers = [];
        let matchedSpecificCombo = false;
        let bestMatchingRule = null;
        const isBaseOnly = product.pricingModel === 'BASE_ONLY';
        const isSingleTypeProduct = product.pricingModel === 'SINGLE' ||
            product.pricingModel === 'SINGLE_RANGE' ||
            (product.tags && product.tags.includes('SINGLE_TYPE'));
        if (isSingleTypeProduct && product.pricingMatrices && product.pricingMatrices.length > 0) {
            const sortedMatrices = [...product.pricingMatrices].sort((a, b) => a.minQty - b.minQty);
            for (const m of sortedMatrices) {
                const combo = m.attributeCombination || {};
                const isBase = combo.isBasePrice === true || combo.type === 'BASE' || !combo.attributeCode;
                if (isBase) {
                    const rulePrice = Number(m.unitPrice);
                    const label = m.minQty === m.maxQty
                        ? `Qty ${m.minQty}: ₹${rulePrice.toFixed(2)}/pc`
                        : `Qty ${m.minQty}–${m.maxQty}: ₹${rulePrice.toFixed(2)}/pc`;
                    availableOffers.push({
                        id: m.id,
                        minQty: m.minQty,
                        maxQty: m.maxQty,
                        discountPercent: referenceUnitPrice > rulePrice && referenceUnitPrice > 0
                            ? Math.round(((referenceUnitPrice - rulePrice) / referenceUnitPrice) * 100)
                            : 0,
                        unitPrice: rulePrice,
                        label,
                    });
                }
            }
            const matchingRangeRules = product.pricingMatrices.filter((m) => dto.quantity >= m.minQty && (m.maxQty === null || m.maxQty === undefined || dto.quantity <= m.maxQty));
            if (matchingRangeRules.length > 0) {
                const baseRule = matchingRangeRules.find((m) => {
                    const combo = m.attributeCombination || {};
                    return (combo.isBasePrice === true ||
                        combo.type === 'BASE' ||
                        (!combo.attributeCode && !combo.type) ||
                        Object.keys(combo).filter((k) => !['label', 'rangeLabel', 'quantityRanges', 'discountPercent', 'offerName', 'isBasePrice', 'type'].includes(k)).length === 0);
                }) || matchingRangeRules[0];
                baseUnitPrice = Number(baseRule.unitPrice);
                let singleTypeAddonModifier = 0;
                for (const [fieldKey, userVal] of Object.entries(userSelections)) {
                    if (userVal === undefined || userVal === null || userVal === '')
                        continue;
                    const attrRule = matchingRangeRules.find((m) => {
                        const combo = m.attributeCombination || {};
                        return ((combo.type === 'ATTRIBUTE' &&
                            combo.attributeCode?.toLowerCase() === fieldKey.toLowerCase() &&
                            String(combo.attributeValue)?.toLowerCase() === String(userVal).toLowerCase()) ||
                            (combo[fieldKey] !== undefined && String(combo[fieldKey]) === String(userVal)));
                    });
                    if (attrRule) {
                        const rawVal = Number(attrRule.unitPrice || attrRule.attributeCombination?.extraPrice || 0);
                        const extra = rawVal > baseUnitPrice && baseUnitPrice > 0 ? rawVal - baseUnitPrice : rawVal;
                        if (extra > 0) {
                            singleTypeAddonModifier += extra;
                            const existingSummary = selectedOptionsSummary.find((s) => s.optionCode === fieldKey);
                            if (existingSummary) {
                                existingSummary.priceModifier = extra;
                            }
                        }
                    }
                }
                if (singleTypeAddonModifier > 0) {
                    optionsUnitModifier = singleTypeAddonModifier;
                }
                const firstBaseRule = sortedMatrices.find((m) => {
                    const combo = m.attributeCombination || {};
                    return combo.isBasePrice === true || combo.type === 'BASE';
                }) || sortedMatrices[0];
                const firstRate = Number(firstBaseRule.unitPrice);
                if (firstRate > baseUnitPrice && firstRate > 0) {
                    const savingsPerUnit = firstRate - baseUnitPrice;
                    const disc = Math.round((savingsPerUnit / firstRate) * 100);
                    appliedOffer = {
                        offerId: baseRule.id,
                        minQty: baseRule.minQty,
                        maxQty: baseRule.maxQty,
                        discountPercent: disc,
                        offerName: `Volume Savings (${disc}% OFF for Qty ${baseRule.minQty}–${baseRule.maxQty})`,
                        savingsAmount: Math.round(savingsPerUnit * dto.quantity * 100) / 100,
                    };
                }
            }
        }
        else if (isBaseOnly) {
            baseUnitPrice = referenceUnitPrice;
            if (product.pricingMatrices && product.pricingMatrices.length > 0) {
                const sortedMatrices = [...product.pricingMatrices].sort((a, b) => a.minQty - b.minQty);
                const matchingTier = sortedMatrices.find((m) => dto.quantity >= m.minQty && (m.maxQty === null || m.maxQty === undefined || dto.quantity <= m.maxQty));
                if (matchingTier && Number(matchingTier.unitPrice) > 0) {
                    baseUnitPrice = Number(matchingTier.unitPrice);
                }
            }
        }
        else if (product.pricingMatrices && product.pricingMatrices.length > 0) {
            const sortedMatrices = [...product.pricingMatrices].sort((a, b) => a.minQty - b.minQty);
            const addOnCodes = new Set();
            for (const group of optionGroups) {
                if (group.inputType === 'CHECKBOX' || group.isRequired === false) {
                    addOnCodes.add(group.code.toLowerCase());
                }
            }
            const matchingComboMatrices = sortedMatrices.filter((m) => {
                const combo = m.attributeCombination || {};
                const comboEntries = Object.entries(combo).filter(([k]) => !['discountPercent', 'label', 'offerName', 'isExcluded', 'status', 'exclusionReason', 'type', 'isBasePrice', 'price', 'totalPrice', 'quantity'].includes(k));
                if (comboEntries.length === 0)
                    return false;
                return comboEntries.every(([k, v]) => String(userSelections[k]) === String(v));
            });
            const hasBaseRules = sortedMatrices.some((m) => {
                const c = m.attributeCombination || {};
                const entries = Object.entries(c).filter(([k]) => !['discountPercent', 'label', 'offerName', 'isExcluded', 'status', 'exclusionReason', 'type', 'isBasePrice', 'price', 'totalPrice', 'quantity'].includes(k));
                return entries.length === 0;
            });
            bestMatchingRule = null;
            let highestMatchSpecificity = -1;
            if (matchingComboMatrices.length > 0) {
                const exactQtyMatch = matchingComboMatrices.find((m) => m.minQty === dto.quantity) ||
                    matchingComboMatrices.find((m) => m.minQty <= dto.quantity &&
                        (m.maxQty && m.maxQty >= m.minQty ? dto.quantity <= m.maxQty : false));
                if (!exactQtyMatch) {
                    const avail = matchingComboMatrices
                        .filter((m) => {
                        const c = m.attributeCombination || {};
                        return !c.isExcluded && c.status !== 'EXCLUDED';
                    })
                        .map((m) => (m.maxQty && m.maxQty > m.minQty ? `${m.minQty}–${m.maxQty}` : `${m.minQty}`))
                        .sort();
                    throw new common_1.BadRequestException(`Quantity ${dto.quantity} is not available for this combination. Please select an available quantity${avail.length > 0 ? ` (${avail.join(', ')})` : ''}.`);
                }
                const combo = exactQtyMatch.attributeCombination || {};
                if (combo.isExcluded === true || combo.status === 'EXCLUDED') {
                    throw new common_1.BadRequestException('The selected product option combination is not supported for production.');
                }
                const comboExactPrice = combo.price ?? combo.totalPrice;
                if (comboExactPrice !== undefined && comboExactPrice !== null && Number(comboExactPrice) > 0) {
                    baseUnitPrice = Number(comboExactPrice) / dto.quantity;
                }
                else {
                    baseUnitPrice = Number(exactQtyMatch.unitPrice);
                }
                bestMatchingRule = {
                    rule: exactQtyMatch,
                    discountPercent: Number(combo.discountPercent || 0),
                    label: combo.label || `Quantity ${dto.quantity}`,
                    isSpecific: true,
                };
            }
            else if (!hasBaseRules) {
                if (product.pricingModel === 'AUTOMATIC') {
                    baseUnitPrice = referenceUnitPrice;
                }
                else {
                    throw new common_1.BadRequestException('This combination is currently unavailable. Please select another configuration.');
                }
            }
            else {
                for (const m of sortedMatrices) {
                    const combo = m.attributeCombination || {};
                    const ruleUnitPrice = Number(m.unitPrice);
                    let discountPercent = combo.discountPercent !== undefined ? Number(combo.discountPercent) : 0;
                    if (!discountPercent && ruleUnitPrice < referenceUnitPrice && referenceUnitPrice > 0) {
                        discountPercent = Math.round(((referenceUnitPrice - ruleUnitPrice) / referenceUnitPrice) * 100);
                    }
                    const label = combo.label ||
                        combo.offerName ||
                        (discountPercent > 0
                            ? `${discountPercent}% OFF (${m.minQty.toLocaleString()}–${m.maxQty.toLocaleString()} units)`
                            : `Special Tier Price (${m.minQty.toLocaleString()}–${m.maxQty.toLocaleString()} units)`);
                    availableOffers.push({
                        id: m.id,
                        minQty: m.minQty,
                        maxQty: m.maxQty,
                        discountPercent,
                        unitPrice: ruleUnitPrice,
                        label,
                    });
                    const isExactQtyMatch = dto.quantity === m.minQty;
                    const isBracketMatch = dto.quantity >= m.minQty && (m.maxQty && m.maxQty > m.minQty ? dto.quantity <= m.maxQty : true);
                    const isThresholdMatch = dto.quantity >= m.minQty;
                    if (isExactQtyMatch || isBracketMatch || isThresholdMatch) {
                        const comboEntries = Object.entries(combo).filter(([k]) => !['discountPercent', 'label', 'offerName', 'isExcluded', 'status', 'exclusionReason', 'type', 'isBasePrice', 'price', 'totalPrice', 'quantity'].includes(k));
                        if (comboEntries.length === 0) {
                            const qtyScore = isExactQtyMatch ? 1000000 : m.minQty;
                            if (highestMatchSpecificity <= 0 && qtyScore > highestMatchSpecificity) {
                                bestMatchingRule = { rule: m, discountPercent, label, isSpecific: false };
                                highestMatchSpecificity = 0;
                            }
                        }
                        else {
                            const allMatch = comboEntries.every(([k, v]) => String(userSelections[k]) === String(v));
                            if (allMatch) {
                                const qtyScore = isExactQtyMatch ? 1000000 : m.minQty;
                                const ruleScore = comboEntries.length * 10000000 + qtyScore;
                                if (ruleScore > highestMatchSpecificity) {
                                    bestMatchingRule = { rule: m, discountPercent, label, isSpecific: true };
                                    highestMatchSpecificity = ruleScore;
                                }
                            }
                        }
                    }
                }
            }
            if (bestMatchingRule) {
                const { rule, discountPercent, label, isSpecific } = bestMatchingRule;
                const combo = rule.attributeCombination || {};
                if (combo.isExcluded === true || combo.status === 'EXCLUDED') {
                    throw new common_1.BadRequestException('The selected product option combination is not supported for production.');
                }
                const ruleUnitPrice = Number(rule.unitPrice);
                if (discountPercent > 0) {
                    baseUnitPrice = Math.round(referenceUnitPrice * (1 - discountPercent / 100) * 10000) / 10000;
                }
                else if (ruleUnitPrice > 0) {
                    baseUnitPrice = ruleUnitPrice;
                    if (referenceUnitPrice > ruleUnitPrice && referenceUnitPrice > 0) {
                        const calculatedDisc = Math.round(((referenceUnitPrice - ruleUnitPrice) / referenceUnitPrice) * 100);
                        appliedOffer = {
                            offerId: rule.id,
                            minQty: rule.minQty,
                            maxQty: rule.maxQty,
                            discountPercent: calculatedDisc,
                            offerName: label,
                            savingsAmount: Math.round((referenceUnitPrice - ruleUnitPrice) * dto.quantity * 100) / 100,
                        };
                    }
                }
                if (isSpecific) {
                    matchedSpecificCombo = true;
                    const combo = rule.attributeCombination || {};
                    const comboKeys = new Set(Object.keys(combo).filter((k) => ![
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
                    ].includes(k)));
                    optionsUnitModifier = 0;
                    for (const [grpCode, { modVal, type }] of groupOptionModifiers.entries()) {
                        if (!comboKeys.has(grpCode)) {
                            if (type === 'FIXED' || type === 'PER_UNIT') {
                                optionsUnitModifier += modVal;
                            }
                        }
                    }
                }
                if (!appliedOffer && discountPercent > 0) {
                    const savingsPerUnit = Math.max(0, originalBasePrice - baseUnitPrice);
                    appliedOffer = {
                        offerId: rule.id,
                        minQty: rule.minQty,
                        maxQty: rule.maxQty,
                        discountPercent,
                        offerName: label,
                        savingsAmount: Math.round(savingsPerUnit * dto.quantity * 100) / 100,
                    };
                }
            }
        }
        if (!appliedOffer && configurationRules && configurationRules.length > 0) {
            for (const rule of configurationRules) {
                if (!rule.isActive)
                    continue;
                if (rule.actionType === 'VOLUME_DISCOUNT' || rule.actionType === 'TIER_DISCOUNT') {
                    const payload = rule.actionPayload || {};
                    const ruleMinQty = Number(payload.minQty || rule.conditionOptionValue || 0);
                    const ruleMaxQty = payload.maxQty ? Number(payload.maxQty) : Infinity;
                    if (dto.quantity >= ruleMinQty && dto.quantity <= ruleMaxQty) {
                        const discPercent = Number(payload.discountPercent || payload.percent || 0);
                        if (discPercent > 0) {
                            const discountedRate = Math.round(baseUnitPrice * (1 - discPercent / 100) * 10000) / 10000;
                            const savingsUnit = baseUnitPrice - discountedRate;
                            baseUnitPrice = discountedRate;
                            appliedOffer = {
                                offerId: `rule-${rule.id}`,
                                minQty: ruleMinQty,
                                maxQty: ruleMaxQty === Infinity ? 100000 : ruleMaxQty,
                                discountPercent: discPercent,
                                offerName: rule.name || `${discPercent}% OFF for Qty ${ruleMinQty}+`,
                                savingsAmount: Math.round(savingsUnit * dto.quantity * 100) / 100,
                            };
                            break;
                        }
                    }
                }
            }
        }
        let artworkFee = 0;
        const artworkReq = product.artworkRequirement || 'OPTIONAL';
        const rawArtworkPrice = Number(product.artworkPrice) || 0;
        if (artworkReq === 'REQUIRED') {
            artworkFee = rawArtworkPrice;
        }
        else if (artworkReq === 'OPTIONAL' && dto.hasArtwork) {
            artworkFee = rawArtworkPrice;
        }
        let designServiceFee = 0;
        const designReq = product.designServiceRequirement || 'DISABLED';
        const rawDesignPrice = Number(product.designServiceFee ?? product.designServicePrice) || 0;
        const userDesignOpt = String(userSelections['design_required'] ?? userSelections['design_service'] ?? userSelections['design'] ?? '').toLowerCase();
        const isExplicitNoDesign = userDesignOpt === 'no' || userDesignOpt === 'false';
        const wantsDesign = !isExplicitNoDesign &&
            (dto.hasDesignService === true ||
                userDesignOpt === 'yes' ||
                userDesignOpt === 'true' ||
                userDesignOpt === 'required' ||
                designReq === 'REQUIRED');
        if (userSelections['design_scope']) {
            const scopeGroup = optionGroups.find((g) => g.code === 'design_scope');
            if (scopeGroup && scopeGroup.options) {
                const validScope = scopeGroup.options.some((o) => normalizeKey(o.value || o.code) === normalizeKey(userSelections['design_scope']));
                if (!validScope) {
                    throw new common_1.BadRequestException(`Invalid design scope '${userSelections['design_scope']}' selected for this product.`);
                }
            }
        }
        const matrixIncludesDesign = Boolean(bestMatchingRule?.isSpecific &&
            bestMatchingRule.rule?.attributeCombination &&
            Object.keys(bestMatchingRule.rule.attributeCombination).some((k) => /design/i.test(k)));
        if (wantsDesign && !matrixIncludesDesign) {
            let resolvedFromRule = false;
            for (const rule of configurationRules) {
                if (!rule.isActive)
                    continue;
                const isArtRule = rule.actionType === 'ARTWORK_CONDITIONS' ||
                    rule.actionType === 'CONFIGURE_ARTWORK' ||
                    rule.actionType === 'REQUIRE_ARTWORK_FILES';
                if (isArtRule && matchesRuleCondition(rule, userSelections)) {
                    const payload = rule.actionPayload || {};
                    if (payload.designFee !== undefined && payload.designFeeEnabled !== false) {
                        const feeNum = Number(payload.designFee);
                        if (feeNum < 0) {
                            throw new common_1.BadRequestException('Configured design service amount cannot be negative.');
                        }
                        designServiceFee = feeNum;
                        resolvedFromRule = true;
                        break;
                    }
                }
            }
            if (!resolvedFromRule) {
                let detectedScope = normalizeKey(userSelections['design_scope']);
                if (!detectedScope) {
                    const loc = normalizeKey(userSelections['print_location'] ||
                        userSelections['printing_location'] ||
                        userSelections['printing_side'] ||
                        userSelections['location']);
                    if (loc.includes('both') || loc.includes('2') || loc.includes('double') || loc.includes('full')) {
                        detectedScope = 'full';
                    }
                    else if (loc.includes('back')) {
                        detectedScope = 'back';
                    }
                    else if (loc.includes('front')) {
                        detectedScope = 'front';
                    }
                }
                for (const rule of configurationRules) {
                    if (!rule.isActive)
                        continue;
                    const payload = rule.actionPayload || {};
                    const ruleScope = normalizeKey(payload.designScope || rule.conditionOptionValue);
                    if (detectedScope && ruleScope === detectedScope) {
                        const feeVal = payload.designFee ?? payload.amount;
                        if (feeVal !== undefined && feeVal !== null) {
                            const feeNum = Number(feeVal);
                            if (feeNum < 0) {
                                throw new common_1.BadRequestException('Configured design service amount cannot be negative.');
                            }
                            designServiceFee = feeNum;
                            resolvedFromRule = true;
                            break;
                        }
                    }
                }
            }
            if (!resolvedFromRule) {
                if (rawDesignPrice < 0) {
                    throw new common_1.BadRequestException('Configured design service amount cannot be negative.');
                }
                designServiceFee = rawDesignPrice;
            }
        }
        else {
            designServiceFee = 0;
        }
        const refReq = product.referenceImageRequirement || 'DISABLED';
        let unitPrice = (baseUnitPrice + optionsUnitModifier) * (1 + percentageModifierTotal / 100);
        unitPrice = Math.round(unitPrice * 100) / 100;
        const baseSubtotal = referenceUnitPrice > 0
            ? Math.round(referenceUnitPrice * dto.quantity * 100) / 100
            : Math.round(baseUnitPrice * dto.quantity * 100) / 100;
        const dynamicModifiersTotal = Math.round(optionsUnitModifier * dto.quantity * 100) / 100;
        const discountAmount = appliedOffer ? appliedOffer.savingsAmount : 0;
        const discountPercent = appliedOffer ? appliedOffer.discountPercent : 0;
        const appliedCharges = [];
        const activeChargeMap = new Map();
        for (const rule of configurationRules) {
            if (rule.isActive === false)
                continue;
            const conditionMet = matchesRuleCondition(rule, userSelections);
            if (conditionMet && (rule.actionType === 'APPLY_CHARGE' || rule.actionType === 'ADD_CHARGE')) {
                const payload = rule.actionPayload || {};
                const chargeId = payload.chargeId || `charge-${rule.id}`;
                const chargeName = payload.name || rule.name || '';
                if (designServiceFee > 0 && (/design/i.test(chargeId) || /design/i.test(chargeName))) {
                    continue;
                }
                const rawAmount = Number(payload.amount ?? payload.price ?? 0);
                const calcType = payload.calculationType || 'FIXED';
                let effectiveChargeAmount = 0;
                if (calcType === 'PER_UNIT') {
                    effectiveChargeAmount = Math.round(rawAmount * dto.quantity * 100) / 100;
                }
                else if (calcType === 'PERCENTAGE') {
                    effectiveChargeAmount = Math.round(baseSubtotal * (rawAmount / 100) * 100) / 100;
                }
                else {
                    effectiveChargeAmount = rawAmount;
                }
                activeChargeMap.set(chargeId, {
                    chargeId,
                    name: payload.name || rule.name,
                    amount: effectiveChargeAmount,
                    calculationType: calcType,
                    description: payload.description,
                });
            }
            else if (conditionMet && (rule.actionType === 'REMOVE_CHARGE' || rule.actionType === 'WAIVE_CHARGE')) {
                const payload = rule.actionPayload || {};
                const chargeId = payload.chargeId || `charge-${rule.id}`;
                activeChargeMap.delete(chargeId);
            }
        }
        let additionalChargesTotal = 0;
        for (const chg of activeChargeMap.values()) {
            appliedCharges.push(chg);
            additionalChargesTotal += chg.amount;
        }
        additionalChargesTotal = Math.round(additionalChargesTotal * 100) / 100;
        const printItemsTotal = Math.round(unitPrice * dto.quantity * 100) / 100;
        const subtotal = Math.round((printItemsTotal + artworkFee + designServiceFee + additionalChargesTotal) * 100) / 100;
        const deliveryMethod = dto.deliveryMethod || 'COURIER';
        const shipTaxResult = await this.shippingGstService.calculateShippingAndTax(subtotal, dto.shippingPincode, deliveryMethod === 'STORE_PICKUP' ? 'STORE_PICKUP' : 'COURIER', dto.isInterState || false);
        const cgst = shipTaxResult.cgst;
        const sgst = shipTaxResult.sgst;
        const igst = shipTaxResult.igst;
        const totalTax = shipTaxResult.gstAmount;
        const estimatedShipping = shipTaxResult.shippingFee;
        const courierRate = shipTaxResult.baseShippingFee;
        const freeShippingThreshold = shipTaxResult.freeShippingThreshold;
        const allowCod = false;
        const codSurcharge = 0;
        const codCharge = 0;
        const paymentMethod = dto.paymentMethod || 'FULL';
        const grandTotal = Math.round((subtotal + totalTax + estimatedShipping) * 100) / 100;
        specificationsSnapshot['_artworkRequirement'] = {
            requirement: artworkReq,
            price: rawArtworkPrice,
            feeApplied: artworkFee,
            qualityVerification: product.artworkQualityVerification,
            minimumMegapixels: product.minimumArtworkMegapixels,
        };
        specificationsSnapshot['_referenceImageRequirement'] = {
            requirement: refReq,
        };
        specificationsSnapshot['_designServiceRequirement'] = {
            requirement: designReq,
            price: rawDesignPrice,
            feeApplied: designServiceFee,
        };
        specificationsSnapshot['_fulfillment'] = {
            deliveryMethod,
            courierCharge: courierRate,
            freeShippingThreshold,
            shippingApplied: estimatedShipping,
            paymentMethod,
            allowCod,
            codSurcharge,
            codChargeApplied: codCharge,
        };
        if (appliedOffer) {
            specificationsSnapshot['_appliedOffer'] = appliedOffer;
        }
        if (appliedCharges.length > 0) {
            specificationsSnapshot['_appliedCharges'] = appliedCharges;
        }
        return {
            startingReferenceRate,
            referenceUnitPrice,
            basePrice: referenceUnitPrice > 0 ? referenceUnitPrice : originalBasePrice,
            originalBasePrice,
            effectiveBasePrice: baseUnitPrice,
            quantity: dto.quantity,
            baseSubtotal,
            optionsCost: dynamicModifiersTotal,
            dynamicModifiersTotal,
            discountAmount,
            discountPercent,
            artworkFee,
            designServiceFee,
            additionalChargesTotal,
            appliedCharges,
            artworkRequirement: artworkReq,
            designServiceRequirement: designReq,
            referenceImageRequirement: refReq,
            unitPrice,
            subtotal,
            cgst,
            sgst,
            igst,
            totalTax,
            courierCharge: courierRate,
            freeShippingThreshold,
            estimatedShipping,
            matchedZone: shipTaxResult.matchedZone,
            isFreeShippingApplied: shipTaxResult.isFreeShippingApplied,
            gstRatePercent: shipTaxResult.gstRatePercent,
            allowCod,
            codSurcharge,
            codCharge,
            deliveryMethod,
            paymentMethod,
            grandTotal,
            productionDays: product.productionDays,
            appliedOffer,
            availableOffers,
            selectedOptionsSummary,
            specificationsSnapshot,
        };
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        shipping_gst_service_1.ShippingGstService])
], PricingService);
//# sourceMappingURL=pricing.service.js.map