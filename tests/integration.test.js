const { app, request } = require('./setup');
const db = require('../src/database');
const { v4: uuidv4 } = require('uuid');

describe('購物至訂單整合流程', () => {
  let token;
  let product;
  let userId;

  beforeEach(async () => {
    db.exec('DELETE FROM order_items; DELETE FROM orders; DELETE FROM cart_items; DELETE FROM products; DELETE FROM users;');
    userId = uuidv4();
    const email = `integration-${userId}@example.com`;
    const registered = await request(app).post('/api/auth/register').send({
      email, password: 'password123', name: '整合測試會員'
    });
    expect(registered.status).toBe(201);
    userId = registered.body.data.user.id;
    token = registered.body.data.token;
    product = { id: uuidv4(), name: '測試玫瑰', price: 1200, stock: 7 };
    db.prepare('INSERT INTO products (id,name,price,stock) VALUES (?,?,?,?)')
      .run(product.id, product.name, product.price, product.stock);
  });

  it('登入、取得商品、加入購物車並建立含配送資料的訂單', async () => {
    const listing = await request(app).get('/api/products');
    expect(listing.status).toBe(200);
    expect(listing.body).toMatchObject({ error: null });
    expect(listing.body.data.products.some(p => p.id === product.id)).toBe(true);

    const cartAdd = await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 2 });
    expect(cartAdd.status).toBe(200);
    expect(cartAdd.body).toMatchObject({ error: null, data: { product_id: product.id, quantity: 2 } });

    const created = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      recipientName: '測試收件人', recipientEmail: 'recipient@example.com',
      recipientAddress: '台北市測試路 1 號', deliveryMethod: 'convenience_store',
      isRemoteArea: true, isSameDay: false
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ error: null, message: '訂單建立成功' });
    const order = created.body.data;
    expect(order).toMatchObject({ subtotal_amount: 2400, shipping_fee: 260, total_amount: 2660,
      delivery_method: 'convenience_store', is_remote_area: true, is_same_day: false,
      status: 'pending', items: [{ product_name: product.name, product_price: 1200, quantity: 2 }] });
    expect(db.prepare('SELECT recipient_address FROM orders WHERE id=?').get(order.id).recipient_address)
      .toBe('台北市測試路 1 號');
    expect(db.prepare('SELECT COUNT(*) count FROM order_items WHERE order_id=?').get(order.id).count).toBe(1);
    expect(db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock).toBe(5);
    expect(db.prepare('SELECT COUNT(*) count FROM cart_items WHERE user_id=?').get(userId).count).toBe(0);
  });

  it('庫存不足時回傳錯誤，且無訂單、無扣庫存並保留購物車', async () => {
    const added = await request(app).post('/api/cart').set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 2 });
    expect(added.status).toBe(200);
    db.prepare('UPDATE products SET stock=1 WHERE id=?').run(product.id);

    const failed = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`).send({
      recipientName: '測試收件人', recipientEmail: 'recipient@example.com', recipientAddress: '測試地址'
    });
    expect(failed.status).toBe(400);
    expect(failed.body).toMatchObject({ data: null, error: 'STOCK_INSUFFICIENT' });
    expect(db.prepare('SELECT COUNT(*) count FROM orders').get().count).toBe(0);
    expect(db.prepare('SELECT COUNT(*) count FROM order_items').get().count).toBe(0);
    expect(db.prepare('SELECT stock FROM products WHERE id=?').get(product.id).stock).toBe(1);
    expect(db.prepare('SELECT quantity FROM cart_items WHERE user_id=?').get(userId).quantity).toBe(2);
  });
});
