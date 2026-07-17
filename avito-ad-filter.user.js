// ==UserScript==
// @name         Avito — фильтр объявлений
// @namespace    https://www.avito.ru/
// @version      2.1
// @description  Скрывает забронированные и просмотренные объявления
// @match        https://www.avito.ru/*
// @grant        none
// @author       Black Ace
// @updateURL    https://raw.githubusercontent.com/cjblackace/avito-ad-filter/refs/heads/main/avito-ad-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/cjblackace/avito-ad-filter/refs/heads/main/avito-ad-filter.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const ITEM_SELECTOR = //дата-маркеры для скрытия
    '[data-marker="item"], ' +
    '[data-marker="bx-recommendations-block-item"]';

    const STORAGE_HIDE_RESERVED = 'avitoFilter_hideReserved';
    const STORAGE_HIDE_VIEWED = 'avitoFilter_hideViewed';
    const STORAGE_WIDGET_POSITION = 'avitoFilter_widgetPosition';

    const HIDDEN_RESERVED_CLASS = 'avito-filter-hidden-reserved';
    const HIDDEN_VIEWED_CLASS = 'avito-filter-hidden-viewed';

    /*
     * Переключатель включён — объявления скрываются.
     * По умолчанию оба фильтра включены.
     */
    let hideReserved =
        localStorage.getItem(STORAGE_HIDE_RESERVED) !== 'false';

    let hideViewed =
        localStorage.getItem(STORAGE_HIDE_VIEWED) !== 'false';

    let filterScheduled = false;

    function normalizeText(text) {
        return text
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function filterItem(item) {
        if (!(item instanceof HTMLElement)) {
            return;
        }

        const text = normalizeText(
            item.innerText || item.textContent || ''
        );

        const isReserved = text.includes('забронировано');
        const isViewed = text.includes('просмотрено');

        item.classList.toggle(
            HIDDEN_RESERVED_CLASS,
            hideReserved && isReserved
        );

        item.classList.toggle(
            HIDDEN_VIEWED_CLASS,
            hideViewed && isViewed
        );
    }

    function filterAllItems() {
        document
            .querySelectorAll(ITEM_SELECTOR)
            .forEach(filterItem);
    }

    function scheduleFilter() {
        if (filterScheduled) {
            return;
        }

        filterScheduled = true;

        requestAnimationFrame(() => {
            filterScheduled = false;
            filterAllItems();
        });
    }

    function addStyles() {
        if (document.getElementById('avito-filter-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'avito-filter-styles';

        style.textContent = `
            .${HIDDEN_RESERVED_CLASS},
            .${HIDDEN_VIEWED_CLASS} {
                display: none !important;
            }

            #avito-filter-widget {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 2147483647;

                width: 220px;
                overflow: hidden;

                color: #ffffff;
                background: rgba(25, 25, 28, 0.78);
                border: 1px solid rgba(255, 255, 255, 0.18);
                border-radius: 14px;
                box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);

                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);

                font-family: Arial, Helvetica, sans-serif;
                font-size: 14px;
                line-height: 1.3;

                user-select: none;
            }

            #avito-filter-widget * {
                box-sizing: border-box;
            }

            #avito-filter-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                padding: 12px 15px;

                background: rgba(255, 255, 255, 0.08);
                border-bottom: 1px solid rgba(255, 255, 255, 0.12);

                font-size: 15px;
                font-weight: 700;

                cursor: move;
                touch-action: none;
            }

            #avito-filter-header::after {
                content: "⠿";
                margin-left: 10px;

                color: rgba(255, 255, 255, 0.55);
                font-size: 18px;
                line-height: 1;
            }

            #avito-filter-body {
                padding: 11px 15px 14px;
            }

            .avito-filter-row {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;

                min-height: 34px;
            }

            .avito-filter-row + .avito-filter-row {
                margin-top: 6px;
            }

            .avito-filter-switch {
                position: relative;
                display: inline-block;
                flex: 0 0 auto;

                width: 42px;
                height: 24px;
            }

            .avito-filter-switch input {
                width: 0;
                height: 0;
                opacity: 0;
            }

            .avito-filter-slider {
                position: absolute;
                inset: 0;

                cursor: pointer;
                background: rgba(255, 255, 255, 0.24);
                border-radius: 999px;

                transition:
                    background 0.18s ease,
                    box-shadow 0.18s ease;
            }

            .avito-filter-slider::before {
                content: "";
                position: absolute;
                left: 3px;
                bottom: 3px;

                width: 18px;
                height: 18px;

                background: #ffffff;
                border-radius: 50%;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);

                transition: transform 0.18s ease;
            }

            .avito-filter-switch input:checked
            + .avito-filter-slider {
                background: #00aaff;
                box-shadow:
                    0 0 0 1px rgba(0, 170, 255, 0.25);
            }

            .avito-filter-switch input:checked
            + .avito-filter-slider::before {
                transform: translateX(18px);
            }

            .avito-filter-switch input:focus-visible
            + .avito-filter-slider {
                outline: 2px solid #ffffff;
                outline-offset: 2px;
            }
        `;

        document.head.appendChild(style);
    }

    function createSwitch(labelText, checked, onChange) {
        const row = document.createElement('div');
        row.className = 'avito-filter-row';

        const text = document.createElement('span');
        text.textContent = labelText;

        const label = document.createElement('label');
        label.className = 'avito-filter-switch';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = checked;
        input.setAttribute('aria-label', labelText);

        const slider = document.createElement('span');
        slider.className = 'avito-filter-slider';

        input.addEventListener('change', () => {
            onChange(input.checked);
            filterAllItems();
        });

        label.append(input, slider);
        row.append(text, label);

        return row;
    }

    function restoreWidgetPosition(widget) {
        try {
            const saved = JSON.parse(
                localStorage.getItem(STORAGE_WIDGET_POSITION)
            );

            if (
                !saved ||
                !Number.isFinite(saved.left) ||
                !Number.isFinite(saved.top)
            ) {
                return;
            }

            const maxLeft = Math.max(
                0,
                window.innerWidth - widget.offsetWidth
            );

            const maxTop = Math.max(
                0,
                window.innerHeight - widget.offsetHeight
            );

            widget.style.left =
                Math.min(Math.max(0, saved.left), maxLeft) + 'px';

            widget.style.top =
                Math.min(Math.max(0, saved.top), maxTop) + 'px';

            widget.style.right = 'auto';
            widget.style.bottom = 'auto';
        } catch (error) {
            console.warn(
                'Не удалось восстановить положение виджета:',
                error
            );
        }
    }

    function saveWidgetPosition(widget) {
        const rect = widget.getBoundingClientRect();

        localStorage.setItem(
            STORAGE_WIDGET_POSITION,
            JSON.stringify({
                left: Math.round(rect.left),
                top: Math.round(rect.top)
            })
        );
    }

    function makeWidgetDraggable(widget, handle) {
        let dragging = false;
        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener('pointerdown', event => {
            if (event.button !== 0) {
                return;
            }

            const rect = widget.getBoundingClientRect();

            dragging = true;
            offsetX = event.clientX - rect.left;
            offsetY = event.clientY - rect.top;

            /*
             * Переводим положение из right/bottom в left/top.
             */
            widget.style.left = rect.left + 'px';
            widget.style.top = rect.top + 'px';
            widget.style.right = 'auto';
            widget.style.bottom = 'auto';

            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });

        handle.addEventListener('pointermove', event => {
            if (!dragging) {
                return;
            }

            const maxLeft = Math.max(
                0,
                window.innerWidth - widget.offsetWidth
            );

            const maxTop = Math.max(
                0,
                window.innerHeight - widget.offsetHeight
            );

            const left = Math.min(
                Math.max(0, event.clientX - offsetX),
                maxLeft
            );

            const top = Math.min(
                Math.max(0, event.clientY - offsetY),
                maxTop
            );

            widget.style.left = left + 'px';
            widget.style.top = top + 'px';
        });

        function stopDragging(event) {
            if (!dragging) {
                return;
            }

            dragging = false;

            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }

            saveWidgetPosition(widget);
        }

        handle.addEventListener('pointerup', stopDragging);
        handle.addEventListener('pointercancel', stopDragging);

        /*
         * После изменения размера окна удерживаем виджет
         * в пределах видимой части страницы.
         */
        window.addEventListener('resize', () => {
            const rect = widget.getBoundingClientRect();

            if (
                widget.style.left === '' ||
                widget.style.top === ''
            ) {
                return;
            }

            const maxLeft = Math.max(
                0,
                window.innerWidth - widget.offsetWidth
            );

            const maxTop = Math.max(
                0,
                window.innerHeight - widget.offsetHeight
            );

            widget.style.left =
                Math.min(Math.max(0, rect.left), maxLeft) + 'px';

            widget.style.top =
                Math.min(Math.max(0, rect.top), maxTop) + 'px';

            saveWidgetPosition(widget);
        });
    }

    function createWidget() {
        if (document.getElementById('avito-filter-widget')) {
            return;
        }

        const widget = document.createElement('div');
        widget.id = 'avito-filter-widget';

        const header = document.createElement('div');
        header.id = 'avito-filter-header';
        header.textContent = 'Скрывать объявления';

        const body = document.createElement('div');
        body.id = 'avito-filter-body';

        const reservedSwitch = createSwitch(
            'Забронировано',
            hideReserved,
            value => {
                hideReserved = value;

                localStorage.setItem(
                    STORAGE_HIDE_RESERVED,
                    String(value)
                );
            }
        );

        const viewedSwitch = createSwitch(
            'Просмотрено',
            hideViewed,
            value => {
                hideViewed = value;

                localStorage.setItem(
                    STORAGE_HIDE_VIEWED,
                    String(value)
                );
            }
        );

        body.append(reservedSwitch, viewedSwitch);
        widget.append(header, body);

        document.body.appendChild(widget);

        restoreWidgetPosition(widget);
        makeWidgetDraggable(widget, header);
    }

    function start() {
        if (!document.body || !document.head) {
            requestAnimationFrame(start);
            return;
        }

        addStyles();
        createWidget();
        filterAllItems();

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                if (
                    mutation.type === 'childList' ||
                    mutation.type === 'characterData'
                ) {
                    scheduleFilter();
                    break;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    start();
})();
