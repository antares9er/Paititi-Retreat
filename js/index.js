    // Nav scroll effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
        navbar.classList.toggle('scrolled', window.scrollY > 60);
    });

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

    // FAQ accordion
    document.querySelectorAll('.faq-item').forEach(item => {
        item.querySelector('.faq-question').addEventListener('click', () => {
            const isOpen = item.classList.contains('open');
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
            if (!isOpen) item.classList.add('open');
        });
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', function(e) {
            const target = document.querySelector(this.getAttribute('href'));
            if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
        });
    });

    // Lightbox
    const galleries = {
        ensuite: {
            title: 'Luxury Ensuite Rooms',
            images: [
                'Luxury ensuite room/ensuite-room.jpg',
                'Luxury ensuite room/ensuite-bathroom.jpg',
                'Luxury ensuite room/ensuite.jpg',
                'Luxury ensuite room/luxury room.jpeg',
                'Luxury ensuite room/own bath.jpeg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-17.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-18.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-20.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-22.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-23.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-50.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-51 2.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-40-51.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-46.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-47.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-48.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-49.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-50.jpg',
                'Luxury ensuite room/PHOTO-2026-05-05-10-41-53.jpg',
                'Luxury ensuite room/WhatsApp Image 2026-05-05 at 10.40.18.jpeg'
            ]
        },
        bamboo: {
            title: 'Open Bamboo Sky Suites',
            images: [
                'Open-bamboo-rooms/open-bamboo.jpg',
                'Open-bamboo-rooms/open-bamboo-room.jpg',
                'Open-bamboo-rooms/Bathroom_sinks.jpeg',
                'Open-bamboo-rooms/sky_bathrooms.jpeg',
                'Open-bamboo-rooms/PHOTO-2026-05-05-10-40-15.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-10.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-11.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-12.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-13 2.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-13.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-14 2.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-14.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-15 2.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-15.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-25 2.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-25 3.jpg',
                'Open-bamboo-rooms/PHOTO-2026-05-10-15-38-26.jpg'
            ]
        },
        outdoor: {
            title: 'Sacred Gardens & Infinity Pool',
            images: [
                'Naya Veda Vastu Outdoor/sky_villa_pool.jpeg',
                'Naya Veda Vastu Outdoor/Naya_Gardens.webp',
                'Naya Veda Vastu Outdoor/Naya-gardens2.webp',
                'Naya Veda Vastu Outdoor/Naya_Mandala_garden.webp',
                'Naya Veda Vastu Outdoor/Naya-Luftaufnahme.webp',
                'Naya Veda Vastu Outdoor/Naya.webp',
                'Naya Veda Vastu Outdoor/mini-baum.jpeg',
                'Naya Veda Vastu Outdoor/WhatsAppImage2024-10-30at11.39.30AM2.webp'
            ]
        },
        restaurant: {
            title: 'The Restaurant',
            images: [
                'Maleika Restaurant/This picture.jpg',
                'Maleika Restaurant/Naya-Restaurant.webp',
                'Maleika Restaurant/food-Naya.webp',
                'Maleika Restaurant/balinese food.webp',
                'Maleika Restaurant/Meal_Naya.webp',
                'Maleika Restaurant/dessert.webp',
                'Maleika Restaurant/Drink_Naya.webp',
                'Maleika Restaurant/Kuschelecke-Resto_Naya.webp',
                'Maleika Restaurant/RESTAUTANT-Naya.webp',
                'Maleika Restaurant/RESTO_Naya.webp',
                'Maleika Restaurant/Restaurant-gäste.webp',
                'Maleika Restaurant/ALD09738.jpg',
                'Maleika Restaurant/ALD09741.jpg',
                'Maleika Restaurant/DSC04519.jpg',
                'Maleika Restaurant/DSC04690.jpg',
                'Maleika Restaurant/DSC04706-3.jpg',
                'Maleika Restaurant/PHOTO-2026-05-13-17-07-56.jpg'
            ]
        }
    };

    let currentGallery = null;
    let currentIndex = 0;
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxVideo = document.getElementById('lightboxVideo');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxCounter = document.getElementById('lightboxCounter');
    const lightboxThumbs = document.getElementById('lightboxThumbs');

    function isVideo(src) { return src.toLowerCase().endsWith('.mp4'); }

    function renderLightbox() {
        const images = currentGallery.images;
        const src = images[currentIndex];
        lightboxTitle.textContent = currentGallery.title;
        lightboxCounter.textContent = (currentIndex + 1) + ' / ' + images.length;
        if (isVideo(src)) {
            lightboxImg.style.display = 'none';
            lightboxVideo.style.display = '';
            lightboxVideo.src = src;
            lightboxVideo.load();
        } else {
            lightboxVideo.pause();
            lightboxVideo.src = '';
            lightboxVideo.style.display = 'none';
            lightboxImg.style.display = '';
            lightboxImg.src = src;
        }
        lightboxThumbs.innerHTML = '';
        images.forEach((s, i) => {
            let thumb;
            if (isVideo(s)) {
                thumb = document.createElement('div');
                thumb.className = 'lightbox-thumb-video' + (i === currentIndex ? ' active' : '');
                thumb.innerHTML = '<svg viewBox="0 0 24 24" fill="white" width="20" height="20"><polygon points="6,3 20,12 6,21"/></svg>';
            } else {
                thumb = document.createElement('img');
                thumb.src = s;
                thumb.className = 'lightbox-thumb' + (i === currentIndex ? ' active' : '');
            }
            thumb.onclick = () => { currentIndex = i; renderLightbox(); };
            lightboxThumbs.appendChild(thumb);
        });
        const active = lightboxThumbs.querySelector('.active');
        if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }

    function openLightbox(key, startIndex) {
        currentGallery = galleries[key];
        currentIndex = startIndex || 0;
        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
        renderLightbox();
    }

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
        lightboxVideo.pause();
        lightboxVideo.src = '';
    }

    document.getElementById('lightboxClose').onclick = closeLightbox;
    document.getElementById('lightboxPrev').onclick = () => {
        lightboxVideo.pause();
        currentIndex = (currentIndex - 1 + currentGallery.images.length) % currentGallery.images.length;
        renderLightbox();
    };
    document.getElementById('lightboxNext').onclick = () => {
        lightboxVideo.pause();
        currentIndex = (currentIndex + 1) % currentGallery.images.length;
        renderLightbox();
    };
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') { currentIndex = (currentIndex - 1 + currentGallery.images.length) % currentGallery.images.length; renderLightbox(); }
        if (e.key === 'ArrowRight') { currentIndex = (currentIndex + 1) % currentGallery.images.length; renderLightbox(); }
    });
    document.querySelectorAll('.accommodation-card[data-gallery]').forEach(card => {
        card.addEventListener('click', () => openLightbox(card.dataset.gallery));
    });
    document.querySelectorAll('.gallery-item[data-gallery]').forEach(item => {
        item.addEventListener('click', () => openLightbox(item.dataset.gallery, parseInt(item.dataset.index || 0)));
    });

    // Moments 2026: each chapter grid becomes its own lightbox gallery (built from the HTML, no list to maintain).
    // Only the first MOMENTS_PREVIEW items show; a button reveals the rest. The lightbox always holds all of them.
    const MOMENTS_PREVIEW = 6;
    document.querySelectorAll('[data-moments]').forEach(grid => {
        const key = 'moments-' + grid.dataset.moments;
        const items = Array.from(grid.querySelectorAll('.moment-item'));
        galleries[key] = { title: grid.dataset.title, images: items.map(i => i.dataset.src) };
        items.forEach((item, idx) => item.addEventListener('click', () => openLightbox(key, idx)));

        if (items.length <= MOMENTS_PREVIEW) return;
        const hidden = items.slice(MOMENTS_PREVIEW);
        hidden.forEach(i => {
            i.classList.add('is-collapsed');
            const v = i.querySelector('video');
            if (v) v.preload = 'none';   // don't download hidden videos until the chapter is opened
        });
        let primed = false;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'moments-more';
        btn.textContent = 'Show all ' + items.length + ' moments';
        btn.addEventListener('click', () => {
            const open = grid.classList.toggle('is-open');
            if (open && !primed) {
                primed = true;
                hidden.forEach(i => { const v = i.querySelector('video'); if (v && !v.poster) { v.preload = 'metadata'; v.load(); } });
            }
            btn.textContent = open ? 'Show less' : 'Show all ' + items.length + ' moments';
            if (!open) grid.closest('.moments-chapter').scrollIntoView({ behavior: 'smooth' });
        });
        grid.after(btn);
    });

    // Program: day titles always visible, details fold out (first day open)
    document.querySelectorAll('.program-day').forEach((day, idx) => {
        const title = day.querySelector('.program-day-title');
        if (!title) return;
        const body = document.createElement('div');
        body.className = 'program-day-body';
        while (title.nextSibling) body.appendChild(title.nextSibling);
        title.after(body);
        title.setAttribute('role', 'button');
        title.setAttribute('tabindex', '0');
        const toggle = () => {
            const open = day.classList.toggle('is-open');
            title.setAttribute('aria-expanded', String(open));
        };
        if (idx === 0) day.classList.add('is-open');
        title.setAttribute('aria-expanded', String(idx === 0));
        title.addEventListener('click', toggle);
        title.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    });

    // "Register your interest" form -> /api/interest
    const interestForm = document.getElementById('interestForm');
    if (interestForm) {
        const status = interestForm.querySelector('.interest-status');
        const submitBtn = interestForm.querySelector('button[type="submit"]');
        interestForm.addEventListener('submit', async e => {
            e.preventDefault();
            const fd = new FormData(interestForm);
            const payload = Object.fromEntries(fd.entries());
            if (!String(payload.name || '').trim()) { status.textContent = 'Please enter your name.'; status.className = 'interest-status error'; return; }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(payload.email || '').trim())) { status.textContent = 'Please enter a valid email address.'; status.className = 'interest-status error'; return; }
            submitBtn.disabled = true;
            status.textContent = 'Sending …';
            status.className = 'interest-status';
            try {
                const res = await fetch('/api/interest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(body.error || 'Something went wrong.');
                interestForm.reset();
                status.textContent = 'Thank you! You are on the list. We will write to you as soon as the dates are set.';
                status.className = 'interest-status ok';
            } catch (err) {
                status.textContent = err.message + ' You can also email us at admin@erdkinder-bali.com.';
                status.className = 'interest-status error';
            } finally {
                submitBtn.disabled = false;
            }
        });
    }


    // Mobile nav
    const mobileToggle = document.getElementById('mobileToggle');
    const mobileMenu   = document.getElementById('mobileMenu');
    const mobileOverlay = document.getElementById('mobileOverlay');
    function openMobileMenu() { mobileMenu.classList.add('open'); mobileToggle.classList.add('open'); mobileMenu.setAttribute('aria-hidden','false'); document.body.style.overflow = 'hidden'; }
    function closeMobileMenu() { mobileMenu.classList.remove('open'); mobileToggle.classList.remove('open'); mobileMenu.setAttribute('aria-hidden','true'); document.body.style.overflow = ''; }
    mobileToggle.addEventListener('click', () => mobileMenu.classList.contains('open') ? closeMobileMenu() : openMobileMenu());
    mobileOverlay.addEventListener('click', closeMobileMenu);
    mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobileMenu));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });

    // Room photo carousels
    document.querySelectorAll('.room-carousel').forEach(carousel => {
        const slides = JSON.parse(carousel.dataset.slides);
        const img    = carousel.querySelector('.room-gallery-main');
        const dots   = carousel.querySelectorAll('.carousel-dot');
        let current  = 0;
        function goTo(i) {
            current = (i + slides.length) % slides.length;
            img.src = slides[current];
            dots.forEach((d, idx) => d.classList.toggle('active', idx === current));
        }
        carousel.querySelector('.carousel-prev').addEventListener('click', e => { e.stopPropagation(); goTo(current - 1); });
        carousel.querySelector('.carousel-next').addEventListener('click', e => { e.stopPropagation(); goTo(current + 1); });
        dots.forEach((d, i) => d.addEventListener('click', e => { e.stopPropagation(); goTo(i); }));
    });


(function () {
    var audio     = document.getElementById('bg-audio');
    var btn       = document.getElementById('audio-btn');
    var iconMuted = document.getElementById('icon-muted');
    var iconOn    = document.getElementById('icon-playing');

    audio.volume = 0.6;

    function setUI(on) {
        btn.classList.toggle('is-playing', on);
        iconMuted.style.display = on ? 'none'  : 'block';
        iconOn.style.display    = on ? 'block' : 'none';
        btn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
    }

    btn.addEventListener('click', function () {
        if (audio.paused) {
            audio.play();
            setUI(true);
        } else {
            audio.pause();
            setUI(false);
        }
    });
}());
