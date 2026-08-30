import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  approvePriceReviewSchema,
  commerceSummarySchema,
  createCustomerSchema,
  createFxSnapshotSchema,
  createProductSchema,
  createSupplierCostReviewSchema,
  createSupplierSchema,
  customerSchema,
  duplicateCustomerReviewSchema,
  fxSnapshotSchema,
  priceReviewSchema,
  productSchema,
  supplierSchema,
  updateCustomerSchema,
  updateProductSchema,
  updateSupplierSchema,
  type FxSnapshot,
  type Money,
  type Product,
} from '@masaar/contracts';
import { requirePermission } from './auth.js';
import { normalizeLebanesePhone, type CommerceRepository } from './commerce-repository.js';
import { recordAudit, type AuditRepository } from './audit.js';

function toUsdMinor(value: Money, fx: FxSnapshot) {
  return value.currency === 'USD'
    ? value.amountMinor
    : Math.round((value.amountMinor / fx.lbpPerUsd) * 100);
}

function marginBps(price: Money, cost: Money, fx: FxSnapshot) {
  const priceUsd = toUsdMinor(price, fx);
  if (priceUsd <= 0) return -10000;
  return Math.round(((priceUsd - toUsdMinor(cost, fx)) / priceUsd) * 10000);
}

function recommendedPrice(
  cost: Money,
  currentPrice: Money,
  targetMarginBps: number,
  fx: FxSnapshot,
) {
  const costUsdMinor = toUsdMinor(cost, fx);
  const requiredUsdMinor = Math.ceil(costUsdMinor / (1 - targetMarginBps / 10000));
  if (currentPrice.currency === 'USD')
    return { amountMinor: requiredUsdMinor, currency: 'USD' as const };
  const rawLbp = Math.ceil((requiredUsdMinor / 100) * fx.lbpPerUsd);
  const step = rawLbp >= 500000 ? 50000 : 10000;
  return { amountMinor: Math.ceil(rawLbp / step) * step, currency: 'LBP' as const };
}

function withUpdatedVariant(
  products: Product[],
  variantId: string,
  update: (variant: Product['variants'][number]) => void,
) {
  const product = products.find((item) =>
    item.variants.some((variant) => variant.id === variantId),
  );
  if (!product) return null;
  const variant = product.variants.find((item) => item.id === variantId)!;
  update(variant);
  product.updatedAt = new Date().toISOString();
  return product;
}

