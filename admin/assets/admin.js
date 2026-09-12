/* Admin panel for Paititi Retreats. Talks to /admin/api/*. No framework. */
(function () {
    'use strict';

    // Section name (part before the first dot in a key) -> label shown in the panel
    const SECTION_LABELS = {
        meta: 'Seitentitel (Browser-Tab)',
        brand: 'Logo',
        hero: 'Startbereich (Hero)',
        about: 'Über uns — "Our Story"',
        experience: 'The Retreat Experience',
        accommodation: 'Unterkunft — "The Sacred Sanctuary"',
        guides: 'The Sacred Guides',
        practices: 'Sacred Practices',
        program: 'Programm (Tag 1–8)',
        gallery: 'Galerie — "A Glimpse Within"',
        inclusions: 'Inklusivleistungen & Early Bird',
        rooms: 'Zimmer & Preise',
        payment: 'Zahlung & Bankverbindung',
        location: 'Location',
        faq: 'FAQ',
        footer: 'Footer',
        booking: 'Buchungsseite (booking.html)',
        privacy: 'Datenschutz (privacy-policy.html)',
    };

    // Field words -> German labels
    const FIELD_WORDS = {
        title: 'Titel', heading: 'Überschrift', subtitle: 'Untertitel', label: 'Kleine Überschrift',
        intro: 'Einleitung', text: 'Text', description: 'Beschreibung', button: 'Button',
        name: 'Name', role: 'Rolle', bio: 'Biografie', tag: 'Etikett', image: 'Bild',
        question: 'Frage', answer: 'Antwort', number: 'Zahl', stat: 'Kennzahl',
        card: 'Karte', item: 'Eintrag', guide: 'Guide', day: 'Tag', date: 'Datum', room: 'Zimmer',
        price: 'Preis', pricenote: 'Preis-Hinweis (EUR/USD)', regular: 'Regulärer Preis', saving: 'Ersparnis',
        subheading: 'Unterzeile', earlybird: 'Early-Bird-Hinweis', pricingnote: 'Hinweis zu den Preisen',
        depositnote: 'Hinweis zur Anzahlung', bankdetails: 'Bankverbindung', dates: 'Termin',
        airport: 'Flughafen', copyright: 'Copyright', organiser: 'Veranstalter', logo: 'Logo',
        include: 'Inklusivleistung', consent: 'Zustimmung', submitbutton: 'Absende-Button',
        formheading: 'Formular-Überschrift', formintro: 'Formular-Einleitung', successintro: 'Text nach dem Absenden',
        earlybirdnote: 'Early-Bird-Hinweis', section: 'Abschnitt', meta: 'Kopfzeile', note: 'Hinweis',
        contactlabel: 'Kontakt-Label', disclaimer: 'Wichtige Hinweise',
    };

    const PAGE_LABELS = { 'index.html': 'Startseite', 'booking.html': 'Buchungsseite', 'privacy-policy.html': 'Datenschutz' };

    const app = document.getElementById('app');
    const savebar = document.getElementById('savebar');
    const savebarText = document.getElementById('savebar-text');
    const toastEl = document.getElementById('toast');

    let data = null;             // { texts: [...], images: [...] }
    const dirty = new Map();     // key -> new value (unsaved)

    // ------------------------------------------------------------ helpers

    async function api(url, options) {
        const res = await fetch(url, Object.assign({ credentials: 'same-origin' }, options));
        if (res.status === 401) { window.location.href = '/admin/login'; throw new Error('Nicht angemeldet.'); }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Unbekannter Fehler.');
        return body;
    }

    function el(tag, attrs, children) {
        const node = document.createElement(tag);
        if (attrs) for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') node.className = v;
            else if (k === 'text') node.textContent = v;
            else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
            else if (v !== null && v !== undefined && v !== false) node.setAttribute(k, v === true ? '' : v);
        }
        if (children) for (const c of [].concat(children)) if (c !== null && c !== undefined) node.append(c);
        return node;
    }

    let toastTimer = null;
    function toast(message, kind) {
        toastEl.textContent = message;
        toastEl.className = 'toast ' + (kind || '');
        toastEl.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3500);
    }

    function sectionOf(key) { return key.split('.')[0]; }
    function sectionLabel(section) { return SECTION_LABELS[section] || humanize(section); }
    function humanize(word) {
        return word.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
    }
    function fieldLabel(key) {
        return key.split('.').slice(1).map(part => {
            const m = /^([a-zA-Z]+)(\d+)$/.exec(part);
            const word = m ? m[1] : part;
            const label = FIELD_WORDS[word.toLowerCase()] || humanize(word);
            return m ? label + ' ' + m[2] : label;
        }).join(' › ');
    }
    function currentValue(t) { return t.value !== null && t.value !== undefined ? t.value : t.default; }

    function groupBySection(items) {
        const groups = new Map();
        for (const item of items) {
            const s = sectionOf(item.key);
            if (!groups.has(s)) groups.set(s, []);
            groups.get(s).push(item);
        }
        return groups;
    }

    function imageUrl(relativePath) { return '/' + encodeURI(relativePath); }

    // ------------------------------------------------------------ routing

    function route() {
        const hash = window.location.hash.replace(/^#/, '') || 'dashboard';
        const [view, target] = hash.split('/');
        document.querySelectorAll('.topnav a[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === view));
        if (view === 'texte') renderTexts(target);
        else if (view === 'bilder') renderImages();
        else renderDashboard();
        window.scrollTo(0, 0);
        if (target) {
            const node = document.getElementById('sec-' + target);
            if (node) node.scrollIntoView();
        }
    }

    // ------------------------------------------------------------ dashboard

    function renderDashboard() {
        const changedTexts = data.texts.filter(t => t.value !== null).length;
        const changedImages = data.images.filter(i => i.value !== null).length;
        const sections = [...groupBySection(data.texts).keys()];

        app.replaceChildren(
            el('div', { class: 'page-title' }, [el('h1', { text: 'Dashboard' })]),
            el('div', { class: 'grid' }, [
                el('a', { class: 'card stat', href: '#texte' }, [
                    el('div', { class: 'num', text: String(data.texts.length) }),
                    el('div', { class: 'lbl', text: 'Texte · ' + changedTexts + ' geändert' }),
                ]),
                el('a', { class: 'card stat', href: '#bilder' }, [
                    el('div', { class: 'num', text: String(data.images.length) }),
                    el('div', { class: 'lbl', text: 'Bilder · ' + changedImages + ' ersetzt' }),
                ]),
                el('a', { class: 'card stat', href: '/', target: '_blank', rel: 'noopener' }, [
                    el('div', { class: 'num', text: '↗' }),
                    el('div', { class: 'lbl', text: 'Website in neuem Tab öffnen' }),
                ]),
            ]),
            el('div', { class: 'card' }, [
                el('h2', { text: 'Texte nach Bereich' }),
                el('p', { class: 'muted small', text: 'Direkt zu einem Bereich der Website springen.' }),
                el('div', { class: 'chips' }, sections.map(s => el('a', { class: 'chip', href: '#texte/' + s, text: sectionLabel(s) }))),
            ]),
            el('div', { class: 'card' }, [
                el('h2', { text: 'So funktioniert es' }),
                el('ul', { class: 'small' }, [
                    el('li', { text: 'Unter „Texte“ jeden Text direkt bearbeiten und unten rechts auf „Speichern“ klicken. Die Änderung ist sofort auf der Website sichtbar.' }),
                    el('li', { text: 'Unter „Bilder“ ein Bild über „Bild ersetzen“ austauschen (JPG, PNG, WEBP oder GIF, max. 8 MB).' }),
                    el('li', { text: '„Original wiederherstellen“ setzt einen Text oder ein Bild auf den ursprünglichen Stand der Website zurück.' }),
                ]),
            ])
        );
    }

    // ------------------------------------------------------------ texts

    function renderTexts() {
        const groups = groupBySection(data.texts);
        const nodes = [el('div', { class: 'page-title' }, [
            el('h1', { text: 'Texte bearbeiten' }),
            el('span', { class: 'muted small', text: data.texts.length + ' Texte' }),
        ])];

        nodes.push(el('div', { class: 'hint' }, [
            'Formatierung: ', el('code', { text: '*kursiv*' }), ' · ', el('code', { text: '**fett**' }), ' · ',
            el('code', { text: '[Linktext](https://…)' }), ' · Zeilenumbruch = Enter. HTML wird nicht ausgeführt.',
        ]));

        for (const [section, items] of groups) {
            const card = el('section', { class: 'card', id: 'sec-' + section });
            card.append(el('div', { class: 'card-head' }, [
                el('h2', { text: sectionLabel(section) }),
                el('span', { class: 'muted small', text: PAGE_LABELS[items[0].page] || items[0].page }),
            ]));
            for (const t of items) card.append(textField(t));
            nodes.push(card);
        }
        app.replaceChildren(...nodes);
    }

    function textField(t) {
        const value = dirty.has(t.key) ? dirty.get(t.key) : currentValue(t);
        const wrap = el('div', { class: 'field', 'data-key': t.key });
        const ta = el('textarea', { id: 'f-' + t.key, spellcheck: 'true' });
        ta.value = value;
        const badge = el('span', { class: 'badge', text: 'Geändert', hidden: t.value === null });
        const dirtyBadge = el('span', { class: 'badge badge-dirty', text: 'Nicht gespeichert', hidden: !dirty.has(t.key) });
        const resetBtn = el('button', { class: 'btn-link', type: 'button', text: 'Original wiederherstellen', hidden: value === t.default,
            onclick: () => { ta.value = t.default; ta.dispatchEvent(new Event('input')); } });

        function autosize() { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; }
        ta.addEventListener('input', () => {
            autosize();
            const v = ta.value;
            if (v === currentValue(t)) dirty.delete(t.key); else dirty.set(t.key, v);
            dirtyBadge.hidden = !dirty.has(t.key);
            resetBtn.hidden = v === t.default;
            wrap.classList.toggle('changed', dirty.has(t.key));
            updateSavebar();
        });

        wrap.append(
            el('div', { class: 'field-head' }, [
                el('label', { for: 'f-' + t.key, text: fieldLabel(t.key) }),
                el('span', { class: 'muted small mono', text: t.key }),
            ]),
            ta,
            el('div', { class: 'field-foot' }, [badge, dirtyBadge, resetBtn])
        );
        wrap.classList.toggle('changed', dirty.has(t.key));
        requestAnimationFrame(autosize);
        return wrap;
    }

    function updateSavebar() {
        const n = dirty.size;
        savebar.hidden = n === 0;
        savebarText.textContent = n === 1 ? '1 ungespeicherte Änderung' : n + ' ungespeicherte Änderungen';
    }

    async function saveTexts() {
        if (dirty.size === 0) return;
        const btn = document.getElementById('savebar-save');
        btn.disabled = true;
        try {
            const updates = Object.fromEntries(dirty);
            await api('/admin/api/texts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            // Update local state without re-rendering (keeps scroll position)
            for (const t of data.texts) {
                if (!dirty.has(t.key)) continue;
                const v = dirty.get(t.key).replace(/\r\n/g, '\n').trim();
                t.value = (v === '' || v === t.default) ? null : v;
                const field = document.querySelector('.field[data-key="' + CSS.escape(t.key) + '"]');
                if (field) {
                    field.classList.remove('changed');
                    field.querySelector('textarea').value = currentValue(t);
                    field.querySelector('.badge').hidden = t.value === null;
                    field.querySelector('.badge-dirty').hidden = true;
                }
            }
            dirty.clear();
            updateSavebar();
            toast('Gespeichert. Die Änderungen sind auf der Website sichtbar.', 'ok');
        } catch (err) {
            toast('Speichern fehlgeschlagen: ' + err.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    function discardTexts() {
        dirty.clear();
        updateSavebar();
        if (window.location.hash.startsWith('#texte')) renderTexts();
    }

    // ------------------------------------------------------------ images

    function renderImages() {
        const groups = groupBySection(data.images);
        const nodes = [el('div', { class: 'page-title' }, [
            el('h1', { text: 'Bilder verwalten' }),
            el('span', { class: 'muted small', text: data.images.length + ' Bilder' }),
        ])];
        nodes.push(el('div', { class: 'hint', text: 'Erlaubt sind JPG, PNG, WEBP und GIF bis 8 MB. Das neue Bild wird an derselben Stelle wie das bisherige angezeigt. Tipp: ähnliche Seitenverhältnisse wie das Original verwenden.' }));

        for (const [section, items] of groups) {
            const card = el('section', { class: 'card', id: 'sec-' + section });
            card.append(el('div', { class: 'card-head' }, [
                el('h2', { text: sectionLabel(section) }),
                el('span', { class: 'muted small', text: PAGE_LABELS[items[0].page] || items[0].page }),
            ]));
            card.append(el('div', { class: 'img-grid' }, items.map(imageCard)));
            nodes.push(card);
        }
        app.replaceChildren(...nodes);
    }

    function imageCard(img) {
        const card = el('figure', { class: 'img-card' });
        const preview = el('img', { class: 'preview', src: imageUrl(currentValue(img)), alt: img.alt || '' });
        const badge = el('span', { class: 'badge', text: 'Ersetzt', hidden: img.value === null });
        const meta = el('div', { class: 'meta', text: currentValue(img) });
        const fileInput = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif' });
        const resetBtn = el('button', { class: 'btn btn-danger', type: 'button', text: 'Original', hidden: img.value === null, title: 'Original wiederherstellen' });

        fileInput.addEventListener('change', async () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) { toast('Die Datei ist zu groß (max. 8 MB).', 'error'); fileInput.value = ''; return; }
            card.classList.add('busy');
            try {
                const fd = new FormData();
                fd.append('image', file);
                const result = await api('/admin/api/images/' + encodeURIComponent(img.key), { method: 'POST', body: fd });
                img.value = result.value;
                preview.src = imageUrl(img.value) + '?v=' + Date.now();
                meta.textContent = img.value;
                badge.hidden = false;
                resetBtn.hidden = false;
                toast('Bild ersetzt.', 'ok');
            } catch (err) {
                toast('Upload fehlgeschlagen: ' + err.message, 'error');
            } finally {
                card.classList.remove('busy');
                fileInput.value = '';
            }
        });

        resetBtn.addEventListener('click', async () => {
            if (!window.confirm('Original-Bild wiederherstellen? Das hochgeladene Bild wird gelöscht.')) return;
            card.classList.add('busy');
            try {
                await api('/admin/api/images/' + encodeURIComponent(img.key), { method: 'DELETE' });
                img.value = null;
                preview.src = imageUrl(img.default);
                meta.textContent = img.default;
                badge.hidden = true;
                resetBtn.hidden = true;
                toast('Original wiederhergestellt.', 'ok');
            } catch (err) {
                toast('Fehler: ' + err.message, 'error');
            } finally {
                card.classList.remove('busy');
            }
        });

        card.append(
            preview,
            el('div', { class: 'title' }, [fieldLabel(img.key) + ' ', badge]),
            el('div', { class: 'muted small', text: img.alt || '' }),
            meta,
            el('div', { class: 'actions' }, [
                el('label', { class: 'btn btn-primary file-btn' }, ['Bild ersetzen', fileInput]),
                resetBtn,
            ])
        );
        return card;
    }

    // ------------------------------------------------------------ init

    document.getElementById('savebar-save').addEventListener('click', saveTexts);
    document.getElementById('savebar-discard').addEventListener('click', discardTexts);
    window.addEventListener('beforeunload', e => { if (dirty.size) { e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('hashchange', route);

    api('/admin/api/content')
        .then(result => { data = result; route(); })
        .catch(err => { app.replaceChildren(el('p', { class: 'muted', text: 'Inhalte konnten nicht geladen werden: ' + err.message })); });
})();
