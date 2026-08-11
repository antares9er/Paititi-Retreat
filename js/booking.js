    // ─── PAYMENT LINKS (PayPal & Wise) ──────────────────────────────────────
    // PayPal: paypal.com/invoice/create  OR  paypal.me/YourName/416EUR
    // Wise:   wise.com → Send & receive → Payment links
    // Create one link per room × method × deposit/full (12 links total)
    // Replace each placeholder below with the actual URL
    // ─────────────────────────────────────────────────────────────────────────
    const PAYMENT = {
        bamboo: {
            paypal: {
                deposit: 'https://paypal.me/PaititiRetreats/416EUR',
                full:    'https://paypal.me/PaititiRetreats/1385EUR',
            },
        },
        ensuite: {
            paypal: {
                deposit: 'https://paypal.me/PaititiRetreats/516EUR',
                full:    'https://paypal.me/PaititiRetreats/1720EUR',
            },
        },
        retreat: {
            paypal: {
                deposit: 'https://paypal.me/PaititiRetreats/342EUR',
                full:    'https://paypal.me/PaititiRetreats/1140EUR',
            },
        },
    };

    const rooms = {
        bamboo: {
            name:     'Private Open Bamboo Room',
            img:      'Open-bamboo-rooms/open-bamboo.jpg',
            desc:     'A private bamboo sky suite open to the lush jungle breeze and birdsong. Crafted from natural materials with sacred geometry, these serene rooms offer a grounded, deeply restful space between ceremonies. Shared bathrooms are steps away, thoughtfully maintained.',
            amenities: ['Private Room', '7 Nights', 'Jungle View', 'Shared Bathroom', '3 Meals Daily'],
            price:    'IDR 24,210,000',
            eur:      'approx. €1,385 · $1,515',
            regular:  'IDR 27,900,000',
            saving:   'Save IDR 3,690,000',
            select:   'Open Bamboo Room — IDR 24,210,000 (Early Bird)',
            depositAll: '€416 · $455 · IDR 7,263,000',
            fullAll:    '€1,385 · $1,515 · IDR 24,210,000',
        },
        ensuite: {
            name:     'Private Luxury Ensuite Room',
            img:      'Luxury ensuite room/luxury room.jpeg',
            desc:     'An elevated private sanctuary with your own ensuite bathroom — the pinnacle of comfort within the eco-village. Beautifully appointed with natural finishes, these rooms offer complete privacy and a seamless connection to the surrounding jungle.',
            amenities: ['Private Room', '7 Nights', 'Ensuite Bathroom', 'Jungle View', '3 Meals Daily'],
            price:    'IDR 30,032,100',
            eur:      'approx. €1,720 · $1,880',
            regular:  'IDR 33,369,000',
            saving:   'Save IDR 3,336,900',
            select:   'Luxury Ensuite Room — IDR 30,032,100 (Early Bird)',
            depositAll: '€516 · $564 · IDR 9,009,630',
            fullAll:    '€1,720 · $1,880 · IDR 30,032,100',
        },
        retreat: {
            name:     'Retreat Only (No Accommodation)',
            img:      'Maleika Restaurant/This picture.jpg',
            desc:     'Join the full retreat experience — all ceremonies, practices, and meals included — while arranging your own accommodation in or around Ubud. Ideal for those staying with friends, family, or in a nearby space of their choice.',
            amenities: ['Full Program', 'All Ceremonies', '3 Meals Daily', 'Own Accommodation'],
            price:    'IDR 19,980,000',
            eur:      'approx. €1,140 · $1,250',
            regular:  'IDR 22,200,000',
            saving:   'Save IDR 2,220,000',
            select:   'Retreat Only (No Accommodation) — IDR 19,980,000 (Early Bird)',
            depositAll: '€342 · $374 · IDR 5,994,000',
            fullAll:    '€1,140 · $1,250 · IDR 19,980,000',
        }
    };

    // Build reverse lookup: dropdown value → room key
    const selectToKey = {};
    Object.keys(rooms).forEach(key => { selectToKey[rooms[key].select] = key; });

    function populateSummary(room) {
        document.getElementById('summaryImg').src         = room.img;
        document.getElementById('summaryImg').alt         = room.name;
        document.getElementById('summaryName').textContent  = room.name;
        document.getElementById('summaryDesc').textContent  = room.desc;
        document.getElementById('summaryPrice').textContent = room.price;
        document.getElementById('summaryEur').textContent   = room.eur;
        document.getElementById('summaryRegular').innerHTML = 'Regular: <s>' + room.regular + '</s>';
        document.getElementById('summarySaving').textContent = room.saving;
        document.getElementById('hiddenRoom').value         = room.name;
        const amenitiesEl = document.getElementById('summaryAmenities');
        amenitiesEl.innerHTML = '';
        room.amenities.forEach(a => {
            const span = document.createElement('span');
            span.className = 'room-amenity-tag';
            span.textContent = a;
            amenitiesEl.appendChild(span);
        });
    }

    // Read ?room= param and populate on load
    const param = new URLSearchParams(window.location.search).get('room') || 'ensuite';
    populateSummary(rooms[param] || rooms.ensuite);

    // Pre-select matching option in the dropdown
    const select = document.getElementById('roomSelect');
    const initialRoom = rooms[param] || rooms.ensuite;
    for (let i = 0; i < select.options.length; i++) {
        if (select.options[i].value === initialRoom.select) { select.selectedIndex = i; break; }
    }

    // Update summary panel when room dropdown changes
    select.addEventListener('change', function() {
        const key = selectToKey[this.value];
        if (key) populateSummary(rooms[key]);
    });


    function showSuccess(email, roomKey) {
        document.getElementById('bookingForm').style.display = 'none';
        const rk = roomKey || 'bamboo';
        const room = rooms[rk];
        const links = PAYMENT[rk];
        document.getElementById('paypalDepositBtn').href = links.paypal.deposit;
        document.getElementById('paypalFullBtn').href    = links.paypal.full;
        document.querySelectorAll('#bookingSuccess .deposit-amt').forEach(el => el.textContent = room.depositAll);
        document.querySelectorAll('#bookingSuccess .full-amt').forEach(el => el.textContent = room.fullAll);
        document.getElementById('bookingSuccess').style.display = 'block';
    }

    document.getElementById('bookingForm').addEventListener('submit', async function(e) { // async kept for Formspree await
        e.preventDefault();
        const btn    = document.getElementById('submitBtn');
        const fd     = new FormData(this);
        const roomSelectVal = fd.get('Room Selection') || '';
        const roomKey = selectToKey[roomSelectVal] || 'bamboo';
        const customerData = {
            firstName: fd.get('First Name') || '',
            email:     fd.get('Email')      || '',
            room:      fd.get('Selected Room') || roomSelectVal
        };

        btn.textContent = 'Processing…';
        btn.disabled = true;

        // ── Formspree ─────────────────────────────────────────────────────────
        // 1. Sign up free at https://formspree.io
        // 2. Create a new form → copy the 8-character ID from the endpoint URL
        // 3. Replace YOUR_FORM_ID below with that ID
        // Every submission will be stored in your Formspree dashboard and
        // emailed to you at admin@erdkinder-bali.com automatically.
        // ─────────────────────────────────────────────────────────────────────
        const FORM_ID = 'mykvzqlk';

        if (FORM_ID !== 'YOUR_FORM_ID') {
            try {
                await fetch('https://formspree.io/f/' + FORM_ID, {
                    method:  'POST',
                    headers: { 'Accept': 'application/json' },
                    body:    fd
                });
            } catch(err) {
                console.warn('Formspree:', err);
            }
        }

        showSuccess(customerData.email, roomKey);
    });
