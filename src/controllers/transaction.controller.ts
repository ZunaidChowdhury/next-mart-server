import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Product } from '../models/product.model.js';
import { Transaction } from '../models/transaction.model.js';

// Lazy Stripe instance
function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
  });
}

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ message: 'Cart items are required to checkout' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Session not verified' });
      return;
    }

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Server-side validation of pricing and stock availability
    for (const item of items) {
      const { product: productId, quantity, variation } = item;

      if (!productId || !quantity || quantity <= 0) {
        res.status(400).json({ message: 'Invalid product or quantity specified' });
        return;
      }

      const product = await Product.findById(productId);

      if (!product) {
        res.status(404).json({ message: `Product not found: ${productId}` });
        return;
      }

      if (product.isPrivate) {
        res.status(400).json({ message: `Product is not available for purchase: ${product.title}` });
        return;
      }

      if (product.availableStatus === 'out-of-stock' || product.stockCount < quantity) {
        res.status(400).json({ 
          message: `Insufficient stock for ${product.title}. Available: ${product.stockCount}` 
        });
        return;
      }

      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: product.title,
            images: product.images && product.images.length > 0 ? [product.images[0]] : [],
            description: `Brand: ${product.brandName}${variation ? ` | Variation: ${variation}` : ''}`,
          },
          unit_amount: Math.round(product.salePrice * 100),
        },
        quantity,
      });
    }

    // Configure Stripe Checkout options
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${env.FRONTEND_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.FRONTEND_URL}/cart`,
      customer_email: req.user.email,
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'NZ', 'BD'],
      },
      metadata: {
        userId: req.user.id,
        items: JSON.stringify(
          items.map((item) => ({
            product: item.product,
            quantity: item.quantity,
            variation: item.variation || '',
          }))
        ),
      },
    });

    res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({ message: 'Failed to create checkout session', error: error.message });
  }
}

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    res.status(400).json({ message: 'Webhook signature or secret missing' });
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      req.rawBody!,
      sig,
      webhookSecret
    );
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;

    try {
      await processCompletedSession(session);
    } catch (error: any) {
      console.error('Error processing completed checkout session:', error);
      res.status(500).json({ message: 'Failed to process webhook transaction', error: error.message });
      return;
    }
  }

  res.status(200).json({ received: true });
}

export async function processCompletedSession(session: any): Promise<void> {
  const transactionId = session.payment_intent as string || session.id;
  const userId = session.metadata?.userId;
  const itemsString = session.metadata?.items;

  if (!userId || !itemsString) {
    throw new Error('Missing metadata (userId or items) in checkout session');
  }

  // Idempotency Check: prevent duplicate webhook ingestion
  const existingTx = await Transaction.findOne({ transactionId });
  if (existingTx) {
    console.log(`⚠️ Transaction ${transactionId} already processed. Skipping webhook fulfillment.`);
    return;
  }

  const items = JSON.parse(itemsString);
  const transactionItems = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) {
      throw new Error(`Product not found during fulfillment: ${item.product}`);
    }

    transactionItems.push({
      product: product._id,
      title: product.title,
      quantity: item.quantity,
      price: product.salePrice, // Lock historical price at payment completion
      variation: item.variation || ''
    });

    // Decrement stock levels and increment sold stats
    product.stockCount = Math.max(0, product.stockCount - item.quantity);
    if (product.stockCount === 0) {
      product.availableStatus = 'out-of-stock';
    }
    product.soldQuantity += item.quantity;
    
    await product.save();
  }

  // Extract shipping coordinates
  const shippingDetails = session.shipping_details;
  const shippingAddress = {
    line1: shippingDetails?.address?.line1 || 'No shipping address provided',
    city: shippingDetails?.address?.city || 'Unknown',
    state: shippingDetails?.address?.state || '',
    postalCode: shippingDetails?.address?.postal_code || '0000',
    country: shippingDetails?.address?.country || 'Unknown'
  };

  const totalAmount = (session.amount_total || 0) / 100;
  const currency = session.currency || 'usd';

  // Instantiate Transaction Record
  const transaction = new Transaction({
    transactionId,
    user: userId,
    items: transactionItems,
    totalAmount,
    currency,
    paymentStatus: 'completed',
    orderStatus: 'pending',
    shippingAddress
  });

  await transaction.save();
  console.log(`✅ Transaction successfully processed and logged: ${transactionId}`);
}

export async function getCheckoutSessionDetails(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      res.status(400).json({ message: 'Session ID is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Session not verified' });
      return;
    }

    // Retrieve checkout session from Stripe
    const session = (await getStripe().checkout.sessions.retrieve(sessionId)) as any;

    if (!session) {
      res.status(404).json({ message: 'Checkout session not found' });
      return;
    }

    // Verify ownership of the checkout session
    if (session.metadata?.userId !== req.user.id) {
      res.status(403).json({ message: 'Forbidden: You do not have permission to view this checkout session' });
      return;
    }

    // Retrieve line items for the checkout session
    const lineItems = await getStripe().checkout.sessions.listLineItems(sessionId, { limit: 100 });

    // Look up transaction record in DB to see webhook completion state
    const transaction = await Transaction.findOne({
      transactionId: (session.payment_intent as string) || session.id,
    });

    // Formulate delivery estimation (3 to 5 business days from session creation)
    const creationDate = session.created ? new Date(session.created * 1000) : new Date();
    
    // Add business days helper
    const addBusinessDays = (startDate: Date, days: number): Date => {
      const result = new Date(startDate);
      let count = 0;
      while (count < days) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
          count++;
        }
      }
      return result;
    };

    const deliveryStart = addBusinessDays(creationDate, 3);
    const deliveryEnd = addBusinessDays(creationDate, 5);

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const deliveryEstimation = `${formatDate(deliveryStart)} - ${formatDate(deliveryEnd)}`;

    // Build the items list: pull normalized metadata from DB if found, otherwise parse Stripe
    const items = transaction
      ? transaction.items.map((item) => ({
          id: item.product.toString(),
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          variation: item.variation || '',
        }))
      : lineItems.data.map((item) => {
          let variation = '';
          const desc = item.description || '';
          if (desc.includes('| Variation:')) {
            variation = desc.split('| Variation:')[1].trim();
          }
          return {
            id: item.id,
            title: desc.split('|')[0].replace('Brand:', '').trim(),
            quantity: item.quantity || 1,
            price: item.amount_total ? (item.amount_total / (item.quantity || 1)) / 100 : 0,
            variation,
          };
        });

    const details = {
      sessionId: session.id,
      paymentIntentId: (session.payment_intent as string) || null,
      paymentStatus: transaction ? transaction.paymentStatus : session.payment_status,
      totalAmount: session.amount_total ? session.amount_total / 100 : 0,
      currency: session.currency || 'usd',
      customer: {
        email: session.customer_details?.email || req.user.email,
        name: session.customer_details?.name || req.user.name || 'Valued Customer',
      },
      shippingAddress: session.shipping_details?.address || transaction?.shippingAddress || null,
      deliveryEstimation,
      items,
    };

    res.status(200).json(details);
  } catch (error: any) {
    console.error('Error retrieving checkout session details:', error);
    res.status(500).json({ message: 'Failed to retrieve checkout session details', error: error.message });
  }
}

export async function getUserTransactionHistory(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized: Session not verified' });
      return;
    }

    const transactions = await Transaction.find({ user: req.user.id })
      .sort({ createdAt: -1 }); // Newest orders appear first

    res.status(200).json({ transactions });
  } catch (error: any) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({
      message: 'Failed to retrieve transaction history',
      error: error.message,
    });
  }
}
