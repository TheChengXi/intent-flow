// 大型 TypeScript 测试用例：电商订单管理系统（约300行）

import { EventEmitter } from 'events';

// ==================== 类型定义 ====================

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  subtotal: number;
}

export interface PaymentInfo {
  method: string;
  transactionId?: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt?: Date;
}

export interface ShippingInfo {
  carrier: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  actualDelivery?: Date;
  shippingCost: number;
}

export interface Order {
  orderId: string;
  customerId: string;
  customerEmail: string;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress: Address;
  payment: PaymentInfo;
  shipping: ShippingInfo;
  status: OrderStatus;
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
}

// ==================== 订单管理器类 ====================

export class OrderManager extends EventEmitter {
  private orders: Map<string, Order>;
  private inventory: Map<string, number>;
  private taxRate: number;

  constructor(taxRate: number = 0.08) {
    super();
    this.orders = new Map();
    this.inventory = new Map();
    this.taxRate = taxRate;
  }

  // 创建新订单
  public async createOrder(
    customerId: string,
    customerEmail: string,
    items: OrderItem[],
    shippingAddress: Address,
    billingAddress: Address,
    paymentMethod: string
  ): Promise<Order> {
    // 验证输入
    const validation = this.validateOrderInput(
      customerId,
      customerEmail,
      items,
      shippingAddress,
      billingAddress
    );

    if (!validation.isValid) {
      throw new Error(`Order validation failed: ${validation.errors.join(', ')}`);
    }

    // 检查库存
    for (const item of items) {
      const available = this.inventory.get(item.productId) || 0;
      if (available < item.quantity) {
        throw new Error(
          `Insufficient inventory for product ${item.productName}. Available: ${available}, Requested: ${item.quantity}`
        );
      }
    }

    // 计算金额
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * this.taxRate;
    const shippingCost = this.calculateShippingCost(shippingAddress, subtotal);
    const total = subtotal + tax + shippingCost;

    // 创建订单对象
    const order: Order = {
      orderId: this.generateOrderId(),
      customerId,
      customerEmail,
      items,
      shippingAddress,
      billingAddress,
      payment: {
        method: paymentMethod,
        status: PaymentStatus.PENDING,
        amount: total,
        currency: 'USD'
      },
      shipping: {
        carrier: this.selectCarrier(shippingAddress),
        shippingCost,
        estimatedDelivery: this.calculateEstimatedDelivery()
      },
      status: OrderStatus.PENDING,
      subtotal,
      tax,
      total,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // 扣减库存
    for (const item of items) {
      const current = this.inventory.get(item.productId) || 0;
      this.inventory.set(item.productId, current - item.quantity);
    }

    // 保存订单
    this.orders.set(order.orderId, order);

    // 触发事件
    this.emit('orderCreated', order);

    return order;
  }

  // 处理支付
  public async processPayment(orderId: string, transactionId: string): Promise<Order> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new Error(`Cannot process payment for order in status: ${order.status}`);
    }

    if (order.payment.status !== PaymentStatus.PENDING) {
      throw new Error(`Payment already processed: ${order.payment.status}`);
    }

    // 模拟支付处理
    const paymentSuccess = await this.authorizePayment(order.payment.amount, transactionId);

    if (!paymentSuccess) {
      order.payment.status = PaymentStatus.FAILED;
      order.status = OrderStatus.CANCELLED;
      order.updatedAt = new Date();

      // 恢复库存
      this.restoreInventory(order.items);

      this.emit('paymentFailed', order);
      throw new Error('Payment authorization failed');
    }

    // 更新订单状态
    order.payment.status = PaymentStatus.CAPTURED;
    order.payment.transactionId = transactionId;
    order.payment.paidAt = new Date();
    order.status = OrderStatus.CONFIRMED;
    order.updatedAt = new Date();

    this.emit('paymentProcessed', order);

    return order;
  }

  // 发货
  public async shipOrder(orderId: string, trackingNumber: string): Promise<Order> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== OrderStatus.CONFIRMED && order.status !== OrderStatus.PROCESSING) {
      throw new Error(`Cannot ship order in status: ${order.status}`);
    }

    order.status = OrderStatus.SHIPPED;
    order.shipping.trackingNumber = trackingNumber;
    order.updatedAt = new Date();

    this.emit('orderShipped', order);

    return order;
  }

  // 取消订单
  public async cancelOrder(orderId: string, reason: string): Promise<Order> {
    const order = this.orders.get(orderId);

    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status === OrderStatus.SHIPPED || order.status === OrderStatus.DELIVERED) {
      throw new Error(`Cannot cancel order in status: ${order.status}`);
    }

    // 如果已支付，需要退款
    if (order.payment.status === PaymentStatus.CAPTURED) {
      await this.refundPayment(order.payment.transactionId!, order.payment.amount);
      order.payment.status = PaymentStatus.REFUNDED;
    }

    // 恢复库存
    this.restoreInventory(order.items);

    order.status = OrderStatus.CANCELLED;
    order.notes = reason;
    order.updatedAt = new Date();

    this.emit('orderCancelled', order);

    return order;
  }

  // ==================== 私有辅助方法 ====================

  private validateOrderInput(
    customerId: string,
    customerEmail: string,
    items: OrderItem[],
    shippingAddress: Address,
    billingAddress: Address
  ): OrderValidationResult {
    const errors: string[] = [];

    if (!customerId || customerId.trim() === '') {
      errors.push('Customer ID is required');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerEmail || !emailRegex.test(customerEmail)) {
      errors.push('Valid customer email is required');
    }

    if (!items || items.length === 0) {
      errors.push('Order must contain at least one item');
    }

    for (const item of items) {
      if (item.quantity <= 0) {
        errors.push(`Invalid quantity for product ${item.productName}`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Invalid price for product ${item.productName}`);
      }
    }

    if (!this.validateAddress(shippingAddress)) {
      errors.push('Invalid shipping address');
    }

    if (!this.validateAddress(billingAddress)) {
      errors.push('Invalid billing address');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validateAddress(address: Address): boolean {
    return !!(
      address &&
      address.street &&
      address.city &&
      address.state &&
      address.zipCode &&
      address.country
    );
  }

  private calculateShippingCost(address: Address, subtotal: number): number {
    let baseCost = 10.0;

    if (subtotal > 100) {
      baseCost = 0;
    } else if (address.country !== 'USA') {
      baseCost = 25.0;
    }

    return baseCost;
  }

  private selectCarrier(address: Address): string {
    if (address.country === 'USA') {
      return 'USPS';
    } else {
      return 'DHL';
    }
  }

  private calculateEstimatedDelivery(): Date {
    const now = new Date();
    now.setDate(now.getDate() + 5);
    return now;
  }

  private generateOrderId(): string {
    return `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  private async authorizePayment(amount: number, transactionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.1);
      }, 100);
    });
  }

  private async refundPayment(transactionId: string, amount: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });
  }

  private restoreInventory(items: OrderItem[]): void {
    for (const item of items) {
      const current = this.inventory.get(item.productId) || 0;
      this.inventory.set(item.productId, current + item.quantity);
    }
  }

  public getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  public getOrdersByCustomer(customerId: string): Order[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.customerId === customerId
    );
  }

  public getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(this.orders.values()).filter(
      (order) => order.status === status
    );
  }

  public setInventory(productId: string, quantity: number): void {
    this.inventory.set(productId, quantity);
  }

  public getInventory(productId: string): number {
    return this.inventory.get(productId) || 0;
  }
}
