const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// اتصال بقاعدة البيانات PostgreSQL
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'BASYOU',
    password: '1234',
    port: 5432,
});

// اختبار الاتصال
pool.connect((err, client, release) => {
    if (err) {
        console.error('❌ خطأ:', err.message);
    } else {
        console.log('✅ متصل بقاعدة البيانات BASYOU');
        release();
    }
});

// ==================== جميع الـ APIs ====================

// الرئيسي
app.get('/', (req, res) => {
    res.json({ 
        company: 'BASYOU',
        message: 'السيستم شغال يا معلم! 🚀'
    });
});

// تسجيل الدخول
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        const result = await pool.query(
            'SELECT id, name, phone, role FROM users WHERE phone = $1 AND password = $2',
            [phone, password]
        );
        if (result.rows.length === 0) {
            res.json({ success: false, message: 'بيانات الدخول غلط' });
        } else {
            res.json({ success: true, user: result.rows[0] });
        }
    } catch (err) {
        res.json({ success: false, message: 'خطأ' });
    }
});

// جلب كل الشحنات (للمدير)
app.get('/api/shipments', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM shipments ORDER BY created_at DESC'
        );
        res.json({ success: true, shipments: result.rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// إنشاء شحنة جديدة
app.post('/api/shipments', async (req, res) => {
    const { customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, payment_method } = req.body;
    const tracking_number = 'BAS' + Math.floor(Math.random() * 1000000);
    const price = weight * 20;
    
    try {
        const result = await pool.query(
            `INSERT INTO shipments 
             (tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method || 'sender']
        );
        res.json({ success: true, shipment: result.rows[0] });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// تتبع شحنة
app.get('/api/track/:tracking_number', async (req, res) => {
    const { tracking_number } = req.params;
    try {
        const shipment = await pool.query('SELECT * FROM shipments WHERE tracking_number = $1', [tracking_number]);
        if (shipment.rows.length === 0) {
            return res.json({ success: false, message: 'الشحنة غير موجودة' });
        }
        const history = await pool.query('SELECT * FROM tracking_history WHERE shipment_id = $1 ORDER BY created_at DESC', [shipment.rows[0].id]);
        res.json({ success: true, shipment: shipment.rows[0], history: history.rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// شحنات عميل
app.get('/api/customer/:id/shipments', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('SELECT * FROM shipments WHERE customer_id = $1 ORDER BY created_at DESC', [id]);
        res.json({ success: true, shipments: result.rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// شحنات مندوب
app.get('/api/courier/:id/shipments', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(
            'SELECT * FROM shipments WHERE courier_id = $1 ORDER BY created_at DESC',
            [id]
        );
        res.json({ success: true, shipments: result.rows });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// تحديث حالة الشحنة
app.put('/api/shipments/:id/status', async (req, res) => {
    const { id } = req.params;
    const { status, location, notes, courier_id } = req.body;
    try {
        await pool.query('UPDATE shipments SET status = $1, courier_id = $2 WHERE id = $3', [status, courier_id, id]);
        await pool.query('INSERT INTO tracking_history (shipment_id, status, location, notes) VALUES ($1, $2, $3, $4)', [id, status, location, notes]);
        res.json({ success: true, message: 'تم التحديث' });
    } catch (err) {
        res.json({ success: false, message: err.message });
    }
});

// تسجيل مستخدم جديد
app.post('/api/register', async (req, res) => {
    const { name, phone, password, role } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO users (name, phone, password, role) VALUES ($1, $2, $3, $4) RETURNING id, name, phone, role',
            [name, phone, password, role || 'customer']
        );
        res.json({ success: true, user: result.rows[0] });
    } catch (err) {
        if (err.code === '23505') {
            res.json({ success: false, message: 'رقم التليفون موجود بالفعل' });
        } else {
            res.json({ success: false, message: err.message });
        }
    }
});

// تشغيل السيرفر
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`
    ═══════════════════════════════════════
         BASYOU - نظام الشحن العالمي
    ═══════════════════════════════════════
    ✅ السيرفر شغال: http://localhost:${PORT}
    ✅ قاعدة البيانات: PostgreSQL
    ✅ جاهز للاستخدام
    ═══════════════════════════════════════
    `);
});