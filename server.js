const express = require('express');
const mysql = require('mysql');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const app = express();
// === THÊM ĐOẠN NÀY VÀO ===
app.use((req, res, next) => {
    console.log(`👉 Có người gọi vào: [${req.method}] ${req.url}`);
    next();
});
// CẤU HÌNH SERVER
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname)); // Cho phép truy cập file tĩnh (html, css)
app.use('/uploads', express.static('uploads')); // Cho phép truy cập thư mục uploads

// ==================== CẤU HÌNH NODEMAILER (EMAIL) ====================
const transporter = nodemailer.createTransport({
    service: 'gmail', // Nếu dùng Gmail
    auth: {
        user: 'tranquockhanhxxx@gmail.com', // 👈 THAY BẰNG EMAIL CỦA BẠN
        pass: 'amlv cilj haez jbpw'     // 👈 THAY BẰNG APP PASSWORD (Không phải mật khẩu thường)
    }
});

// Kiểm tra kết nối email
transporter.verify((error, success) => {
    if (error) {
        console.log('⚠️ Email chưa cấu hình:', error.message);
    } else {
        console.log('✅ Email đã sẵn sàng gửi');
    }
});

// KẾT NỐI DATABASE
const db = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root',
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
// ==================== API TÍCH HỢP N8N ====================

// API để n8n kích hoạt việc kiểm tra và gửi thông báo
// ==================== API TÍCH HỢP N8N (ĐÃ SỬA) ====================

app.post('/api/admin/check-and-notify-risk', (req, res) => {
    console.log("👉 [DEBUG] N8N đã gọi vào API check-and-notify-risk"); // Log để kiểm tra

    // 1. Bảo mật
    const N8N_API_KEY = 'your_super_secret_key_123'; 
    if (req.headers['x-n8n-api-key'] !== N8N_API_KEY) {
        return res.status(401).json({ message: 'Unauthorized: Invalid API Key' });
    }

    // 2. URL Webhook (Đã điền cứng, không cần check if nữa)
    const N8N_WEBHOOK_URL = 'https://thanh1234.app.n8n.cloud/webhook/canh-bao-hoc-tap'; 

    // 3. Query tìm sinh viên điểm thấp
    const sqlRisk = `
        SELECT u.user_id, u.full_name, u.email, AVG(qa.score) as avg_score
        FROM users u
        JOIN quiz_attempts qa ON u.user_id = qa.user_id
        GROUP BY u.user_id, u.full_name, u.email
        HAVING avg_score < 5.0
    `;

    db.query(sqlRisk, (err, students) => {
        if (err) {
            console.error("Lỗi SQL:", err);
            return res.status(500).json(err);
        }
        
        if (students.length === 0) {
            return res.json({ message: 'Không có sinh viên nào cần thông báo.' });
        }

        console.log(`Tìm thấy ${students.length} sinh viên. Bắt đầu gửi sang n8n...`);

        // 4. Với mỗi sinh viên, lưu notification và gọi webhook của n8n
        console.log("=== BẮT ĐẦU GỬI EMAIL ===");
        
        // Dùng map để tạo ra danh sách các lời hứa (Promise) xử lý song song
        const emailPromises = students.map((student, index) => {
            const title = 'Cảnh báo kết quả học tập';
            const message = `Chào ${student.full_name}, hệ thống ghi nhận điểm trung bình các bài quiz của bạn là ${parseFloat(student.avg_score).toFixed(1)}. Vui lòng tập trung hơn vào việc học và làm bài.`;

            // Log ra tên email đang chuẩn bị gửi
            console.log(`📤 [${index + 1}/${students.length}] Đang gửi tới: ${student.email} (${student.full_name})`);

            // a. Lưu vào DB (Không cần await để code chạy nhanh, nhưng log lỗi nếu có)
            const sqlSaveNotif = "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)";
            db.query(sqlSaveNotif, [student.user_id, title, message, 'warning'], (err) => {
                if (err) console.error(`❌ Lỗi lưu DB cho ${student.full_name}:`, err.message);
            });

            // b. Gọi webhook của n8n (Quan trọng: Thêm return để Promise biết khi nào xong)
            return fetch(N8N_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: student.email, 
                    name: student.full_name, 
                    message: message 
                })
            })
            .then(res => {
                if (res.ok) {
                    console.log(`✅ Đã gửi thành công sang n8n: ${student.email}`);
                } else {
                    console.log(`⚠️ N8N từ chối (Status ${res.status}): ${student.email}`);
                }
            })
            .catch(err => console.error(`❌ Lỗi mạng khi gọi n8n cho ${student.email}:`, err.message));
        });

        // Đợi tất cả email được gửi đi hết rồi mới báo cho Frontend biết
        Promise.all(emailPromises).then(() => {
            console.log("=== KẾT THÚC QUÁ TRÌNH GỬI ===");
            res.json({ message: `Đã xử lý và gửi yêu cầu cho ${students.length} sinh viên.` });
        });

       
    });
});