export async function registerCommerceRoutes(
  app: FastifyInstance,
  repositories: { commerce: CommerceRepository; audit: AuditRepository },
) {
  const { commerce, audit } = repositories;

  app.get(
    '/api/commerce/summary',
    { preHandler: requirePermission('catalog:read') },
    async (request) => {
      const tenantId = request.session!.tenantId;
      const [products, suppliers, customers, fxSnapshots] = await Promise.all([
        commerce.listProducts(tenantId),
        commerce.listSuppliers(tenantId),
        commerce.listCustomers(tenantId),
        commerce.listFxSnapshots(tenantId),
      ]);
      const latestFx = fxSnapshots[0] ?? null;
      const variants = products.flatMap((product) => product.variants);
      return commerceSummarySchema.parse({
        activeProducts: products.filter((product) => product.active).length,
        activeVariants: variants.filter((variant) => variant.available).length,
        activeSuppliers: suppliers.filter((supplier) => supplier.active).length,
        customers: customers.length,
        lowStockVariants: variants.filter(
          (variant) => variant.stockOnHand !== undefined && variant.stockOnHand <= 3,
        ).length,
        marginRiskVariants: latestFx
          ? variants.filter(
              (variant) =>
                marginBps(variant.currentSellingPrice, variant.currentUnitCost, latestFx) < 2500,
            ).length
          : 0,
        latestFx,
      });
    },
  );

  app.get(
    '/api/commerce/products',
    { preHandler: requirePermission('catalog:read') },
    async (request) => commerce.listProducts(request.session!.tenantId),
  );
  app.post(
    '/api/commerce/products',
    { preHandler: requirePermission('catalog:write') },
    async (request, reply) => {
      const input = createProductSchema.parse(request.body);
      const now = new Date().toISOString();
      const products = await commerce.listProducts(request.session!.tenantId);
      const existingSkus = new Set(
        products.flatMap((product) => product.variants.map((variant) => variant.sku)),
      );
      if (input.variants.some((variant) => existingSkus.has(variant.sku)))
        return reply.conflict('SKU already exists in this business.');
      const product = productSchema.parse({
        ...input,
        id: `prd_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        variants: input.variants.map((variant) => ({
          ...variant,
          id: `var_${randomUUID()}`,
          priceHistory: [
            {
              id: `price_${randomUUID()}`,
              value: variant.currentSellingPrice,
              effectiveAt: now,
              reason: 'Initial selling price',
              recordedBy: request.session!.userId,
            },
          ],
          costHistory: [
            {
              id: `cost_${randomUUID()}`,
              value: variant.currentUnitCost,
              effectiveAt: now,
              reason: 'Initial unit cost',
              recordedBy: request.session!.userId,
            },
          ],
        })),
        createdAt: now,
        updatedAt: now,
      });
      await commerce.saveProduct(product);
      await recordAudit(audit, {
        session: request.session!,
        action: 'catalog.product_created',
        entityType: 'product',
        entityId: product.id,
        correlationId: request.correlationId,
        after: product,
      });
      return reply.code(201).send(product);
    },
  );
  app.put(
    '/api/commerce/products/:id',
    { preHandler: requirePermission('catalog:write') },
    async (request, reply) => {
      const tenantId = request.session!.tenantId;
      const id = (request.params as { id: string }).id;
      const input = updateProductSchema.parse(request.body);
      const [existing, products] = await Promise.all([
        commerce.getProduct(tenantId, id),
        commerce.listProducts(tenantId),
      ]);
      if (!existing) return reply.notFound('Product not found.');
      const existingById = new Map(existing.variants.map((variant) => [variant.id, variant]));
      const suppliedExistingIds = new Set(
        input.variants.flatMap((variant) => (variant.id ? [variant.id] : [])),
      );
      if (existing.variants.some((variant) => !suppliedExistingIds.has(variant.id)))
        return reply.conflict(
          'Existing variants cannot be deleted because orders and inventory may reference them. Mark a variant unavailable instead.',
        );
      if (input.variants.some((variant) => variant.id && !existingById.has(variant.id)))
        return reply.badRequest('One or more variant identifiers do not belong to this product.');
      const usedSkus = new Set(
        products
          .filter((product) => product.id !== id)
          .flatMap((product) => product.variants.map((variant) => variant.sku)),
      );
      const submittedSkus = input.variants.map((variant) => variant.sku);
      if (
        new Set(submittedSkus).size !== submittedSkus.length ||
        submittedSkus.some((sku) => usedSkus.has(sku))
      )
        return reply.conflict('Every SKU must be unique inside this business.');
      const timestamp = new Date().toISOString();
      const variants = input.variants.map((variant) => {
        const current = variant.id ? existingById.get(variant.id) : undefined;
        if (!current) {
          return {
            ...variant,
            id: `var_${randomUUID()}`,
            priceHistory: [
              {
                id: `price_${randomUUID()}`,
                value: variant.currentSellingPrice,
                effectiveAt: timestamp,
                reason: 'Variant added through catalog editor',
                recordedBy: request.session!.userId,
              },
            ],
            costHistory: [
              {
                id: `cost_${randomUUID()}`,
                value: variant.currentUnitCost,
                effectiveAt: timestamp,
                reason: 'Variant added through catalog editor',
                recordedBy: request.session!.userId,
              },
            ],
          };
        }
        const priceChanged =
          current.currentSellingPrice.amountMinor !== variant.currentSellingPrice.amountMinor ||
          current.currentSellingPrice.currency !== variant.currentSellingPrice.currency;
        const costChanged =
          current.currentUnitCost.amountMinor !== variant.currentUnitCost.amountMinor ||
          current.currentUnitCost.currency !== variant.currentUnitCost.currency;
        return {
          ...current,
          ...variant,
          stockOnHand: current.stockOnHand,
          priceHistory: priceChanged
            ? [
                ...current.priceHistory,
                {
                  id: `price_${randomUUID()}`,
                  value: variant.currentSellingPrice,
                  effectiveAt: timestamp,
                  reason: 'Selling price edited in catalog',
                  recordedBy: request.session!.userId,
                },
              ]
            : current.priceHistory,
          costHistory: costChanged
            ? [
                ...current.costHistory,
                {
                  id: `cost_${randomUUID()}`,
                  value: variant.currentUnitCost,
                  effectiveAt: timestamp,
                  reason: 'Unit cost edited in catalog',
                  recordedBy: request.session!.userId,
                },
              ]
            : current.costHistory,
        };
      });
      const product = productSchema.parse({
        ...existing,
        ...input,
        variants,
        updatedAt: timestamp,
      });
      await commerce.saveProduct(product);
      await recordAudit(audit, {
        session: request.session!,
        action: 'catalog.product_updated',
        entityType: 'product',
        entityId: product.id,
        correlationId: request.correlationId,
        before: existing,
        after: product,
      });
      return product;
    },
  );

  app.get(
    '/api/commerce/suppliers',
    { preHandler: requirePermission('suppliers:read') },
    async (request) => commerce.listSuppliers(request.session!.tenantId),
  );
  app.post(
    '/api/commerce/suppliers',
    { preHandler: requirePermission('suppliers:write') },
    async (request, reply) => {
      const raw = request.body as Record<string, unknown>;
      let phone: string | undefined;
      try {
        phone =
          typeof raw.phone === 'string' && raw.phone
            ? normalizeLebanesePhone(raw.phone)
            : undefined;
      } catch {
        return reply.badRequest('Enter a valid Lebanese supplier phone number.');
      }
      const input = createSupplierSchema.parse({ ...raw, ...(phone ? { phone } : {}) });
      const now = new Date().toISOString();
      const supplier = supplierSchema.parse({
        ...input,
        id: `sup_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        createdAt: now,
        updatedAt: now,
      });
      await commerce.saveSupplier(supplier);
      await recordAudit(audit, {
        session: request.session!,
        action: 'supplier.created',
        entityType: 'supplier',
        entityId: supplier.id,
        correlationId: request.correlationId,
        after: supplier,
      });
      return reply.code(201).send(supplier);
    },
  );
  app.put(
    '/api/commerce/suppliers/:id',
    { preHandler: requirePermission('suppliers:write') },
    async (request, reply) => {
      const tenantId = request.session!.tenantId;
      const id = (request.params as { id: string }).id;
      const raw = request.body as Record<string, unknown>;
      let phone: string | undefined;
      try {
        phone =
          typeof raw.phone === 'string' && raw.phone
            ? normalizeLebanesePhone(raw.phone)
            : undefined;
      } catch {
        return reply.badRequest('Enter a valid Lebanese supplier phone number.');
      }
      const input = updateSupplierSchema.parse({ ...raw, phone });
      const existing = await commerce.getSupplier(tenantId, id);
      if (!existing) return reply.notFound('Supplier not found.');
      const supplier = supplierSchema.parse({
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      });
      await commerce.saveSupplier(supplier);
      await recordAudit(audit, {
        session: request.session!,
        action: 'supplier.updated',
        entityType: 'supplier',
        entityId: supplier.id,
        correlationId: request.correlationId,
        before: existing,
        after: supplier,
      });
      return supplier;
    },
  );

  app.get(
    '/api/commerce/customers',
    { preHandler: requirePermission('customers:read') },
    async (request) => commerce.listCustomers(request.session!.tenantId),
  );
  app.get(
    '/api/commerce/customers/duplicate-review',
    { preHandler: requirePermission('customers:read') },
    async (request, reply) => {
      const phone = (request.query as { phone?: string }).phone ?? '';
      let normalizedPhone: string;
      try {
        normalizedPhone = normalizeLebanesePhone(phone);
      } catch {
        return reply.badRequest('Enter a valid Lebanese phone number.');
      }
      const customers = await commerce.listCustomers(request.session!.tenantId);
      const lastSix = normalizedPhone.slice(-6);
      const matches = customers.filter(
        (customer) =>
          customer.phoneNormalized === normalizedPhone ||
          customer.phoneNormalized.endsWith(lastSix),
      );
      return duplicateCustomerReviewSchema.parse({
        normalizedPhone,
        matches,
        exactMatch: matches.some((customer) => customer.phoneNormalized === normalizedPhone),
      });
    },
  );
  app.post(
    '/api/commerce/customers',
    { preHandler: requirePermission('customers:write') },
    async (request, reply) => {
      const input = createCustomerSchema.parse(request.body);
      let phoneNormalized: string;
      try {
        phoneNormalized = normalizeLebanesePhone(input.phoneOriginal);
      } catch {
        return reply.badRequest('Enter a valid Lebanese phone number.');
      }
      const customers = await commerce.listCustomers(request.session!.tenantId);
      if (customers.some((customer) => customer.phoneNormalized === phoneNormalized))
        return reply.conflict('A customer with this normalized phone number already exists.');
      const now = new Date().toISOString();
      const customer = customerSchema.parse({
        ...input,
        id: `cus_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        phoneNormalized,
        addresses: input.addresses.map((address) => ({ ...address, id: `addr_${randomUUID()}` })),
        orderStats: {
          completedOrders: 0,
          cancelledOrders: 0,
          failedDeliveries: 0,
          lifetimeSpendUsdMinor: 0,
        },
        createdAt: now,
        updatedAt: now,
      });
      await commerce.saveCustomer(customer);
      await recordAudit(audit, {
        session: request.session!,
        action: 'customer.created',
        entityType: 'customer',
        entityId: customer.id,
        correlationId: request.correlationId,
        after: customer,
      });
      return reply.code(201).send(customer);
    },
  );
  app.put(
    '/api/commerce/customers/:id',
    { preHandler: requirePermission('customers:write') },
    async (request, reply) => {
      const tenantId = request.session!.tenantId;
      const id = (request.params as { id: string }).id;
      const input = updateCustomerSchema.parse(request.body);
      let phoneNormalized: string;
      try {
        phoneNormalized = normalizeLebanesePhone(input.phoneOriginal);
      } catch {
        return reply.badRequest('Enter a valid Lebanese phone number.');
      }
      const [existing, customers] = await Promise.all([
        commerce.getCustomer(tenantId, id),
        commerce.listCustomers(tenantId),
      ]);
      if (!existing) return reply.notFound('Customer not found.');
      if (
        customers.some(
          (customer) => customer.id !== id && customer.phoneNormalized === phoneNormalized,
        )
      )
        return reply.conflict('Another customer already uses this normalized phone number.');
      const customer = customerSchema.parse({
        ...existing,
        ...input,
        phoneNormalized,
        addresses: input.addresses.map((address, index) => ({
          ...address,
          id: existing.addresses[index]?.id ?? `addr_${randomUUID()}`,
        })),
        updatedAt: new Date().toISOString(),
      });
      await commerce.saveCustomer(customer);
      await recordAudit(audit, {
        session: request.session!,
        action: 'customer.updated',
        entityType: 'customer',
        entityId: customer.id,
        correlationId: request.correlationId,
        before: existing,
        after: customer,
      });
      return customer;
    },
  );

  app.get(
    '/api/commerce/fx-snapshots',
    { preHandler: requirePermission('pricing:read') },
    async (request) => commerce.listFxSnapshots(request.session!.tenantId),
  );
  app.post(
    '/api/commerce/fx-snapshots',
    { preHandler: requirePermission('pricing:manage') },
    async (request, reply) => {
      const input = createFxSnapshotSchema.parse(request.body);
      const snapshot = fxSnapshotSchema.parse({
        ...input,
        id: `fx_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        baseCurrency: 'USD',
        quoteCurrency: 'LBP',
        source: 'OWNER_ENTERED',
        recordedBy: request.session!.userId,
        createdAt: new Date().toISOString(),
      });
      await commerce.saveFxSnapshot(snapshot);
      await recordAudit(audit, {
        session: request.session!,
        action: 'currency.fx_snapshot_recorded',
        entityType: 'fxSnapshot',
        entityId: snapshot.id,
        correlationId: request.correlationId,
        after: snapshot,
      });
      return reply.code(201).send(snapshot);
    },
  );

  app.get(
    '/api/commerce/price-reviews',
    { preHandler: requirePermission('pricing:read') },
    async (request) => commerce.listPriceReviews(request.session!.tenantId),
  );
  app.post(
    '/api/commerce/price-reviews',
    { preHandler: requirePermission('pricing:manage') },
    async (request, reply) => {
      const input = createSupplierCostReviewSchema.parse(request.body);
      const [supplier, fx, products] = await Promise.all([
        commerce.getSupplier(request.session!.tenantId, input.supplierId),
        commerce.getFxSnapshot(request.session!.tenantId, input.fxSnapshotId),
        commerce.listProducts(request.session!.tenantId),
      ]);
      if (!supplier) return reply.notFound('Supplier not found.');
      if (!fx) return reply.notFound('FX snapshot not found.');
      const affected = products.flatMap((product) =>
        product.variants
          .filter((variant) => variant.supplierId === supplier.id)
          .map((variant) => ({ product, variant })),
      );
      if (affected.length === 0) return reply.badRequest('This supplier has no catalog variants.');
      const now = new Date().toISOString();
      const review = priceReviewSchema.parse({
        id: `review_${randomUUID()}`,
        tenantId: request.session!.tenantId,
        supplierId: supplier.id,
        supplierName: supplier.name,
        fxSnapshotId: fx.id,
        targetMarginBps: input.targetMarginBps,
        status: 'PENDING',
        items: affected.map(({ product, variant }) => ({
          id: `review_item_${randomUUID()}`,
          productId: product.id,
          productName: product.name,
          variantId: variant.id,
          sku: variant.sku,
          oldUnitCost: variant.currentUnitCost,
          newUnitCost: input.newUnitCost,
          currentSellingPrice: variant.currentSellingPrice,
          recommendedSellingPrice: recommendedPrice(
            input.newUnitCost,
            variant.currentSellingPrice,
            input.targetMarginBps,
            fx,
          ),
          oldMarginBps: marginBps(variant.currentSellingPrice, variant.currentUnitCost, fx),
          newMarginBps: marginBps(variant.currentSellingPrice, input.newUnitCost, fx),
          approved: false,
        })),
        createdAt: now,
        createdBy: request.session!.userId,
      });
      for (const item of review.items) {
        const product = withUpdatedVariant(products, item.variantId, (variant) => {
          variant.currentUnitCost = item.newUnitCost;
          variant.costHistory.push({
            id: `cost_${randomUUID()}`,
            value: item.newUnitCost,
            effectiveAt: input.effectiveAt,
            reason: input.reason,
            recordedBy: request.session!.userId,
            fxSnapshotId: fx.id,
          });
        });
        if (product) await commerce.saveProduct(product);
      }
      supplier.lastPurchaseCost = input.newUnitCost;
      supplier.updatedAt = now;
      await Promise.all([commerce.saveSupplier(supplier), commerce.savePriceReview(review)]);
      await recordAudit(audit, {
        session: request.session!,
        action: 'pricing.supplier_cost_recorded',
        entityType: 'priceReview',
        entityId: review.id,
        correlationId: request.correlationId,
        reason: input.reason,
        after: review,
      });
      return reply.code(201).send(review);
    },
  );

  app.post(
    '/api/commerce/price-reviews/:id/approve',
    { preHandler: requirePermission('pricing:manage') },
    async (request, reply) => {
      const input = approvePriceReviewSchema.parse(request.body);
      const id = (request.params as { id: string }).id;
      const review = await commerce.getPriceReview(request.session!.tenantId, id);
      if (!review) return reply.notFound('Price review not found.');
      const selected = new Set(input.itemIds);
      if (review.items.filter((item) => selected.has(item.id)).some((item) => item.approved))
        return reply.conflict('One or more selected price changes were already approved.');
      const products = await commerce.listProducts(request.session!.tenantId);
      const now = new Date().toISOString();
      for (const item of review.items.filter((candidate) => selected.has(candidate.id))) {
        const product = withUpdatedVariant(products, item.variantId, (variant) => {
          variant.currentSellingPrice = item.recommendedSellingPrice;
          variant.priceHistory.push({
            id: `price_${randomUUID()}`,
            value: item.recommendedSellingPrice,
            effectiveAt: now,
            reason: input.reason,
            recordedBy: request.session!.userId,
            fxSnapshotId: review.fxSnapshotId,
          });
        });
        if (product) await commerce.saveProduct(product);
        item.approved = true;
      }
      const approvedCount = review.items.filter((item) => item.approved).length;
      review.status = approvedCount === review.items.length ? 'APPROVED' : 'PARTIALLY_APPROVED';
      review.approvedAt = now;
      review.approvedBy = request.session!.userId;
      await commerce.savePriceReview(review);
      await recordAudit(audit, {
        session: request.session!,
        action: 'pricing.selling_prices_approved',
        entityType: 'priceReview',
        entityId: review.id,
        correlationId: request.correlationId,
        reason: input.reason,
        after: { itemIds: input.itemIds, status: review.status },
      });
      return review;
    },
  );
}
