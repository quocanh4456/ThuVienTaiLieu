const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const app = express();

// CẤU HÌNH SERVER
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Cho phép truy cập file tĩnh (html, css)
app.use('/uploads', express.static('uploads')); // Cho phép truy cập thư mục uploads

// KẾT NỐI DATABASE
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'edu_platform'
});

db.connect(err => {
    if (err) console.error('Lỗi kết nối CSDL:', err);
    else console.log('✅ Đã kết nối thành công với MySQL (edu_platform)');
});

// CẤU HÌNH UPLOAD FILE
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        // Đặt tên file = timestamp + tên gốc để tránh trùng
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

// ================= CÁC API (CHỨC NĂNG) =================

// 1. API ĐĂNG NHẬP
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
    db.query(sql, [email, password], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length > 0) {
            res.json({ message: 'Login thành công', user: result[0] });
        } else {
            res.status(401).json({ message: 'Sai email hoặc mật khẩu' });
        }
    });
});

// 2. API UPLOAD TÀI LIỆU
app.post('/api/upload', upload.single('file'), (req, res) => {
    const { title, topic, type, description } = req.body;
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Chưa chọn file!' });

    const filePath = file.path.replace(/\\/g, "/"); 
    const sql = "INSERT INTO materials (title, topic, type, link, description, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)";
    
    // Mặc định user_id = 2 (Sinh viên)
    db.query(sql, [title, topic, type, filePath, description, 2], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ message: 'Upload thành công!' });
    });
});

// 3. API LẤY DANH SÁCH TÀI LIỆU (CÓ TÌM KIẾM & LỌC)
app.get('/api/materials', (req, res) => {
    const keyword = req.query.q;      // Lấy từ khóa tìm kiếm
    const topic = req.query.topic;    // Lấy chủ đề lọc

    let sql = "SELECT * FROM materials WHERE 1=1"; // Mẹo: 1=1 để dễ nối chuỗi AND
    let params = [];

    // 1. Xử lý tìm kiếm từ khóa (Tìm trong Tên hoặc Mô tả)
    if (keyword) {
        sql += " AND (title LIKE ? OR description LIKE ?)";
        const searchStr = `%${keyword}%`; // % bao quanh để tìm tương đối
        params.push(searchStr, searchStr);
    }

    // 2. Xử lý lọc theo chủ đề (Nếu user chọn filter)
    if (topic) {
        // Lưu ý: Trong DB bạn lưu là "Web", "AI". Nếu input gửi lên "web" thường thì ta dùng LIKE cho chắc
        sql += " AND topic LIKE ?"; 
        params.push(`%${topic}%`);
    }

    sql += " ORDER BY created_at DESC";

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// 4. API LẤY CHI TIẾT 1 TÀI LIỆU (QUAN TRỌNG ĐỂ SỬA LỖI CỦA BẠN)
app.get('/api/materials/:id', (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM materials WHERE material_id = ?";
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json(err);
        if (result.length === 0) return res.status(404).json({ message: "Không tìm thấy" });
        res.json(result);
    });
});

// 5. API DASHBOARD (THỐNG KÊ)
app.get('/api/dashboard/stats', (req, res) => {
    const userId = req.query.user_id || 2; 
    const sqlDocs = "SELECT COUNT(*) as total FROM materials";
    const sqlAvg = "SELECT AVG(score) as avg_score FROM quiz_attempts WHERE user_id = ?";
    const sqlChart = `SELECT q.title, qa.score FROM quiz_attempts qa 
                      JOIN quizzes q ON qa.quiz_id = q.quiz_id 
                      WHERE qa.user_id = ? ORDER qa.completed_at DESC LIMIT 5`;

    db.query(sqlDocs, (err, docs) => {
        if(err) return res.status(500).json(err);
        db.query(sqlAvg, [userId], (err, avg) => {
            if(err) return res.status(500).json(err);
            db.query(sqlChart, [userId], (err, chartData) => {
                if(err) return res.status(500).json(err);
                res.json({
                    total_materials: docs[0].total,
                    avg_score: avg[0].avg_score ? avg[0].avg_score.toFixed(1) : 0,
                    chart_data: chartData
                });
            });
        });
    });
});

// CHUYỂN HƯỚNG TRANG CHỦ VỀ ONBOARDING
app.get('/', (req, res) => {
    res.redirect('/modules/onboarding/index.html');
});

// KHỞI ĐỘNG SERVER
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});