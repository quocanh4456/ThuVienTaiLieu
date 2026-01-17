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

// ==============================
// 3) API LẤY DANH SÁCH TÀI LIỆU (CÓ TÌM KIẾM & LỌC)
// ==============================
// Endpoint: GET /api/materials
// Mục đích:
// - Trả về danh sách tài liệu trong bảng materials
// - Hỗ trợ:
//   + Tìm kiếm theo từ khóa (q) trong title hoặc description
//   + Lọc theo topic
// - Sắp xếp theo created_at giảm dần (mới nhất lên đầu)
//
// Ví dụ gọi:
// - /api/materials
// - /api/materials?q=java
// - /api/materials?topic=Web
// - /api/materials?q=java&topic=Web
app.get('/api/materials', (req, res) => {

    // Lấy query param "q" (keyword tìm kiếm) từ URL
    // VD: /api/materials?q=java  => keyword = "java"
    const keyword = req.query.q;

    // Lấy query param "topic" (lọc chủ đề) từ URL
    // VD: /api/materials?topic=Web => topic = "Web"
    const topic = req.query.topic;

    // Khởi tạo câu SQL base
    // "WHERE 1=1" là mẹo để nối thêm điều kiện AND dễ hơn (không cần xử lý trường hợp điều kiện đầu tiên)
    let sql = "SELECT * FROM materials WHERE 1=1";

    // params là danh sách tham số tương ứng với các dấu "?" trong SQL
    // Dùng params giúp tránh SQL Injection (ít nhất ở mức cơ bản)
    let params = [];

    // ------------------------------
    // 1) TÌM KIẾM THEO KEYWORD
    // ------------------------------
    // Nếu user có truyền keyword (q) thì:
    // - Tìm trong title hoặc description
    // - Dùng LIKE '%keyword%' để tìm tương đối (chứa chuỗi)
    if (keyword) {
        sql += " AND (title LIKE ? OR description LIKE ?)";
        const searchStr = `%${keyword}%`;   // ví dụ "java" -> "%java%"
        params.push(searchStr, searchStr);  // 2 dấu ? nên push 2 lần
    }

    // ------------------------------
    // 2) LỌC THEO TOPIC
    // ------------------------------
    // Nếu user truyền topic thì:
    // - Lọc theo cột topic
    // - Dùng LIKE để "nới lỏng" matching (đỡ bị case mismatch / khác format)
    //   VD: topic=web vẫn match "Web" nếu DB lưu không thống nhất (nhưng LIKE mặc định MySQL có thể case-insensitive tuỳ collation)
    if (topic) {
        sql += " AND topic LIKE ?";
        params.push(`%${topic}%`);
    }

    // ------------------------------
    // 3) SẮP XẾP KẾT QUẢ
    // ------------------------------
    // created_at DESC => mới nhất lên đầu
    sql += " ORDER BY created_at DESC";

    // Thực thi query với params
    db.query(sql, params, (err, result) => {
        // Nếu lỗi DB (syntax, connect,...) trả 500
        if (err) return res.status(500).json(err);

        // Trả về danh sách tài liệu (array)
        res.json(result);
    });
});


// ==============================
// 4) API LẤY CHI TIẾT 1 TÀI LIỆU
// ==============================
// Endpoint: GET /api/materials/:id
// Mục đích:
// - Trả về chi tiết 1 tài liệu theo material_id
// - Dùng cho trang detail (xem trước + download)
//
// Ví dụ gọi:
// - /api/materials/10  => lấy material có material_id = 10
app.get('/api/materials/:id', (req, res) => {

    // Lấy param :id từ URL
    // VD: /api/materials/10 => id = "10"
    const id = req.params.id;

    // SQL query lấy đúng 1 record theo material_id
    // Dùng "?" để bind param chống SQL injection
    const sql = "SELECT * FROM materials WHERE material_id = ?";

    db.query(sql, [id], (err, result) => {
        // Nếu lỗi DB => 500
        if (err) return res.status(500).json(err);

        // Nếu không có bản ghi nào => trả 404
        // result là array, nếu length = 0 nghĩa là không tìm thấy
        if (result.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy" });
        }

        // Trả về dữ liệu chi tiết
        // NOTE: Hiện tại trả array (result) nên frontend phải data[0]
        // Thông thường API detail sẽ trả object: result[0]
        res.json(result);
    });
});


