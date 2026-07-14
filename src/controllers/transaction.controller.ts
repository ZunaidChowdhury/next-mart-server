import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Product } from '../models/product.model.js';
import { Transaction } from '../models/transaction.model.js';

// Initialize Stripe instance
const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16' as any,
});

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
    const session = await stripe.checkout.sessions.create({
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
    event = stripe.webhooks.constructEvent(
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
    shippingAddress
  });

  await transaction.save();
  console.log(`✅ Transaction successfully processed and logged: ${transactionId}`);
}
