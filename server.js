const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// قاعدة البيانات SQLite
const db = new sqlite3.Database('./basyou.db', (err) => {
    if (err) {
        console.error('❌ خطأ:', err.message);
    } else {
        console.log('✅ قاعدة البيانات متصلة');
        
        // إنشاء الجداول
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'customer'
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS shipments (
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
        )`);
        
        db.run(`CREATE TABLE IF NOT EXISTS tracking_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shipment_id INTEGER,
            status TEXT,
            location TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // إضافة مستخدمين افتراضيين
        db.run(`INSERT OR IGNORE INTO users (name, phone, password, role) 
                VALUES ('مدير النظام', 'admin', 'admin123', 'admin')`);
        db.run(`INSERT OR IGNORE INTO users (name, phone, password, role) 
                VALUES ('مندوب توصيل', '01001234568', '123456', 'courier')`);
        db.run(`INSERT OR IGNORE INTO users (name, phone, password, role) 
                VALUES ('أحمد محمد', '01001234567', '123456', 'customer')`);
        
        console.log('✅ الجداول والمستخدمين جاهزين');
    }
});

// ==================== APIs ====================

app.get('/', (req, res) => {
    res.json({ company: 'BASYOU', message: 'السيستم شغال يا معلم! 🚀' });
});

// تسجيل الدخول
app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT id, name, phone, role FROM users WHERE phone = ? AND password = ?', [phone, password], (err, user) => {
        if (err) res.json({ success: false, message: 'خطأ' });
        else if (!user) res.json({ success: false, message: 'بيانات الدخول غلط' });
        else res.json({ success: true, user });
    });
});

// جلب كل الشحنات
app.get('/api/shipments', (req, res) => {
    db.all('SELECT * FROM shipments ORDER BY created_at DESC', [], (err, shipments) => {
        res.json({ success: true, shipments: shipments || [] });
    });
});

// إنشاء شحنة
app.post('/api/shipments', (req, res) => {
    const { customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, payment_method } = req.body;
    const tracking_number = 'BAS' + Math.floor(Math.random() * 1000000);
    const price = weight * 20;
    
    db.run(
        `INSERT INTO shipments (tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [tracking_number, customer_id, sender_name, sender_phone, sender_address, receiver_name, receiver_phone, receiver_address, weight, price, payment_method || 'sender'],
        function(err) {
            if (err) res.json({ success: false, message: err.message });
            else res.json({ success: true, shipment: { id: this.lastID, tracking_number, price } });
        }
    );
});

// تتبع شحنة
app.get('/api/track/:tracking_number', (req, res) => {
    const { tracking_number } = req.params;
    db.get('SELECT * FROM shipments WHERE tracking_number = ?', [tracking_number], (err, shipment) => {
        if (err) res.json({ success: false, message: err.message });
        else if (!shipment) res.json({ success: false, message: 'الشحنة غير موجودة' });
        else {
            db.all('SELECT * FROM tracking_history WHERE shipment_id = ? ORDER BY created_at DESC', [shipment.id], (err, history) => {
                res.json({ success: true, shipment, history: history || [] });
            });
        }
    });
});

// شحنات عميل
app.get('/api/customer/:id/shipments', (req, res) => {
    const { id } = req.params;
    db.all('SELECT * FROM shipments WHERE customer_id = ? ORDER BY created_at DESC', [id], (err, shipments) => {
        res.json({ success: true, shipments: shipments || [] });
    });
});

// شحنات مندوب
app.get('/api/courier/:id/shipments', (req, res) => {
    const { id } = req.params;
    db.all('SELECT * FROM shipments WHERE courier_id = ? ORDER BY created_at DESC', [id], (err, shipments) => {
        res.json({ success: true, shipments: shipments || [] });
    });
});

// تحديث حالة الشحنة
app.put('/api/shipments/:id/status', (req, res) => {
    const { id } = req.params;
    const { status, location, notes, courier_id } = req.body;
    db.run('UPDATE shipments SET status = ?, courier_id = ? WHERE id = ?', [status, courier_id, id], (err) => {
        if (err) res.json({ success: false, message: err.message });
        else {
            db.run('INSERT INTO tracking_history (shipment_id, status, location, notes) VALUES (?, ?, ?, ?)', [id, status, location, notes], () => {
                res.json({ success: true, message: 'تم التحديث' });
            });
        }
    });
});

// تسجيل مستخدم جديد
app.post('/api/register', (req, res) => {
    const { name, phone, password, role } = req.body;
    db.run('INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)', [name, phone, password, role || 'customer'], function(err) {
        if (err) res.json({ success: false, message: 'رقم التليفون موجود بالفعل' });
        else res.json({ success: true, user: { id: this.lastID, name, phone, role: role || 'customer' } });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ BASYOU سيرفر شغال على http://localhost:${PORT}`);
});