# 📧 Hướng dẫn Cấu hình Gửi Email

## 1️⃣ Cấu hình Gmail SMTP

### Bước 1: Tạo App Password (nếu dùng Gmail)

1. Truy cập: https://myaccount.google.com/security
2. Bật xác minh 2 bước (nếu chưa)
3. Vào **App passwords** (gần phần Password)
4. Chọn **Mail** và **Windows Computer**
5. Google sẽ cấp mật khẩu ứng dụng (16 ký tự)
6. Copy mật khẩu này (chỉ hiển thị 1 lần)

### Bước 2: Cập nhật trong server.js

Mở file: `server.js`

Tìm dòng cấu hình Nodemailer (khoảng dòng 20-28):

```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',      // 👈 THAY BẰNG EMAIL GMAIL CỦA BẠN
        pass: 'your-app-password'           // 👈 THAY BẰNG APP PASSWORD (16 ký tự)
    }
});
```

**Ví dụ:**
```javascript
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'my.eduplatform@gmail.com',
        pass: 'abcd efgh ijkl mnop'
    }
});
```

### Bước 3: Cập nhật email trong API endpoint

Tìm API endpoint `/api/admin/send-email/:userId` (khoảng dòng 495):

```javascript
const mailOptions = {
    from: 'your-email@gmail.com', // 👈 THAY BẰNG EMAIL CỦA BẠN (giống phía trên)
    ...
};
```

---

## 2️⃣ Cách sử dụng

1. **Khởi động server:**
   ```bash
   node server.js
   ```

2. **Truy cập trang Admin:**
   - Vào: `http://localhost:3000/modules/admin/index.html`

3. **Gửi email cảnh báo:**
   - Xem danh sách sinh viên "Nguy cơ cao" (điểm < 5.0)
   - Nhấn nút **"Gửi n8n"**
   - Hệ thống sẽ:
     - Gửi email tới sinh viên
     - Lưu log vào database (bảng `notifications`)
     - Hiển thị thông báo thành công

---

## 3️⃣ Sử dụng dịch vụ email khác

### Nếu muốn dùng **Outlook/Hotmail:**
```javascript
const transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'your-email@hotmail.com',
        pass: 'your-password'
    }
});
```

### Nếu muốn dùng **SendGrid:**
```javascript
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
        user: 'apikey',
        pass: 'SG.xxxxxxxxx'  // API key từ SendGrid
    }
});
```

---

## 4️⃣ Kiểm tra lỗi

Nếu gặp lỗi, kiểm tra:

1. **Email/Password sai:**
   - Server console sẽ hiện: `⚠️ Email chưa cấu hình`

2. **Gmail bảo mật:**
   - Cho phép ứng dụng kém an toàn: https://myaccount.google.com/lesssecureapps

3. **Kết nối mạng:**
   - Kiểm tra internet connection

4. **Firewall:**
   - Một số mạng công ty chặn port SMTP (587)

---

## 5️⃣ Template email tùy chỉnh

Email được gửi với template HTML. Bạn có thể sửa nội dung trong API endpoint:

Tìm phần `htmlContent` trong `/api/admin/send-email/:userId` để thay đổi:
- Tiêu đề (subject)
- Nội dung email
- Màu sắc, font chữ, v.v.

---

## 6️⃣ Troubleshooting

| Lỗi | Giải pháp |
|-----|----------|
| `EAUTH` | Kiểm tra email/password, bật App password |
| `TIMEOUT` | Kiểm tra internet, firewall |
| `Cannot find module 'nodemailer'` | Chạy: `npm install nodemailer` |
| Email không đến | Kiểm tra thư mục Spam |

---

**✅ Xong! Bây giờ khi bạn nhấn "Gửi n8n" thì hệ thống sẽ gửi email thực tế tới sinh viên.**
