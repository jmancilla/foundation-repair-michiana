document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Header
  const header = document.querySelector('header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });

  // 2. Mobile Nav Menu
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('nav');

  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      nav.classList.toggle('mobile-active');
      
      // Prevent body scroll when menu is active
      if (nav.classList.contains('mobile-active')) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    });

    // Close menu on link click
    const navLinks = nav.querySelectorAll('a');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        nav.classList.remove('mobile-active');
        document.body.style.overflow = '';
      });
    });
  }

  // 3. Highlight Active Page Link
  const currentPath = window.location.pathname;
  const links = document.querySelectorAll('nav a');
  links.forEach(link => {
    const href = link.getAttribute('href');
    // Simple matching logic
    if (href === 'index.html' && (currentPath.endsWith('/') || currentPath.endsWith('index.html'))) {
      link.classList.add('active');
    } else if (currentPath.includes(href) && href !== 'index.html' && href !== '#') {
      link.classList.add('active');
    }
  });

  // 4. Testimonials Carousel
  const track = document.querySelector('.carousel-track');
  const slides = Array.from(document.querySelectorAll('.carousel-slide'));
  const dotsContainer = document.querySelector('.carousel-dots');
  
  if (track && slides.length > 0) {
    let currentIndex = 0;
    let slideInterval;
    const dots = [];

    // Create dot indicators
    slides.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.classList.add('carousel-dot');
      if (index === 0) dot.classList.add('active');
      dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
      dotsContainer.appendChild(dot);
      dots.push(dot);

      dot.addEventListener('click', () => {
        goToSlide(index);
        resetTimer();
      });
    });

    function updateSlidesState() {
      slides.forEach((slide, index) => {
        if (index === currentIndex) {
          slide.classList.add('active');
        } else {
          slide.classList.remove('active');
        }
      });
    }

    function goToSlide(index) {
      currentIndex = index;
      const amountToMove = -currentIndex * 100;
      track.style.transform = `translateX(${amountToMove}%)`;
      
      // Update dots
      dots.forEach(dot => dot.classList.remove('active'));
      dots[currentIndex].classList.add('active');

      updateSlidesState();
    }

    function nextSlide() {
      let nextIndex = currentIndex + 1;
      if (nextIndex >= slides.length) nextIndex = 0;
      goToSlide(nextIndex);
    }

    function startTimer() {
      slideInterval = setInterval(nextSlide, 6000);
    }

    function resetTimer() {
      clearInterval(slideInterval);
      startTimer();
    }

    // Initialize state
    updateSlidesState();
    startTimer();
  }

  // 5. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    
    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all other items
      faqItems.forEach(otherItem => {
        otherItem.classList.remove('active');
        const otherContent = otherItem.querySelector('.faq-content');
        if (otherContent) otherContent.style.maxHeight = null;
      });

      if (!isActive) {
        item.classList.add('active');
        const content = item.querySelector('.faq-content');
        // Set max-height dynamically to enable smooth animation
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
});
