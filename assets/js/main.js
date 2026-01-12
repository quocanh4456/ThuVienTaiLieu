// assets/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('EduPlatform loaded');

    // Xử lý sự kiện click vào Dify Widget
    const difyWidget = document.querySelector('.dify-widget');
    if (difyWidget) {
        difyWidget.addEventListener('click', () => {
            // Đây là nơi bạn sẽ paste đoạn mã nhúng thật của Dify vào
            // Ví dụ: window.difyChatbot.open();
            alert("Mở cửa sổ chat Dify (Integration)");
        });
    }

    // Highlight menu active dựa trên URL hiện tại
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        if(link.href.includes(currentPath.split('/').pop())) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
});