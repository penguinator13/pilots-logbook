// Optional presentation layer only. Original CSS is never modified.
// Applied in <head> before paint to avoid a flash of the wrong theme.
(() => {
    const KEY = 'logbook-appearance';
    let appearance = 'cockpit';
    try { if (localStorage.getItem(KEY) === 'original') appearance = 'original'; } catch (_) {}
    document.documentElement.dataset.appearance = appearance;

    document.addEventListener('DOMContentLoaded', () => {
        const host = document.querySelector('.navbar-content') || document.querySelector('.login-card');
        if (!host) return;
        const label = document.createElement('label');
        label.className = 'appearance-control';
        label.style.cssText = 'display:inline-flex;align-items:center;gap:8px;font-size:12px;flex-shrink:0;';
        const caption = document.createElement('span');
        caption.textContent = 'Theme';
        const select = document.createElement('select');
        select.className = 'theme-switch';
        select.setAttribute('aria-label', 'Interface theme');
        select.style.cssText = 'font:inherit;min-height:44px;border-radius:6px;padding:4px 8px;cursor:pointer;';
        [['cockpit', 'Cockpit'], ['original', 'Original']].forEach(([value, text]) => {
            const option = document.createElement('option');
            option.value = value; option.textContent = text;
            select.appendChild(option);
        });
        select.value = appearance;
        select.addEventListener('change', () => {
            try { localStorage.setItem(KEY, select.value); } catch (_) {}
            // Reload so Chart.js reads the restored CSS colours as well.
            location.reload();
        });
        label.append(caption, select);
        host.appendChild(label);
    });
})();
