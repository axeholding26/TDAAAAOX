/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  stock: number;
  safetyStock: number;
  status: 'Optimal' | 'Low Stock' | 'Out of Stock';
  price: number;
  cost: number;
  supplier: string;
  salesVelocity: number; // units sold per day
  reorderPoint: number;
  leadTime: number; // in days
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }>;
  status: 'Delivered' | 'Shipped' | 'Processing' | 'Returned';
  total: number;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    refundAmount: number;
  }>;
  reason: string;
  aiEligibilityScore: number; // 0-100
  aiExplanation: string;
  labelUrl?: string; // pre-paid return label url
  refundProcessed: boolean;
  restocked: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  loyaltyTier: 'Regular' | 'Gold VIP' | 'Platinum VIP';
  totalSpent: number;
  ordersCount: number;
  customerLifetimeValue: number;
  sentiment: 'Delighted' | 'Neutral' | 'Frustrated';
  avatarUrl?: string;
}

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
  isAudio?: boolean;
  audioDuration?: string;
  toolExecuted?: {
    name: string;
    description: string;
    status: 'success' | 'executing' | 'error';
    data?: string;
  };
}

export interface ECommerceState {
  products: Product[];
  orders: Order[];
  returnRequests: ReturnRequest[];
  customers: Customer[];
  messages: Message[];
}