// API để client (frontend) lấy danh sách thông báo của 1 user
app.get('/api/notifications/user/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC";
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ==================== API GỬI EMAIL ====================
// API: Gửi email cảnh báo cho sinh viên (Khi nhấn "Gửi n8n")
app.post('/api/admin/send-email/:userId', (req, res) => {
    const userId = req.params.userId;

    // 1. Lấy thông tin sinh viên từ database
    const sqlUser = "SELECT full_name, email, AVG(qa.score) as avg_score FROM users u LEFT JOIN quiz_attempts qa ON u.user_id = qa.user_id WHERE u.user_id = ? GROUP BY u.user_id";
    
    db.query(sqlUser, [userId], (err, results) => {
        if (err) {
            console.error('❌ Lỗi lấy thông tin sinh viên:', err);
            return res.status(500).json({ error: 'Lỗi truy vấn database' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Không tìm thấy sinh viên' });
        }

        const student = results[0];
        const avgScore = student.avg_score ? parseFloat(student.avg_score).toFixed(1) : 'Chưa có dữ liệu';

        // 2. Soạn nội dung email
        const subject = '🚨 Thông báo kết quả học tập';
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #d32f2f;">Cảnh báo Kết quả Học tập</h2>
                <p>Chào <strong>${student.full_name}</strong>,</p>
                
                <p>Hệ thống EduPlatform ghi nhận rằng điểm trung bình các bài quiz của bạn là <strong style="color: #d32f2f;">${avgScore}/10</strong></p>
                
                <p>Để cải thiện kết quả học tập, chúng tôi khuyến nghị bạn:</p>
                <ul>
                    <li>Tìm hiểu lại các bài học đã làm sai</li>
                    <li>Ôn tập kỹ lưỡng trước khi làm bài thi</li>
                    <li>Tham khảo tài liệu trong thư viện học liệu</li>
                    <li>Liên hệ với giáo viên nếu cần hỗ trợ thêm</li>
                </ul>

                <p style="background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
                    <strong>Hạn chót cải thiện:</strong> Vui lòng nâng cao điểm trung bình trước kỳ học tiếp theo.
                </p>

                <p>Trân trọng,<br><strong>Đội ngũ EduPlatform</strong></p>
                <hr>
                <p style="font-size: 0.85rem; color: #999;">
                    Đây là email tự động. Vui lòng không trả lời trực tiếp.
                </p>
            </div>
        `;

        // 3. Gửi email
        const mailOptions = {
            from: 'tranquockhanhxxx@gmail.com', // 👈 THAY BẰNG EMAIL CỦA BẠN
            to: student.email,
            subject: subject,
            html: htmlContent
        };

        transporter.sendMail(mailOptions, (err, info) => {
            if (err) {
                console.error('❌ Lỗi gửi email:', err.message);
                return res.status(500).json({ 
                    error: 'Không thể gửi email',
                    details: err.message 
                });
            }

            // 4. Lưu vào database (log)
            const sqlLog = "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)";
            const title = 'Cảnh báo kết quả học tập';
            const message = `Hệ thống đã gửi email cảnh báo. Điểm trung bình: ${avgScore}/10`;
            
            db.query(sqlLog, [userId, title, message, 'warning'], (err) => {
                if (err) console.error('⚠️ Lỗi lưu log notification:', err.message);
            });

            console.log(`✅ Đã gửi email thành công tới: ${student.email}`);
            res.json({ 
                success: true, 
                message: `Đã gửi email cảnh báo tới ${student.full_name}`,
                email: student.email,
                avgScore: avgScore
            });
        });
    });
});

// KHỞI ĐỘNG SERVER
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại: http://localhost:${PORT}`);
});
