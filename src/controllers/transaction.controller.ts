import { Request, Response } from 'express';
import Stripe from 'stripe';
import { env } from '../config/env.js';
import { Product } from '../models/product.model.js';

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
