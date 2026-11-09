const { calculateShipping, DELIVERY_METHODS } = require('../src/utils/shipping');

describe('Shipping module', () => {
  it('charges the home delivery base fee', () => {
    expect(calculateShipping({ subtotal: 1000 })).toMatchObject({ baseFee: 120, shippingFee: 120 });
  });

  it('charges the convenience-store pickup fee', () => {
    expect(calculateShipping({ subtotal: 1000, deliveryMethod: DELIVERY_METHODS.CONVENIENCE_STORE }))
      .toMatchObject({ baseFee: 60, shippingFee: 60 });
  });

  it('charges home delivery for a subtotal of 1,499', () => {
    expect(calculateShipping({ subtotal: 1499 }).shippingFee).toBe(120);
  });

  it('waives home base shipping for a subtotal of 1,500', () => {
    expect(calculateShipping({ subtotal: 1500 }).shippingFee).toBe(0);
  });

  it('adds the remote area surcharge', () => {
    expect(calculateShipping({ subtotal: 1000, isRemoteArea: true }).shippingFee).toBe(320);
  });

  it('adds the same-day surcharge', () => {
    expect(calculateShipping({ subtotal: 1000, isSameDay: true }).shippingFee).toBe(370);
  });

  it('adds multiple surcharges together', () => {
    expect(calculateShipping({ subtotal: 1000, isRemoteArea: true, isSameDay: true }).shippingFee).toBe(570);
  });

  it('keeps surcharges when the home base fee is waived', () => {
    expect(calculateShipping({ subtotal: 1500, isRemoteArea: true, isSameDay: true }).shippingFee).toBe(450);
  });
});
