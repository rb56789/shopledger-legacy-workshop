'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

function savedOrder(items, coupon) {
  const totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 42,
    date: '21/11/2026',
    customer: 'In-memory customer',
    paymentMode: 'cash',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice matches billed HSN tax for a saved line without gstRate', function () {
  const order = savedOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, 5);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, order.total);
});

test('invoice matches billed discount, GST breakdown, and total for a capped mixed-rate coupon', function () {
  const order = savedOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, name: 'Tea', sku: 'TEA-1', hsn: '0902', price: 1000, qty: 1 }
  ], 'SAVE10');
  const figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.subtotal, 2000);
  assert.equal(order.discount, 150);
  assert.equal(order.tax, 212.75);
  assert.equal(order.total, 2062.75);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.rows[1].gstPercent, 18);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 106.38);
  assert.equal(figures.sgst, 106.37);
  assert.equal(figures.total, order.total);
});

test('rendered invoice shows the billed total without a reconciliation notice when figures match', function () {
  const order = savedOrder([
    { id: 1, name: 'Rice', sku: 'RICE-1', hsn: '1006', price: 100, qty: 1 }
  ]);
  const html = invoice.render(order);

  assert.match(html, /Invoice Total<\/td><td class="r">₹105\.00/);
  assert.doesNotMatch(html, /Accountant Reconciliation Notice/);
});