// 5. API DASHBOARD (CẬP NHẬT)
app.get('/api/dashboard/stats', (req, res) => {
    // Lấy ID từ query hoặc mặc định là 2
    const userId = req.query.user_id || 2; 

    // Query 1: Đếm tổng tài liệu
    const sqlDocs = "SELECT COUNT(*) as total FROM materials";
    
    // Query 2: Tính điểm trung bình của User
    const sqlAvg = "SELECT AVG(score) as avg_score FROM quiz_attempts WHERE user_id = ?";
    
    // Query 3: Lấy lịch sử 10 bài thi gần nhất để vẽ biểu đồ
    const sqlChart = `SELECT q.title, qa.score, qa.completed_at 
                      FROM quiz_attempts qa 
                      JOIN quizzes q ON qa.quiz_id = q.quiz_id 
                      WHERE qa.user_id = ? 
                      ORDER BY qa.completed_at ASC`; 
                      // Lưu ý: ASC để vẽ từ cũ đến mới

    db.query(sqlDocs, (err, docs) => {
        if(err) return res.status(500).json(err);
        
        db.query(sqlAvg, [userId], (err, avg) => {
            if(err) return res.status(500).json(err);
            
            db.query(sqlChart, [userId], (err, chartData) => {
                if(err) return res.status(500).json(err);
                
                // Log ra để kiểm tra xem có dữ liệu không
                console.log("Dashboard Data:", {
                    total: docs[0].total,
                    avg: avg[0].avg_score,
                    chart_len: chartData.length
                });

                res.json({
                    total_materials: docs[0].total,
                    avg_score: avg[0].avg_score ? parseFloat(avg[0].avg_score).toFixed(1) : 0,
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
// ==================== API QUIZ (MỚI) ====================

// 1. Lấy danh sách các bài thi
app.get('/api/quizzes', (req, res) => {
    const sql = "SELECT * FROM quizzes ORDER BY created_at DESC";
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json(err);
        res.json(result);
    });
});

// 2. Lấy nội dung đề thi + câu hỏi
app.get('/api/quizzes/:id', (req, res) => {
    const quizId = req.params.id;
    
    // Lấy thông tin đề thi
    const sqlQuiz = "SELECT * FROM quizzes WHERE quiz_id = ?";
    // Lấy danh sách câu hỏi (Không lấy đáp án đúng để lộ cho client xem trộm)
    const sqlQuestions = "SELECT question_id, question_text, option_a, option_b, option_c, option_d FROM questions WHERE quiz_id = ?";

    db.query(sqlQuiz, [quizId], (err, quizResult) => {
        if (err) return res.status(500).json(err);
        if (quizResult.length === 0) return res.status(404).json({message: "Không tìm thấy đề thi"});

        db.query(sqlQuestions, [quizId], (err, questionResult) => {
            if (err) return res.status(500).json(err);
            // Trả về cả thông tin đề và danh sách câu hỏi
            res.json({
                quiz: quizResult[0],
                questions: questionResult
            });
        });
    });
});

// 3. Nộp bài và Chấm điểm (Server tự chấm để bảo mật)
app.post('/api/quizzes/:id/submit', (req, res) => {
    const quizId = req.params.id;
    const { user_id, answers } = req.body; // answers là object { question_id: 'A', ... }

    // Lấy đáp án đúng từ database để so sánh
    const sqlOriginal = "SELECT question_id, correct_option FROM questions WHERE quiz_id = ?";
    
    db.query(sqlOriginal, [quizId], (err, questions) => {
        if (err) return res.status(500).json(err);

        let correctCount = 0;
        let totalQuestions = questions.length;

        // Thuật toán chấm điểm
        questions.forEach(q => {
            // So sánh đáp án user gửi lên với đáp án đúng trong DB
            if (answers[q.question_id] === q.correct_option) {
                correctCount++;
            }
        });

        // Tính điểm thang 10
        const score = totalQuestions === 0 ? 0 : (correctCount / totalQuestions) * 10;

        // Lưu điểm vào lịch sử
        const sqlSave = "INSERT INTO quiz_attempts (user_id, quiz_id, score) VALUES (?, ?, ?)";
        db.query(sqlSave, [user_id || 2, quizId, score], (err, result) => {
            if (err) return res.status(500).json(err);
            
            res.json({
                message: "Đã chấm điểm xong!",
                score: score.toFixed(1), // Làm tròn 1 số thập phân
                correct: correctCount,
                total: totalQuestions
            });
        });
    });
});
// ==================== API ADMIN (SỬA LỖI) ====================

app.get('/api/admin/dashboard', (req, res) => {
    // 1. Đếm tổng sinh viên
    const sqlCount = "SELECT COUNT(*) as total FROM users";
    
    // 2. Tìm sinh viên có điểm thấp (Dưới 7.0)
    // Lưu ý: Tên biến ở đây là 'sqlRisk'
    const sqlRisk = `
        SELECT u.user_id, u.full_name, u.email, AVG(qa.score) as avg_score 
        FROM users u
        JOIN quiz_attempts qa ON u.user_id = qa.user_id
        GROUP BY u.user_id
        HAVING avg_score < 7.0
        ORDER BY avg_score ASC
    `;

    db.query(sqlCount, (err, countResult) => {
        if (err) return res.status(500).json(err);
        
        // --- SỬA LỖI TẠI ĐÂY: Dùng đúng tên biến 'sqlRisk' ---
        db.query(sqlRisk, (err, riskResult) => {
            if (err) return res.status(500).json(err);
            
            // Đếm số lượng "Nguy cơ cao" (dưới 5.0)
            const highRiskCount = riskResult.filter(s => s.avg_score < 5.0).length;

            res.json({
                total_students: countResult[0].total,
                at_risk_count: highRiskCount,
                n8n_sent: 15, // Số giả định
                risk_list: riskResult
            });
        });
    });
});

// API: Lấy chi tiết lịch sử thi của 1 sinh viên
app.get('/api/admin/student-details/:id', (req, res) => {
    const userId = req.params.id;
    const sql = `
        SELECT q.title, qa.score, qa.completed_at 
        FROM quiz_attempts qa
        JOIN quizzes q ON qa.quiz_id = q.quiz_id
        WHERE qa.user_id = ?
        ORDER BY qa.completed_at DESC
    `;
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});
// KHỞI ĐỘNG SERVER
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});