// ==UserScript==
// @name         Avito Tweaks
// @namespace    https://www.avito.ru/
// @version      0.1
// @description  Скрывает забронированные и просмотренные объявления, а также объявления без доставки и даже по Чёрному Списку.
// @match        https://www.avito.ru/*
// @grant        none
// @author       Black Ace
// @updateURL    https://raw.githubusercontent.com/cjblackace/avito-ad-filter/refs/heads/main/avito-ad-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/cjblackace/avito-ad-filter/refs/heads/main/avito-ad-filter.user.js
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    /*
     * =========================
     * СЕЛЕКТОРЫ
     * =========================
     */

    const REGULAR_ITEM_SELECTOR =
        '[data-marker="item"]';

    const RECOMMENDATION_ITEM_SELECTOR =
        '[data-marker="bx-recommendations-block-item"]';

    const ITEM_SELECTOR = [
        REGULAR_ITEM_SELECTOR,
        RECOMMENDATION_ITEM_SELECTOR
    ].join(', ');

    const DELIVERY_ICON_SELECTOR =
        '[data-icon-name="delivery"]';

    /*
     * =========================
     * STORAGE
     * =========================
     */

    const STORAGE_HIDE_RESERVED =
        'avitoTweaks_hideReserved';

    const STORAGE_HIDE_VIEWED =
        'avitoTweaks_hideViewed';

    const STORAGE_HIDE_NO_DELIVERY =
        'avitoTweaks_hideNoDelivery';

    const STORAGE_HIDE_BLACKLIST =
        'avitoTweaks_hideBlacklist';

    const STORAGE_BLACKLIST =
        'avitoTweaks_blacklist';

    const STORAGE_WIDGET_POSITION =
        'avitoTweaks_widgetPosition';

    const STORAGE_WIDGET_COLLAPSED =
        'avitoTweaks_widgetCollapsed';

    /*
     * =========================
     * CSS-КЛАССЫ
     * =========================
     */

    const HIDDEN_RESERVED_CLASS =
        'avito-tweaks-hidden-reserved';

    const HIDDEN_VIEWED_CLASS =
        'avito-tweaks-hidden-viewed';

    const HIDDEN_NO_DELIVERY_CLASS =
        'avito-tweaks-hidden-no-delivery';

    const HIDDEN_BLACKLIST_CLASS =
        'avito-tweaks-hidden-blacklist';

    /*
     * =========================
     * СОСТОЯНИЯ
     * =========================
     */

    let hideReserved =
        localStorage.getItem(STORAGE_HIDE_RESERVED) !== 'false';

    let hideViewed =
        localStorage.getItem(STORAGE_HIDE_VIEWED) !== 'false';

    let hideNoDelivery =
        localStorage.getItem(STORAGE_HIDE_NO_DELIVERY) === 'true';

    let hideBlacklist =
        localStorage.getItem(STORAGE_HIDE_BLACKLIST) === 'true';

    let blacklistRaw =
        localStorage.getItem(STORAGE_BLACKLIST) || '';

    let widgetCollapsed =
        localStorage.getItem(STORAGE_WIDGET_COLLAPSED) === 'true';

    let filterScheduled = false;

    /*
     * Готовый Set с никами.
     */
    let blacklistNames = new Set();

    /*
     * =========================
     * ТЕКСТ
     * =========================
     */

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /*
     * =========================
     * ЧЁРНЫЙ СПИСОК
     * =========================
     */

    function updateBlacklistNames() {
        blacklistNames = new Set(
            blacklistRaw
                .split(/[\n,;]+/)
                .map(name => normalizeText(name))
                .filter(Boolean)
        );
    }

    updateBlacklistNames();

    function isBlacklisted(item) {
        if (
            !hideBlacklist ||
            blacklistNames.size === 0
        ) {
            return false;
        }

        /*
         * Avito выводит ник продавца обычным <p>,
         * без data-marker и с динамическими CSS-классами.
         *
         * Поэтому проверяем все <p> внутри карточки
         * и ищем точное совпадение текста.
         */
        const paragraphs =
            item.querySelectorAll('p');

        for (const paragraph of paragraphs) {
            const text =
                normalizeText(
                    paragraph.innerText ||
                    paragraph.textContent
                );

            if (blacklistNames.has(text)) {
                return true;
            }
        }

        return false;
    }

    /*
     * =========================
     * КОНТЕЙНЕРЫ
     * =========================
     */

    function getRecommendationTarget(item) {
        return (
            item.parentElement?.parentElement ||
            item.parentElement ||
            item
        );
    }

    function getFilterTarget(item) {
        if (
            item.matches(
                RECOMMENDATION_ITEM_SELECTOR
            )
        ) {
            return getRecommendationTarget(item);
        }

        return item;
    }

    function clearFilterClasses(item) {
        const elements = [
            item,
            item.parentElement,
            item.parentElement?.parentElement
        ];

        for (const element of elements) {
            if (!(element instanceof HTMLElement)) {
                continue;
            }

            element.classList.remove(
                HIDDEN_RESERVED_CLASS,
                HIDDEN_VIEWED_CLASS,
                HIDDEN_NO_DELIVERY_CLASS,
                HIDDEN_BLACKLIST_CLASS
            );
        }
    }

    /*
     * =========================
     * ФИЛЬТРАЦИЯ
     * =========================
     */

    function filterItem(item) {
        if (!(item instanceof HTMLElement)) {
            return;
        }

        const text =
            normalizeText(
                item.innerText ||
                item.textContent
            );

        const isReserved =
            text.includes('забронировано');

        const isViewed =
            text.includes('просмотрено');

        const hasDelivery =
            item.querySelector(
                DELIVERY_ICON_SELECTOR
            ) !== null;

        const noDelivery =
            !hasDelivery;

        const blacklisted =
            isBlacklisted(item);

        const target =
            getFilterTarget(item);

        clearFilterClasses(item);

        target.classList.toggle(
            HIDDEN_RESERVED_CLASS,
            hideReserved && isReserved
        );

        target.classList.toggle(
            HIDDEN_VIEWED_CLASS,
            hideViewed && isViewed
        );

        target.classList.toggle(
            HIDDEN_NO_DELIVERY_CLASS,
            hideNoDelivery && noDelivery
        );

        target.classList.toggle(
            HIDDEN_BLACKLIST_CLASS,
            blacklisted
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

    /*
     * =========================
     * CSS
     * =========================
     */

    function addStyles() {
        if (
            document.getElementById(
                'avito-tweaks-styles'
            )
        ) {
            return;
        }

        const style =
            document.createElement('style');

        style.id =
            'avito-tweaks-styles';

        style.textContent = `
            .${HIDDEN_RESERVED_CLASS},
            .${HIDDEN_VIEWED_CLASS},
            .${HIDDEN_NO_DELIVERY_CLASS},
            .${HIDDEN_BLACKLIST_CLASS} {
                display: none !important;
            }

            #avito-tweaks-widget {
                position: fixed;
                right: 20px;
                bottom: 20px;
                z-index: 2147483647;

                width: 245px;
                overflow: hidden;

                color: #fff;

                background:
                    rgba(25, 25, 28, 0.82);

                border:
                    1px solid rgba(255, 255, 255, 0.18);

                border-radius: 14px;

                box-shadow:
                    0 8px 30px rgba(0, 0, 0, 0.30);

                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 14px;
                line-height: 1.3;

                user-select: none;
            }

            #avito-tweaks-widget * {
                box-sizing: border-box;
            }

            #avito-tweaks-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                padding: 11px 11px 11px 15px;

                background:
                    rgba(255, 255, 255, 0.08);

                border-bottom:
                    1px solid rgba(255, 255, 255, 0.12);

                cursor: move;
                touch-action: none;
            }

            #avito-tweaks-header-left {
                display: flex;
                align-items: center;
            }

            #avito-tweaks-header-left::after {
                content: "⠿";

                margin-left: 8px;

                color:
                    rgba(255, 255, 255, 0.38);

                font-size: 17px;
            }

            #avito-tweaks-title {
                font-size: 16px;
                font-weight: 700;
                letter-spacing: 0.2px;
            }

            #avito-tweaks-collapse {
                display: flex;
                align-items: center;
                justify-content: center;

                width: 28px;
                height: 24px;

                margin-left: 8px;
                padding: 0;

                border: 0;
                border-radius: 6px;

                color: #fff;

                background:
                    rgba(255, 255, 255, 0.08);

                font-size: 18px;
                font-weight: 700;

                cursor: pointer;

                transition:
                    background 0.15s ease,
                    transform 0.15s ease;
            }

            #avito-tweaks-collapse:hover {
                background:
                    rgba(255, 255, 255, 0.17);
            }

            #avito-tweaks-collapse:active {
                transform: scale(0.94);
            }

            #avito-tweaks-body {
                padding: 12px 15px 15px;

                max-height: 430px;
                opacity: 1;

                transition:
                    max-height 0.20s ease,
                    opacity 0.15s ease,
                    padding 0.20s ease;
            }

            #avito-tweaks-widget.avito-tweaks-collapsed
            #avito-tweaks-body {
                max-height: 0;
                opacity: 0;

                padding-top: 0;
                padding-bottom: 0;

                pointer-events: none;
            }

            #avito-tweaks-widget.avito-tweaks-collapsed
            #avito-tweaks-header {
                border-bottom-color: transparent;
            }

            #avito-tweaks-subtitle {
                margin-bottom: 8px;

                color:
                    rgba(255, 255, 255, 0.60);

                font-size: 12px;
                font-weight: 600;

                text-transform: uppercase;
                letter-spacing: 0.7px;
            }

            .avito-tweaks-row {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 12px;

                min-height: 34px;
            }

            .avito-tweaks-row
            + .avito-tweaks-row {
                margin-top: 5px;
            }

            .avito-tweaks-switch {
                position: relative;

                display: inline-block;
                flex: 0 0 auto;

                width: 42px;
                height: 24px;
            }

            .avito-tweaks-switch input {
                position: absolute;

                width: 1px;
                height: 1px;

                opacity: 0;
                pointer-events: none;
            }

            .avito-tweaks-slider {
                position: absolute;
                inset: 0;

                cursor: pointer;

                background:
                    rgba(255, 255, 255, 0.24);

                border-radius: 999px;

                transition:
                    background 0.18s ease,
                    box-shadow 0.18s ease;
            }

            .avito-tweaks-slider::before {
                content: "";

                position: absolute;

                left: 3px;
                bottom: 3px;

                width: 18px;
                height: 18px;

                background: #fff;
                border-radius: 50%;

                box-shadow:
                    0 1px 4px rgba(0, 0, 0, 0.30);

                transition:
                    transform 0.18s ease;
            }

            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider {
                background: #00aaff;

                box-shadow:
                    0 0 0 1px
                    rgba(0, 170, 255, 0.25);
            }

            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider::before {
                transform:
                    translateX(18px);
            }

            .avito-tweaks-separator {
                height: 1px;

                margin: 10px 0;

                background:
                    rgba(255, 255, 255, 0.10);
            }

            #avito-tweaks-blacklist-area {
                margin-top: 7px;
            }

            #avito-tweaks-blacklist-input {
                display: block;

                width: 100%;
                height: 58px;

                margin-top: 6px;
                padding: 7px 8px;

                resize: vertical;

                color: #fff;

                background:
                    rgba(0, 0, 0, 0.20);

                border:
                    1px solid
                    rgba(255, 255, 255, 0.15);

                border-radius: 7px;

                outline: none;

                font-family:
                    Consolas,
                    monospace;

                font-size: 11px;
                line-height: 1.35;

                user-select: text;

                transition:
                    border-color 0.15s ease,
                    background 0.15s ease;
            }

            #avito-tweaks-blacklist-input:focus {
                border-color:
                    rgba(0, 170, 255, 0.75);

                background:
                    rgba(0, 0, 0, 0.28);
            }

            #avito-tweaks-blacklist-input::placeholder {
                color:
                    rgba(255, 255, 255, 0.35);
            }

            #avito-tweaks-blacklist-hint {
                margin-top: 5px;

                color:
                    rgba(255, 255, 255, 0.40);

                font-size: 10px;
                line-height: 1.3;
            }
        `;

        document.head.appendChild(style);
    }

    /*
     * =========================
     * UI
     * =========================
     */

    function createSwitch(
        labelText,
        checked,
        onChange
    ) {
        const row =
            document.createElement('div');

        row.className =
            'avito-tweaks-row';

        const text =
            document.createElement('span');

        text.textContent =
            labelText;

        const label =
            document.createElement('label');

        label.className =
            'avito-tweaks-switch';

        const input =
            document.createElement('input');

        input.type = 'checkbox';
        input.checked = checked;

        const slider =
            document.createElement('span');

        slider.className =
            'avito-tweaks-slider';

        input.addEventListener(
            'change',
            () => {
                onChange(input.checked);
                filterAllItems();
            }
        );

        label.append(
            input,
            slider
        );

        row.append(
            text,
            label
        );

        return row;
    }

    function updateCollapsedState(
        widget,
        button
    ) {
        widget.classList.toggle(
            'avito-tweaks-collapsed',
            widgetCollapsed
        );

        button.textContent =
            widgetCollapsed
                ? '▢'
                : '_';

        button.title =
            widgetCollapsed
                ? 'Развернуть'
                : 'Свернуть';
    }

    /*
     * =========================
     * ПОЗИЦИЯ ВИДЖЕТА
     * =========================
     */

    function restoreWidgetPosition(widget) {
        try {
            const rawValue =
                localStorage.getItem(
                    STORAGE_WIDGET_POSITION
                );

            if (!rawValue) {
                return;
            }

            const saved =
                JSON.parse(rawValue);

            if (
                !Number.isFinite(saved?.left) ||
                !Number.isFinite(saved?.top)
            ) {
                return;
            }

            const maxLeft =
                Math.max(
                    0,
                    window.innerWidth -
                    widget.offsetWidth
                );

            const maxTop =
                Math.max(
                    0,
                    window.innerHeight -
                    widget.offsetHeight
                );

            widget.style.left =
                Math.min(
                    Math.max(0, saved.left),
                    maxLeft
                ) + 'px';

            widget.style.top =
                Math.min(
                    Math.max(0, saved.top),
                    maxTop
                ) + 'px';

            widget.style.right = 'auto';
            widget.style.bottom = 'auto';

        } catch (error) {
            console.warn(
                'Avito Tweaks: ошибка восстановления позиции',
                error
            );
        }
    }

    function saveWidgetPosition(widget) {
        const rect =
            widget.getBoundingClientRect();

        localStorage.setItem(
            STORAGE_WIDGET_POSITION,
            JSON.stringify({
                left:
                    Math.round(rect.left),

                top:
                    Math.round(rect.top)
            })
        );
    }

    function keepWidgetInsideWindow(widget) {
        const rect =
            widget.getBoundingClientRect();

        const maxLeft =
            Math.max(
                0,
                window.innerWidth -
                widget.offsetWidth
            );

        const maxTop =
            Math.max(
                0,
                window.innerHeight -
                widget.offsetHeight
            );

        widget.style.left =
            Math.min(
                Math.max(0, rect.left),
                maxLeft
            ) + 'px';

        widget.style.top =
            Math.min(
                Math.max(0, rect.top),
                maxTop
            ) + 'px';

        widget.style.right =
            'auto';

        widget.style.bottom =
            'auto';

        saveWidgetPosition(widget);
    }

    function makeWidgetDraggable(
        widget,
        handle,
        collapseButton
    ) {
        let dragging = false;

        let offsetX = 0;
        let offsetY = 0;

        handle.addEventListener(
            'pointerdown',
            event => {

                if (
                    event.button !== 0 ||
                    collapseButton.contains(
                        event.target
                    )
                ) {
                    return;
                }

                const rect =
                    widget.getBoundingClientRect();

                dragging = true;

                offsetX =
                    event.clientX -
                    rect.left;

                offsetY =
                    event.clientY -
                    rect.top;

                widget.style.left =
                    rect.left + 'px';

                widget.style.top =
                    rect.top + 'px';

                widget.style.right =
                    'auto';

                widget.style.bottom =
                    'auto';

                handle.setPointerCapture(
                    event.pointerId
                );

                event.preventDefault();
            }
        );

        handle.addEventListener(
            'pointermove',
            event => {

                if (!dragging) {
                    return;
                }

                const maxLeft =
                    Math.max(
                        0,
                        window.innerWidth -
                        widget.offsetWidth
                    );

                const maxTop =
                    Math.max(
                        0,
                        window.innerHeight -
                        widget.offsetHeight
                    );

                widget.style.left =
                    Math.min(
                        Math.max(
                            0,
                            event.clientX -
                            offsetX
                        ),
                        maxLeft
                    ) + 'px';

                widget.style.top =
                    Math.min(
                        Math.max(
                            0,
                            event.clientY -
                            offsetY
                        ),
                        maxTop
                    ) + 'px';
            }
        );

        function stopDragging(event) {
            if (!dragging) {
                return;
            }

            dragging = false;

            if (
                handle.hasPointerCapture(
                    event.pointerId
                )
            ) {
                handle.releasePointerCapture(
                    event.pointerId
                );
            }

            saveWidgetPosition(widget);
        }

        handle.addEventListener(
            'pointerup',
            stopDragging
        );

        handle.addEventListener(
            'pointercancel',
            stopDragging
        );

        window.addEventListener(
            'resize',
            () => {

                if (
                    widget.style.left === '' ||
                    widget.style.top === ''
                ) {
                    return;
                }

                keepWidgetInsideWindow(widget);
            }
        );
    }

    /*
     * =========================
     * СОЗДАНИЕ ВИДЖЕТА
     * =========================
     */

    function createWidget() {
        if (
            document.getElementById(
                'avito-tweaks-widget'
            )
        ) {
            return;
        }

        const widget =
            document.createElement('div');

        widget.id =
            'avito-tweaks-widget';

        /*
         * Шапка
         */
        const header =
            document.createElement('div');

        header.id =
            'avito-tweaks-header';

        const headerLeft =
            document.createElement('div');

        headerLeft.id =
            'avito-tweaks-header-left';

        const title =
            document.createElement('span');

        title.id =
            'avito-tweaks-title';

        title.textContent =
            'Avito Tweaks';

        headerLeft.appendChild(title);

        const collapseButton =
            document.createElement('button');

        collapseButton.id =
            'avito-tweaks-collapse';

        collapseButton.type =
            'button';

        /*
         * Тело
         */
        const body =
            document.createElement('div');

        body.id =
            'avito-tweaks-body';

        const subtitle =
            document.createElement('div');

        subtitle.id =
            'avito-tweaks-subtitle';

        subtitle.textContent =
            'Скрывать объявления';

        /*
         * Забронировано
         */
        const reservedSwitch =
            createSwitch(
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

        /*
         * Просмотрено
         */
        const viewedSwitch =
            createSwitch(
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

        /*
         * Без доставки
         */
        const noDeliverySwitch =
            createSwitch(
                'Без доставки',
                hideNoDelivery,
                value => {
                    hideNoDelivery = value;

                    localStorage.setItem(
                        STORAGE_HIDE_NO_DELIVERY,
                        String(value)
                    );
                }
            );

        /*
         * Разделитель
         */
        const separator =
            document.createElement('div');

        separator.className =
            'avito-tweaks-separator';

        /*
         * Чёрный список
         */
        const blacklistSwitch =
            createSwitch(
                'Чёрный список',
                hideBlacklist,
                value => {
                    hideBlacklist = value;

                    localStorage.setItem(
                        STORAGE_HIDE_BLACKLIST,
                        String(value)
                    );
                }
            );

        const blacklistArea =
            document.createElement('div');

        blacklistArea.id =
            'avito-tweaks-blacklist-area';

        const blacklistInput =
            document.createElement('textarea');

        blacklistInput.id =
            'avito-tweaks-blacklist-input';

        blacklistInput.value =
            blacklistRaw;

        blacklistInput.placeholder =
            'Impact, RetroShop, Vasya1987';

        const blacklistHint =
            document.createElement('div');

        blacklistHint.id =
            'avito-tweaks-blacklist-hint';

        blacklistHint.textContent =
            'Ники продавцов через запятую. Регистр не важен.';

        let blacklistInputTimer =
            null;

        blacklistInput.addEventListener(
            'input',
            () => {
                blacklistRaw =
                    blacklistInput.value;

                localStorage.setItem(
                    STORAGE_BLACKLIST,
                    blacklistRaw
                );

                /*
                 * Пересобираем Set только при изменении поля.
                 */
                updateBlacklistNames();

                clearTimeout(
                    blacklistInputTimer
                );

                blacklistInputTimer =
                    setTimeout(
                        filterAllItems,
                        250
                    );
            }
        );

        blacklistInput.addEventListener(
            'pointerdown',
            event => {
                event.stopPropagation();
            }
        );

        blacklistArea.append(
            blacklistInput,
            blacklistHint
        );

        body.append(
            subtitle,
            reservedSwitch,
            viewedSwitch,
            noDeliverySwitch,
            separator,
            blacklistSwitch,
            blacklistArea
        );

        header.append(
            headerLeft,
            collapseButton
        );

        widget.append(
            header,
            body
        );

        document.body.appendChild(widget);

        /*
         * Свернуть / развернуть
         */
        updateCollapsedState(
            widget,
            collapseButton
        );

        collapseButton.addEventListener(
            'click',
            event => {

                event.stopPropagation();

                widgetCollapsed =
                    !widgetCollapsed;

                localStorage.setItem(
                    STORAGE_WIDGET_COLLAPSED,
                    String(widgetCollapsed)
                );

                updateCollapsedState(
                    widget,
                    collapseButton
                );

                requestAnimationFrame(() => {
                    if (
                        widget.style.left !== '' &&
                        widget.style.top !== ''
                    ) {
                        keepWidgetInsideWindow(
                            widget
                        );
                    }
                });
            }
        );

        restoreWidgetPosition(widget);

        makeWidgetDraggable(
            widget,
            header,
            collapseButton
        );
    }

    /*
     * =========================
     * OBSERVER
     * =========================
     */

    function startObserver() {
        const observer =
            new MutationObserver(
                mutations => {

                    for (const mutation of mutations) {

                        const targetElement =
                            mutation.target.nodeType ===
                            Node.TEXT_NODE
                                ? mutation.target.parentElement
                                : mutation.target;

                        /*
                         * Изменения собственного виджета
                         * фильтрацию не запускают.
                         */
                        if (
                            targetElement instanceof Element &&
                            targetElement.closest(
                                '#avito-tweaks-widget'
                            )
                        ) {
                            continue;
                        }

                        scheduleFilter();
                        break;
                    }
                }
            );

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,

                attributeFilter: [
                    'data-icon-name',
                    'data-marker',
                    'href'
                ]
            }
        );
    }

    /*
     * =========================
     * START
     * =========================
     */

    function start() {
        if (
            !document.body ||
            !document.head
        ) {
            requestAnimationFrame(start);
            return;
        }

        addStyles();
        createWidget();

        filterAllItems();
        startObserver();
    }

    start();

})();
