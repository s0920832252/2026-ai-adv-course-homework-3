const DELIVERY_METHODS = Object.freeze({
  HOME: 'home',
  CONVENIENCE_STORE: 'convenience_store'
});

const SHIPPING_RATES = Object.freeze({
  home: 120,
  convenience_store: 60,
  remoteAreaSurcharge: 200,
  sameDaySurcharge: 250,
  freeShippingThreshold: 1500
});

/**
 * Calculate delivery charges. The free shipping threshold waives home delivery's
 * base fee only; convenience-store pickup has its own fixed fee.
 */
function calculateShipping({
  subtotal,
  deliveryMethod = DELIVERY_METHODS.HOME,
  isRemoteArea = false,
  isSameDay = false
}) {
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError('subtotal must be a non-negative number');
  }
  if (!Object.values(DELIVERY_METHODS).includes(deliveryMethod)) {
    throw new TypeError('deliveryMethod must be home or convenience_store');
  }
  if (typeof isRemoteArea !== 'boolean' || typeof isSameDay !== 'boolean') {
    throw new TypeError('shipping options must be boolean');
  }

  const baseFee = deliveryMethod === DELIVERY_METHODS.HOME
    ? (subtotal >= SHIPPING_RATES.freeShippingThreshold ? 0 : SHIPPING_RATES.home)
    : SHIPPING_RATES.convenience_store;
  const remoteAreaFee = isRemoteArea ? SHIPPING_RATES.remoteAreaSurcharge : 0;
  const sameDayFee = isSameDay ? SHIPPING_RATES.sameDaySurcharge : 0;

  return {
    deliveryMethod,
    baseFee,
    remoteAreaFee,
    sameDayFee,
    shippingFee: baseFee + remoteAreaFee + sameDayFee
  };
}

module.exports = { DELIVERY_METHODS, SHIPPING_RATES, calculateShipping };
