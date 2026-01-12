const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Cấu hình phục vụ file tĩnh (Ép trình duyệt hiển thị PDF thay vì tải về)
app.use('/uploads', express.static('uploads', {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.pdf')) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline');
        }
    }
}));
app.use(express.static(path.join(__dirname)));

// Cấu hình Multer: Đổi tên file an toàn (Timestamp + Đuôi file gốc)
// Khắc phục hoàn toàn lỗi tên file có dấu cách hoặc ký tự lạ
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // Lấy đuôi file (ví dụ .pdf, .pptx)
        const ext = path.extname(file.originalname);
        // Đặt tên file mới: <Thời gian hiện tại>.<đuôi file>
        // Ví dụ: 1715483000123.pptx
        cb(null, Date.now() + ext);
    }
});
const upload = multer({ storage: storage });

// Kết nối MySQL
const db = mysql.createConnection({
    host: 'localhost', user: 'root', password: '', database: 'edu_platform'
});

db.connect(err => {
    if (err) console.error('❌ Lỗi kết nối MySQL:', err);
    else console.log('✅ Đã kết nối thành công với MySQL (edu_platform)');
});

// --- CÁC API ---

// 1. Tìm kiếm
app.get('/api/materials', (req, res) => {
    const keyword = req.query.q || '';
    const sql = `SELECT * FROM materials WHERE title LIKE ? OR topic LIKE ?`;
    db.query(sql, [`%${keyword}%`, `%${keyword}%`], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// 2. Chi tiết
app.get('/api/materials/:id', (req, res) => {
    const id = req.params.id;
    const sqlMat = `SELECT * FROM materials WHERE material_id = ?`;
    const sqlRev = `SELECT * FROM reviews WHERE material_id = ?`;
    
    db.query(sqlMat, [id], (err, mats) => {
        if (err || mats.length === 0) return res.status(404).json({error: 'Not found'});
        db.query(sqlRev, [id], (err, revs) => {
            res.json({ material: mats[0], reviews: revs });
        });
    });
});

// 3. Upload (Đã cập nhật)
app.post('/api/upload', upload.single('file'), (req, res) => {
    const { title, topic, description, type } = req.body;
    // Nếu không có file thì lưu chuỗi rỗng
    const fileUrl = req.file ? req.file.path : '';

    const sql = `INSERT INTO materials (title, topic, description, type, file_url, downloads) VALUES (?, ?, ?, ?, ?, 0)`;
    
    db.query(sql, [title, topic, description, type, fileUrl], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Upload thành công!', id: result.insertId });
    });
});

// Chạy server
app.listen(port, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${port}`);
});