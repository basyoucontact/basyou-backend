const express = require('express');
const Database = require('better-sqlite3');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// قاعدة البيانات SQLite
const db = new Database('./basyou.db');

// إنشاء الجداول
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'customer'
    );
    
    CREATE TABLE IF NOT EXISTS shipments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_number TEXT UNIQUE,
        customer_id INTEGER,
        courier_id INTEGER,
        sender_name TEXT,
        sender_phone TEXT,
        sender_address TEXT,
        receiver_name TEXT,
        receiver_phone TEXT,
        receiver_address TEXT,
        weight REAL,
        price REAL,
        payment_method TEXT DEFAULT 'sender',
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE IF NOT EXISTS tracking_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shipment_id INTEGER,
        status TEXT,
        location TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// إضافة مستخدمين افتراضيين
const insertUser = db.prepare(`INSERT OR IGNORE INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)`);
insertUser.run('مدير النظام', 'admin', 'admin123', 'admin');
insertUser.run('مندوب توصيل', '01001234568', '123456', 'courier');
insertUser.run('أحمد محمد', '01001234567', '123456', 'customer');

console.log('✅ قاعدة البيانات جاهزة');

// ==================== APIs ====================

app.get('/', (req, res) => {
    res.json({ company: 'BASYOU', message: 'السيستم شغال يا معلم! 🚀' });
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    const user = db.prepare('SELECT id, name, phone, role FROM users WHERE phone = ? AND password = ?').get(phone, password);
    if (!user) res.json({ success: false, message: 'بيانات الدخول غلط' });
    else res.json({ success: true, user });
});

// جلب كل الشحنات
app.get('/api/shipments', (req, res) => {
    const shipments = db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
    res.json({ success: true, shipments });
});

// إنشاء شحنة
app.post('/api/shipments', (req, res) => {
    const { customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, payment_method } = req.body;
    const tracking_number = 'BAS' + Math.floor(Math.random() * 1000000);
    const price = weight * 20;
    
    const stmt = db.prepare(`INSERT INTO shipments (tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const info = stmt.run(tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method || 'sender');
    
    res.json({ success: true, shipment: { id: info.lastInsertRowid, tracking_number, price } });
});

// تتبع شحنة
app.get('/api/track/:tracking_number', (req, res) => {
    const shipment = db.prepare('SELECT * FROM shipments WHERE tracking_number = ?').get(req.params.tracking_number);
    if (!shipment) return res.json({ success: false, message: 'الشحنة غير موجودة' });
    const history = db.prepare('SELECT * FROM tracking_history WHERE shipment_id = ? ORDER BY created_at DESC').all(shipment.id);
    res.json({ success: true, shipment, history });
});

// شحنات عميل
app.get('/api/customer/:id/shipments', (req, res) => {
    const shipments = db.prepare('SELECT * FROM shipments WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json({ success: true, shipments });
});

// شحنات مندوب
app.get('/api/courier/:id/shipments', (req, res) => {
    const shipments = db.prepare('SELECT * FROM shipments WHERE courier_id = ? ORDER BY created_at DESC').all(req.params.id);
    res.json({ success: true, shipments });
});

// تحديث حالة الشحنة
app.put('/api/shipments/:id/status', (req, res) => {
    const { status, location, notes, courier_id } = req.body;
    db.prepare('UPDATE shipments SET status = ?, courier_id = ? WHERE id = ?').run(status, courier_id, req.params.id);
    db.prepare('INSERT INTO tracking_history (shipment_id, status, location, notes) VALUES (?, ?, ?, ?)').run(req.params.id, status, location, notes);
    res.json({ success: true, message: 'تم التحديث' });
});

// تسجيل مستخدم جديد
app.post('/api/register', (req, res) => {
    const { name, phone, password, role } = req.body;
    try {
        const info = db.prepare('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)').run(name, phone, password, role || 'customer');
        res.json({ success: true, user: { id: info.lastInsertRowid, name, phone, role: role || 'customer' } });
    } catch (err) {
        res.json({ success: false, message: 'رقم التليفون موجود بالفعل' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ BASYOU سيرفر شغال على http://localhost:${PORT}`);
});