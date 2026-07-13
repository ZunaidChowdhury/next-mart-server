import { Request, Response } from 'express';
import { Product } from '../models/product.model.js';

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 9;
    const skip = (page - 1) * limit;

    const { search, category, minPrice, maxPrice, rating, sortBy } = req.query;

    const filterQuery: any = { isPrivate: false };

    if (search) {
      filterQuery.$text = { $search: search as string };
    }

    if (category) {
      filterQuery.categories = category as string;
    }

    if (minPrice || maxPrice) {
      filterQuery.salePrice = {};
      if (minPrice) {
        filterQuery.salePrice.$gte = parseFloat(minPrice as string);
      }
      if (maxPrice) {
        filterQuery.salePrice.$lte = parseFloat(maxPrice as string);
      }
    }

    if (rating) {
      filterQuery.rating = { $gte: parseFloat(rating as string) };
    }

    let sortQuery: any = { createdAt: -1 };
    if (sortBy === 'price-asc') {
      sortQuery = { salePrice: 1 };
    } else if (sortBy === 'price-desc') {
      sortQuery = { salePrice: -1 };
    } else if (sortBy === 'date-asc') {
      sortQuery = { createdAt: 1 };
    } else if (sortBy === 'date-desc') {
      sortQuery = { createdAt: -1 };
    }

    const totalProducts = await Product.countDocuments(filterQuery);
    const products = await Product.find(filterQuery)
      .sort(sortQuery)
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalProducts / limit);

    res.status(200).json({
      products,
      page,
      totalPages,
      totalProducts
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message
    });
  }
}

export async function getProductById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, isPrivate: false });

    if (!product) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json({ product });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const {
      title,
      overview,
      description,
      images,
      originalPrice,
      salePrice,
      brandName,
      categories,
      variation,
      model,
      coreFeatures,
      specification,
      stockCount,
      isPrivate
    } = req.body;

    // Validate required fields
    if (
      !title ||
      !overview ||
      !description ||
      !images ||
      originalPrice === undefined ||
      salePrice === undefined ||
      !brandName ||
      !categories ||
      stockCount === undefined
    ) {
      res.status(400).json({ message: 'Missing required product fields' });
      return;
    }

    const availableStatus = stockCount > 0 ? 'in-stock' : 'out-of-stock';

    const newProduct = new Product({
      title,
      overview,
      description,
      images,
      originalPrice,
      salePrice,
      brandName,
      categories,
      variation: variation || [],
      model,
      coreFeatures: coreFeatures || [],
      specification: specification || [],
      stockCount,
      isPrivate: isPrivate ?? false,
      availableStatus
    });

    await newProduct.save();

    res.status(201).json({
      message: 'Product created successfully',
      product: newProduct
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to create product',
      error: error.message
    });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Synchronize availableStatus if stockCount is modified
    if (updateData.stockCount !== undefined) {
      updateData.availableStatus = updateData.stockCount > 0 ? 'in-stock' : 'out-of-stock';
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json({
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update product',
      error: error.message
    });
  }
}

export async function updateProductStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { isPrivate } = req.body;

    let updatedProduct;
    if (isPrivate !== undefined) {
      updatedProduct = await Product.findByIdAndUpdate(
        id,
        { $set: { isPrivate } },
        { new: true }
      );
    } else {
      // Toggle visibility if body is empty or not specified
      const product = await Product.findById(id);
      if (!product) {
        res.status(404).json({ message: 'Product not found' });
        return;
      }
      product.isPrivate = !product.isPrivate;
      updatedProduct = await product.save();
    }

    res.status(200).json({
      message: 'Product status updated successfully',
      product: updatedProduct
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to update product status',
      error: error.message
    });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const deletedProduct = await Product.findByIdAndDelete(id);

    if (!deletedProduct) {
      res.status(404).json({ message: 'Product not found' });
      return;
    }

    res.status(200).json({
      message: 'Product deleted successfully',
      product: deletedProduct
    });
  } catch (error: any) {
    res.status(500).json({
      message: 'Failed to delete product',
      error: error.message
    });
  }
}
