const { test } = require('node:test');
const { strict: assert } = require('node:assert');
const invoice = require('../lib/invoice');
const pricing = require('../lib/pricing');

// An unset gstRate models a saved line that carries only its HSN for tax lookup.
function compareOrder(order, expectedCheckout, expectedInvoice, expectedRows) {
  const checkout = pricing.computeTotals(order.items, order.coupon);
  const printed = invoice.computeInvoiceFigures(order);

  assert.deepEqual({
    discount: checkout.discount,
    tax: checkout.tax,
    total: checkout.total
  }, expectedCheckout, 'checkout figures');

  assert.deepEqual({
    subtotal: printed.subtotal,
    discount: printed.discount,
    tax: printed.tax,
    cgst: printed.cgst,
    sgst: printed.sgst,
    total: printed.total
  }, expectedInvoice, 'invoice figures');

  const rows = printed.rows.map(({ hsn, gstPercent, lineTax }) => ({ hsn, gstPercent, lineTax }));
  assert.deepEqual(rows, expectedRows, 'GST breakdown on the invoice');
}

test('CURRENT BEHAVIOUR: order 1001 prints 18% on both 5% and 12% HSN items', () => {
  const order = {
    id: 1001,
    coupon: '',
    items: [
      { name: 'Rice', price: 100, qty: 2, hsn: '1006', gstRate: undefined },
      { name: 'Ghee', price: 150, qty: 1, hsn: '0405', gstRate: undefined }
    ]
  };

  compareOrder(order,
    { discount: 0, tax: 28, total: 378 },
    { subtotal: 350, discount: 0, tax: 63, cgst: 31.50, sgst: 31.50, total: 413 },
    [
      { hsn: '1006', gstPercent: 18, lineTax: 36 },
      { hsn: '0405', gstPercent: 18, lineTax: 27 }
    ]
  );
});

test('CURRENT BEHAVIOUR: order 1002 calculates SAVE10 on the GST-inclusive invoice amount', () => {
  const order = {
    id: 1002,
    coupon: 'SAVE10',
    items: [
      { name: 'Rice', price: 640, qty: 1, hsn: '1006', gstRate: undefined },
      { name: 'Sunflower oil', price: 190, qty: 2, hsn: '1512', gstRate: undefined }
    ]
  };

  compareOrder(order,
    { discount: 102, tax: 45.90, total: 963.90 },
    { subtotal: 1020, discount: 120.36, tax: 183.60, cgst: 91.80, sgst: 91.80, total: 1083.24 },
    [
      { hsn: '1006', gstPercent: 18, lineTax: 115.20 },
      { hsn: '1512', gstPercent: 18, lineTax: 68.40 }
    ]
  );
});

test('CURRENT BEHAVIOUR: order 1004 prints a SAVE10 discount above the INR 150 checkout cap', () => {
  const order = {
    id: 1004,
    coupon: 'SAVE10',
    items: [
      { name: 'Groundnut oil', price: 1120, qty: 2, hsn: '1508', gstRate: undefined }
    ]
  };

  compareOrder(order,
    { discount: 150, tax: 104.50, total: 2194.50 },
    { subtotal: 2240, discount: 264.32, tax: 403.20, cgst: 201.60, sgst: 201.60, total: 2378.88 },
    [{ hsn: '1508', gstPercent: 18, lineTax: 403.20 }]
  );
});

test('CURRENT BEHAVIOUR: order 1008 matches checkout for 18% items without a coupon', () => {
  const order = {
    id: 1008,
    coupon: '',
    items: [
      { name: 'Tea', price: 140, qty: 1, hsn: '0902', gstRate: 18 },
      { name: 'Syrup', price: 180, qty: 2, hsn: '2106', gstRate: undefined }
    ]
  };

  compareOrder(order,
    { discount: 0, tax: 90, total: 590 },
    { subtotal: 500, discount: 0, tax: 90, cgst: 45, sgst: 45, total: 590 },
    [
      { hsn: '0902', gstPercent: 18, lineTax: 25.20 },
      { hsn: '2106', gstPercent: 18, lineTax: 64.80 }
    ]
  );
});
