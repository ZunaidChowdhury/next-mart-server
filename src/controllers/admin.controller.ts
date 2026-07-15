import { Request, Response } from 'express';
import { Transaction } from '../models/transaction.model.js';
import { Product } from '../models/product.model.js';
import { User } from '../models/user.model.js';

export async function getAdminStats(req: Request, res: Response): Promise<void> {
  try {
    const [
      revenueResult,
      ordersResult,
      productCount,
      userCount,
      monthlyRevenue,
      orderStatusDist
    ] = await Promise.all([
      Transaction.aggregate([
        { $match: { paymentStatus: 'completed' } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]),
      Transaction.aggregate([
        { $group: { _id: null, count: { $sum: 1 } } }
      ]),
      Product.countDocuments(),
      User.countDocuments(),
      Transaction.aggregate([
        { $match: { paymentStatus: 'completed' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            revenue: { $sum: '$totalAmount' },
            orders: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
        { $limit: 12 }
      ]),
      Transaction.aggregate([
        { $group: { _id: '$orderStatus', count: { $sum: 1 } } }
      ])
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    const totalOrders = ordersResult.length > 0 ? ordersResult[0].count : 0;

    res.status(200).json({
      totalRevenue,
      totalOrders,
      totalProducts: productCount,
      totalUsers: userCount,
      monthlyRevenue: monthlyRevenue.map((item) => ({
        year: item._id.year,
        month: item._id.month,
        revenue: item.revenue,
        orders: item.orders
      })),
      orderStatusDistribution: orderStatusDist.map((item) => ({
        status: item._id,
        count: item.count
      }))
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ message: 'Failed to fetch admin stats', error: error.message });
  }
}

export async function getAllOrders(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status as string;
    const search = req.query.search as string;

    const filter: any = {};
    if (statusFilter && ['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(statusFilter)) {
      filter.orderStatus = statusFilter;
    }
    if (search) {
      filter.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { 'shippingAddress.line1': { $regex: search, $options: 'i' } },
        { 'shippingAddress.city': { $regex: search, $options: 'i' } }
      ];
    }

    const [orders, total] = await Promise.all([
      Transaction.find(filter)
        .populate('user', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(filter)
    ]);

    res.status(200).json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
}

export async function updateOrderStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { orderStatus } = req.body;

    if (!['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(orderStatus)) {
      res.status(400).json({ message: 'Invalid order status' });
      return;
    }

    const transaction = await Transaction.findByIdAndUpdate(
      id,
      { orderStatus },
      { new: true }
    ).populate('user', 'name email');

    if (!transaction) {
      res.status(404).json({ message: 'Order not found' });
      return;
    }

    res.status(200).json({ transaction });
  } catch (error: any) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
}
