// Back Button Functionality
document.getElementById('backBtn')?.addEventListener('click', () => window.history.back());

// Check if the device supports touch events
const isTouchDevice = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Update button visibility based on slider scroll position
function updateButtonVisibility(slider, leftBtn, rightBtn) {
    const maxScrollLeft = slider.scrollWidth - slider.clientWidth;
    leftBtn.style.display = slider.scrollLeft > 0 ? 'block' : 'none';
    rightBtn.style.display = slider.scrollLeft < maxScrollLeft ? 'block' : 'none';
}

// Initialize scroll functionality for a section
function initializeScrollFunctionality(section) {
    const slider = section.querySelector('.content2');
    const leftBtn = section.querySelector('.left_btn');
    const rightBtn = section.querySelector('.right_btn');

    if (!slider || !leftBtn || !rightBtn) return;

    const deviceWidth = window.innerWidth;

    // Hide buttons on touch devices
    if (isTouchDevice()) {
        leftBtn.style.display = 'none';
        rightBtn.style.display = 'none';
    } else {
        updateButtonVisibility(slider, leftBtn, rightBtn);
    }

    slider.addEventListener('scroll', () => updateButtonVisibility(slider, leftBtn, rightBtn));

    leftBtn.addEventListener('click', () => slider.scrollLeft -= deviceWidth * 0.6);
    rightBtn.addEventListener('click', () => slider.scrollLeft += deviceWidth * 0.6);

    window.addEventListener('resize', () => updateButtonVisibility(slider, leftBtn, rightBtn));
}

// Apply functionality for each section
document.querySelectorAll('.content').forEach(initializeScrollFunctionality);
