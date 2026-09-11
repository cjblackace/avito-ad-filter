// ==UserScript==
// @name         Avito Tweaks
// @namespace    https://www.avito.ru/
// @version      0.3
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

    /* =========================================================
       СЕЛЕКТОРЫ
       ========================================================= */

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

    const SELLER_LINK_SELECTOR = [
        'a[href^="/brands/"]',
        'a[href^="/user/"]',
        'a[href*="avito.ru/brands/"]',
        'a[href*="avito.ru/user/"]'
    ].join(', ');


    /* =========================================================
       КЛЮЧИ TAMPERMONKEY STORAGE
       ========================================================= */

    const KEY_HIDE_RESERVED =
        'hideReserved';

    const KEY_HIDE_VIEWED =
        'hideViewed';

    const KEY_HIDE_NO_DELIVERY =
        'hideNoDelivery';

    const KEY_HIDE_BLACKLIST =
        'hideBlacklist';

    const KEY_BLACKLIST =
        'blacklist';

    const KEY_WIDGET_POSITION =
        'widgetPosition';

    const KEY_WIDGET_COLLAPSED =
        'widgetCollapsed';

    const KEY_MIGRATED =
        'migrationV42Done';


    /* =========================================================
       СТАРЫЕ КЛЮЧИ LOCALSTORAGE
       ========================================================= */

    const OLD_KEYS = {
        hideReserved:
            'avitoTweaks_hideReserved',

        hideViewed:
            'avitoTweaks_hideViewed',

        hideNoDelivery:
            'avitoTweaks_hideNoDelivery',

        hideBlacklist:
            'avitoTweaks_hideBlacklist',

        blacklist:
            'avitoTweaks_blacklistV2',

        widgetPosition:
            'avitoTweaks_widgetPosition',

        widgetCollapsed:
            'avitoTweaks_widgetCollapsed'
    };


    /* =========================================================
       CSS-КЛАССЫ
       ========================================================= */

    const HIDDEN_RESERVED_CLASS =
        'avito-tweaks-hidden-reserved';

    const HIDDEN_VIEWED_CLASS =
        'avito-tweaks-hidden-viewed';

    const HIDDEN_NO_DELIVERY_CLASS =
        'avito-tweaks-hidden-no-delivery';

    const HIDDEN_BLACKLIST_CLASS =
        'avito-tweaks-hidden-blacklist';


    /* =========================================================
       БЕЗОПАСНЫЕ ОБЁРТКИ GM
       ========================================================= */

    function storageGet(key, defaultValue) {
        try {
            const value =
                GM_getValue(key, defaultValue);

            return value;
        } catch (error) {
            console.error(
                'Avito Tweaks: GM_getValue error:',
                key,
                error
            );

            return defaultValue;
        }
    }

    function storageSet(key, value) {
        try {
            GM_setValue(key, value);
            return true;
        } catch (error) {
            console.error(
                'Avito Tweaks: GM_setValue error:',
                key,
                error
            );

            return false;
        }
    }


    /* =========================================================
       СОСТОЯНИЕ
       ========================================================= */

    let hideReserved =
        storageGet(
            KEY_HIDE_RESERVED,
            true
        );

    let hideViewed =
        storageGet(
            KEY_HIDE_VIEWED,
            true
        );

    let hideNoDelivery =
        storageGet(
            KEY_HIDE_NO_DELIVERY,
            false
        );

    let hideBlacklist =
        storageGet(
            KEY_HIDE_BLACKLIST,
            false
        );

    let widgetCollapsed =
        storageGet(
            KEY_WIDGET_COLLAPSED,
            false
        );

    let blacklist =
        loadBlacklist();

    let refreshScheduled =
        false;


    /* =========================================================
       ОБЩИЕ ФУНКЦИИ
       ========================================================= */

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    }


    /* =========================================================
       ЧЁРНЫЙ СПИСОК
       ========================================================= */

    function loadBlacklist() {
        const value =
            storageGet(
                KEY_BLACKLIST,
                []
            );

        if (!Array.isArray(value)) {
            return [];
        }

        return value.filter(entry =>
            entry &&
            typeof entry.id === 'string' &&
            entry.id.length > 0
        );
    }

    function saveBlacklist() {
        storageSet(
            KEY_BLACKLIST,
            blacklist
        );
    }

    function isSellerBlacklisted(id) {
        return blacklist.some(
            entry =>
                entry.id === id
        );
    }

    function addSellerToBlacklist(
        id,
        name
    ) {
        if (!id) {
            return;
        }

        if (isSellerBlacklisted(id)) {
            return;
        }

        blacklist.push({
            id: id,
            name:
                normalizeText(name) ||
                id
        });

        saveBlacklist();

        renderBlacklist();
        updateSellerButtons();
        filterAllItems();
    }

    function removeSellerFromBlacklist(id) {
        blacklist =
            blacklist.filter(
                entry =>
                    entry.id !== id
            );

        saveBlacklist();

        renderBlacklist();
        updateSellerButtons();
        filterAllItems();
    }


    /* =========================================================
       ID ПРОДАВЦА ИЗ ССЫЛКИ
       ========================================================= */

    function getSellerIdFromLink(link) {
        if (!link) {
            return null;
        }

        const href =
            link.getAttribute('href');

        if (!href) {
            return null;
        }

        let url;

        try {
            url =
                new URL(
                    href,
                    location.origin
                );
        } catch {
            return null;
        }

        const path =
            url.pathname;

        /*
         * /brands/9f02...
         */
        let match =
            path.match(
                /^\/brands\/([a-zA-Z0-9]+)(?:\/|$)/
            );

        if (match) {
            return match[1];
        }

        /*
         * /user/d3b0.../profile
         */
        match =
            path.match(
                /^\/user\/([a-zA-Z0-9]+)(?:\/|$)/
            );

        if (match) {
            return match[1];
        }

        return null;
    }


    /* =========================================================
       ПОИСК ПРОДАВЦА В КАРТОЧКЕ
       ========================================================= */

    function findSellerInfo(item) {
        if (!item) {
            return null;
        }

        const links =
            item.querySelectorAll(
                SELLER_LINK_SELECTOR
            );

        for (const link of links) {
            const id =
                getSellerIdFromLink(link);

            if (!id) {
                continue;
            }

            let nameElement =
                link.querySelector('p');

            if (!nameElement) {
                nameElement =
                    link.parentElement
                        ?.querySelector('p') ||
                    null;
            }

            let name = '';

            if (nameElement) {
                name =
                    normalizeText(
                        nameElement.innerText ||
                        nameElement.textContent
                    );
            }

            if (!name) {
                name =
                    normalizeText(
                        link.innerText ||
                        link.textContent
                    );
            }

            if (!name) {
                name =
                    'Продавец ' +
                    id.slice(0, 8);
            }

            return {
                id,
                name,
                link,
                nameElement
            };
        }

        return null;
    }


    /* =========================================================
       КНОПКИ "В ЧС"
       ========================================================= */

    function addBlacklistButton(item) {
        if (!item) {
            return;
        }

        if (
            item.querySelector(
                '.avito-tweaks-add-blacklist'
            )
        ) {
            return;
        }

        const seller =
            findSellerInfo(item);

        if (!seller) {
            return;
        }

        const button =
            document.createElement('span');

        button.className =
            'avito-tweaks-add-blacklist';

        button.dataset.sellerId =
            seller.id;

        button.dataset.sellerName =
            seller.name;

        button.setAttribute(
            'role',
            'button'
        );

        button.setAttribute(
            'tabindex',
            '0'
        );

        if (seller.nameElement) {
            seller.nameElement
                .insertAdjacentElement(
                    'afterend',
                    button
                );
        } else {
            seller.link.appendChild(
                button
            );
        }

        function activate(event) {
            event.preventDefault();
            event.stopPropagation();

            if (
                typeof event.stopImmediatePropagation ===
                'function'
            ) {
                event.stopImmediatePropagation();
            }

            if (
                !isSellerBlacklisted(
                    seller.id
                )
            ) {
                addSellerToBlacklist(
                    seller.id,
                    seller.name
                );
            }

            updateSellerButton(
                button
            );
        }

        button.addEventListener(
            'click',
            activate,
            true
        );

        button.addEventListener(
            'pointerdown',
            event =>
                event.stopPropagation(),
            true
        );

        button.addEventListener(
            'keydown',
            event => {
                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {
                    activate(event);
                }
            }
        );

        updateSellerButton(
            button
        );
    }

    function updateSellerButton(button) {
        const id =
            button.dataset.sellerId;

        const blocked =
            isSellerBlacklisted(id);

        button.classList.toggle(
            'avito-tweaks-add-blacklist-active',
            blocked
        );

        button.textContent =
            blocked
                ? 'В ЧС ✓'
                : 'В ЧС';

        button.title =
            blocked
                ? 'Продавец уже в чёрном списке'
                : 'Добавить продавца в чёрный список';
    }

    function updateSellerButtons() {
        document
            .querySelectorAll(
                '.avito-tweaks-add-blacklist'
            )
            .forEach(
                updateSellerButton
            );
    }

    function addBlacklistButtonsToAllItems() {
        document
            .querySelectorAll(
                ITEM_SELECTOR
            )
            .forEach(
                addBlacklistButton
            );
    }


    /* =========================================================
       ЦЕЛЕВОЙ КОНТЕЙНЕР
       ========================================================= */

    function getFilterTarget(item) {
        if (
            item.matches(
                RECOMMENDATION_ITEM_SELECTOR
            )
        ) {
            return (
                item.parentElement
                    ?.parentElement ||
                item.parentElement ||
                item
            );
        }

        return item;
    }

    function clearFilterClasses(item) {
        const elements = [
            item,
            item.parentElement,
            item.parentElement
                ?.parentElement
        ];

        for (const element of elements) {
            if (!element) {
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


    /* =========================================================
       ФИЛЬТРАЦИЯ
       ========================================================= */

    function filterItem(item) {
        if (!item) {
            return;
        }

        const text =
            normalizeText(
                item.innerText ||
                item.textContent
            ).toLowerCase();

        const isReserved =
            text.includes(
                'забронировано'
            );

        const isViewed =
            text.includes(
                'просмотрено'
            );

        const hasDelivery =
            item.querySelector(
                DELIVERY_ICON_SELECTOR
            ) !== null;

        const seller =
            findSellerInfo(item);

        const sellerBlocked =
            seller
                ? isSellerBlacklisted(
                    seller.id
                )
                : false;

        const target =
            getFilterTarget(item);

        clearFilterClasses(
            item
        );

        target.classList.toggle(
            HIDDEN_RESERVED_CLASS,
            hideReserved &&
            isReserved
        );

        target.classList.toggle(
            HIDDEN_VIEWED_CLASS,
            hideViewed &&
            isViewed
        );

        target.classList.toggle(
            HIDDEN_NO_DELIVERY_CLASS,
            hideNoDelivery &&
            !hasDelivery
        );

        target.classList.toggle(
            HIDDEN_BLACKLIST_CLASS,
            hideBlacklist &&
            sellerBlocked
        );
    }

    function filterAllItems() {
        document
            .querySelectorAll(
                ITEM_SELECTOR
            )
            .forEach(
                filterItem
            );
    }

    function refreshAll() {
        addBlacklistButtonsToAllItems();
        filterAllItems();
    }

    function scheduleRefresh() {
        if (refreshScheduled) {
            return;
        }

        refreshScheduled =
            true;

        requestAnimationFrame(() => {
            refreshScheduled =
                false;

            refreshAll();
        });
    }


    /* =========================================================
       МИГРАЦИЯ ИЗ LOCALSTORAGE
       ========================================================= */

    function migrateOldSettings() {
        if (
            storageGet(
                KEY_MIGRATED,
                false
            )
        ) {
            return;
        }

        try {
            /*
             * Boolean helper.
             */
            function migrateBoolean(
                oldKey,
                newKey
            ) {
                const oldValue =
                    localStorage.getItem(
                        oldKey
                    );

                if (oldValue === null) {
                    return;
                }

                storageSet(
                    newKey,
                    oldValue === 'true'
                );
            }

            migrateBoolean(
                OLD_KEYS.hideReserved,
                KEY_HIDE_RESERVED
            );

            migrateBoolean(
                OLD_KEYS.hideViewed,
                KEY_HIDE_VIEWED
            );

            migrateBoolean(
                OLD_KEYS.hideNoDelivery,
                KEY_HIDE_NO_DELIVERY
            );

            migrateBoolean(
                OLD_KEYS.hideBlacklist,
                KEY_HIDE_BLACKLIST
            );

            migrateBoolean(
                OLD_KEYS.widgetCollapsed,
                KEY_WIDGET_COLLAPSED
            );


            /*
             * Старый ЧС.
             */
            const oldBlacklist =
                localStorage.getItem(
                    OLD_KEYS.blacklist
                );

            if (oldBlacklist) {
                try {
                    const parsed =
                        JSON.parse(
                            oldBlacklist
                        );

                    if (
                        Array.isArray(parsed) &&
                        blacklist.length === 0
                    ) {
                        blacklist =
                            parsed;

                        saveBlacklist();
                    }
                } catch (error) {
                    console.warn(
                        'Avito Tweaks: ошибка миграции ЧС.',
                        error
                    );
                }
            }


            /*
             * Позиция окна.
             */
            const oldPosition =
                localStorage.getItem(
                    OLD_KEYS.widgetPosition
                );

            if (oldPosition) {
                try {
                    const parsed =
                        JSON.parse(
                            oldPosition
                        );

                    if (
                        storageGet(
                            KEY_WIDGET_POSITION,
                            null
                        ) === null
                    ) {
                        storageSet(
                            KEY_WIDGET_POSITION,
                            parsed
                        );
                    }
                } catch {
                    // ничего
                }
            }

        } catch (error) {
            console.warn(
                'Avito Tweaks: миграция localStorage не удалась.',
                error
            );
        }

        storageSet(
            KEY_MIGRATED,
            true
        );

        /*
         * После миграции перечитываем значения.
         */
        hideReserved =
            storageGet(
                KEY_HIDE_RESERVED,
                hideReserved
            );

        hideViewed =
            storageGet(
                KEY_HIDE_VIEWED,
                hideViewed
            );

        hideNoDelivery =
            storageGet(
                KEY_HIDE_NO_DELIVERY,
                hideNoDelivery
            );

        hideBlacklist =
            storageGet(
                KEY_HIDE_BLACKLIST,
                hideBlacklist
            );

        widgetCollapsed =
            storageGet(
                KEY_WIDGET_COLLAPSED,
                widgetCollapsed
            );

        blacklist =
            loadBlacklist();
    }


    /* =========================================================
       CSS
       ========================================================= */

    function addStyles() {
        if (
            document.getElementById(
                'avito-tweaks-styles'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'avito-tweaks-styles';

        style.textContent = `
            .${HIDDEN_RESERVED_CLASS},
            .${HIDDEN_VIEWED_CLASS},
            .${HIDDEN_NO_DELIVERY_CLASS},
            .${HIDDEN_BLACKLIST_CLASS} {
                display: none !important;
            }

            .avito-tweaks-add-blacklist {
                display: inline-flex;
                align-items: center;

                width: max-content;

                margin-left: 7px;
                padding: 2px 6px;

                vertical-align: middle;

                color: #666;

                background:
                    rgba(0,0,0,.05);

                border:
                    1px solid
                    rgba(0,0,0,.10);

                border-radius: 5px;

                font-family:
                    Arial, sans-serif;

                font-size: 10px;
                line-height: 15px;

                cursor: pointer;
                user-select: none;
            }

            .avito-tweaks-add-blacklist:hover {
                color: #111;

                background:
                    rgba(0,0,0,.10);
            }

            .avito-tweaks-add-blacklist-active {
                color: #9b2525;

                background:
                    rgba(180,40,40,.08);

                border-color:
                    rgba(180,40,40,.18);
            }

            #avito-tweaks-widget {
                position: fixed;

                right: 20px;
                bottom: 20px;

                z-index: 2147483647;

                width: 250px;

                overflow: hidden;

                color: #fff;

                background:
                    rgba(25,25,28,.82);

                border:
                    1px solid
                    rgba(255,255,255,.18);

                border-radius: 14px;

                box-shadow:
                    0 8px 30px
                    rgba(0,0,0,.30);

                backdrop-filter:
                    blur(10px);

                -webkit-backdrop-filter:
                    blur(10px);

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 14px;

                user-select: none;
            }

            #avito-tweaks-widget * {
                box-sizing: border-box;
            }

            #avito-tweaks-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                padding:
                    11px 11px 11px 15px;

                background:
                    rgba(255,255,255,.08);

                border-bottom:
                    1px solid
                    rgba(255,255,255,.12);

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
                    rgba(255,255,255,.38);

                font-size: 17px;
            }

            #avito-tweaks-title {
                font-size: 16px;
                font-weight: 700;
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
                    rgba(255,255,255,.08);

                font-size: 18px;

                cursor: pointer;
            }

            #avito-tweaks-collapse:hover {
                background:
                    rgba(255,255,255,.17);
            }

            #avito-tweaks-body {
                padding:
                    12px 15px 15px;

                max-height: 500px;

                opacity: 1;

                transition:
                    max-height .2s ease,
                    opacity .15s ease,
                    padding .2s ease;
            }

            #avito-tweaks-widget.avito-tweaks-collapsed
            #avito-tweaks-body {
                max-height: 0;
                opacity: 0;

                padding-top: 0;
                padding-bottom: 0;

                pointer-events: none;
            }

            #avito-tweaks-subtitle {
                margin-bottom: 8px;

                color:
                    rgba(255,255,255,.60);

                font-size: 12px;

                font-weight: 600;

                text-transform:
                    uppercase;

                letter-spacing:
                    .7px;
            }

            .avito-tweaks-row {
                display: flex;
                align-items: center;
                justify-content: space-between;

                gap: 12px;

                min-height: 34px;
            }

            .avito-tweaks-row +
            .avito-tweaks-row {
                margin-top: 5px;
            }

            .avito-tweaks-switch {
                position: relative;

                display: inline-block;

                width: 42px;
                height: 24px;
            }

            .avito-tweaks-switch input {
                position: absolute;

                width: 1px;
                height: 1px;

                opacity: 0;
            }

            .avito-tweaks-slider {
                position: absolute;
                inset: 0;

                cursor: pointer;

                background:
                    rgba(255,255,255,.24);

                border-radius: 999px;
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

                transition:
                    transform .18s ease;
            }

            .avito-tweaks-switch
            input:checked +
            .avito-tweaks-slider {
                background: #00aaff;
            }

            .avito-tweaks-switch
            input:checked +
            .avito-tweaks-slider::before {
                transform:
                    translateX(18px);
            }

            .avito-tweaks-separator {
                height: 1px;

                margin: 10px 0;

                background:
                    rgba(255,255,255,.10);
            }

            #avito-tweaks-blacklist {
                display: flex;
                flex-wrap: wrap;

                gap: 6px;

                margin-top: 8px;

                max-height: 110px;

                overflow-y: auto;
            }

            .avito-tweaks-blacklist-chip {
                display: inline-flex;
                align-items: center;

                max-width: 100%;

                padding:
                    4px 6px 4px 9px;

                color: #eee;

                background:
                    rgba(255,255,255,.10);

                border:
                    1px solid
                    rgba(255,255,255,.08);

                border-radius: 10px;

                font-size: 11px;
            }

            .avito-tweaks-blacklist-name {
                overflow: hidden;

                white-space: nowrap;

                text-overflow:
                    ellipsis;
            }

            .avito-tweaks-blacklist-remove {
                display: flex;
                align-items: center;
                justify-content: center;

                width: 17px;
                height: 17px;

                margin-left: 4px;

                color:
                    rgba(255,255,255,.65);

                font-size: 15px;

                cursor: pointer;
            }

            .avito-tweaks-blacklist-remove:hover {
                color: #fff;
            }

            #avito-tweaks-blacklist-empty {
                color:
                    rgba(255,255,255,.35);

                font-size: 10px;
            }
        `;

        document.head.appendChild(
            style
        );
    }


    /* =========================================================
       UI
       ========================================================= */

    function createSwitch(
        text,
        checked,
        onChange
    ) {
        const row =
            document.createElement(
                'div'
            );

        row.className =
            'avito-tweaks-row';

        const labelText =
            document.createElement(
                'span'
            );

        labelText.textContent =
            text;

        const label =
            document.createElement(
                'label'
            );

        label.className =
            'avito-tweaks-switch';

        const input =
            document.createElement(
                'input'
            );

        input.type =
            'checkbox';

        input.checked =
            checked;

        const slider =
            document.createElement(
                'span'
            );

        slider.className =
            'avito-tweaks-slider';

        input.addEventListener(
            'change',
            () => {
                onChange(
                    input.checked
                );

                filterAllItems();
            }
        );

        label.append(
            input,
            slider
        );

        row.append(
            labelText,
            label
        );

        return row;
    }


    function renderBlacklist() {
        const container =
            document.getElementById(
                'avito-tweaks-blacklist'
            );

        if (!container) {
            return;
        }

        container.replaceChildren();

        if (
            blacklist.length === 0
        ) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.id =
                'avito-tweaks-blacklist-empty';

            empty.textContent =
                'Чёрный список пуст';

            container.appendChild(
                empty
            );

            return;
        }

        for (const entry of blacklist) {
            const chip =
                document.createElement(
                    'div'
                );

            chip.className =
                'avito-tweaks-blacklist-chip';

            chip.title =
                entry.id;

            const name =
                document.createElement(
                    'span'
                );

            name.className =
                'avito-tweaks-blacklist-name';

            name.textContent =
                entry.name;

            const remove =
                document.createElement(
                    'span'
                );

            remove.className =
                'avito-tweaks-blacklist-remove';

            remove.textContent =
                '×';

            remove.title =
                'Удалить из ЧС';

            remove.addEventListener(
                'click',
                event => {
                    event.stopPropagation();

                    removeSellerFromBlacklist(
                        entry.id
                    );
                }
            );

            chip.append(
                name,
                remove
            );

            container.appendChild(
                chip
            );
        }
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


    /* =========================================================
       ПОЗИЦИЯ И DRAG
       ========================================================= */

    function restoreWidgetPosition(
        widget
    ) {
        const saved =
            storageGet(
                KEY_WIDGET_POSITION,
                null
            );

        if (
            !saved ||
            !Number.isFinite(saved.left) ||
            !Number.isFinite(saved.top)
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
                Math.max(
                    0,
                    saved.left
                ),
                maxLeft
            ) + 'px';

        widget.style.top =
            Math.min(
                Math.max(
                    0,
                    saved.top
                ),
                maxTop
            ) + 'px';

        widget.style.right =
            'auto';

        widget.style.bottom =
            'auto';
    }


    function saveWidgetPosition(
        widget
    ) {
        const rect =
            widget.getBoundingClientRect();

        storageSet(
            KEY_WIDGET_POSITION,
            {
                left:
                    Math.round(
                        rect.left
                    ),

                top:
                    Math.round(
                        rect.top
                    )
            }
        );
    }


    function makeWidgetDraggable(
        widget,
        handle,
        collapseButton
    ) {
        let dragging =
            false;

        let offsetX =
            0;

        let offsetY =
            0;

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
                    widget
                        .getBoundingClientRect();

                dragging =
                    true;

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

        function stop(event) {
            if (!dragging) {
                return;
            }

            dragging =
                false;

            try {
                if (
                    handle.hasPointerCapture(
                        event.pointerId
                    )
                ) {
                    handle.releasePointerCapture(
                        event.pointerId
                    );
                }
            } catch {
                // ignore
            }

            saveWidgetPosition(
                widget
            );
        }

        handle.addEventListener(
            'pointerup',
            stop
        );

        handle.addEventListener(
            'pointercancel',
            stop
        );
    }


    /* =========================================================
       СОЗДАНИЕ ВИДЖЕТА
       ========================================================= */

    function createWidget() {
        if (
            document.getElementById(
                'avito-tweaks-widget'
            )
        ) {
            return;
        }

        const widget =
            document.createElement(
                'div'
            );

        widget.id =
            'avito-tweaks-widget';

        const header =
            document.createElement(
                'div'
            );

        header.id =
            'avito-tweaks-header';

        const headerLeft =
            document.createElement(
                'div'
            );

        headerLeft.id =
            'avito-tweaks-header-left';

        const title =
            document.createElement(
                'span'
            );

        title.id =
            'avito-tweaks-title';

        title.textContent =
            'Avito Tweaks';

        headerLeft.appendChild(
            title
        );

        const collapseButton =
            document.createElement(
                'button'
            );

        collapseButton.id =
            'avito-tweaks-collapse';

        collapseButton.type =
            'button';

        const body =
            document.createElement(
                'div'
            );

        body.id =
            'avito-tweaks-body';

        const subtitle =
            document.createElement(
                'div'
            );

        subtitle.id =
            'avito-tweaks-subtitle';

        subtitle.textContent =
            'Скрывать объявления';


        const reservedSwitch =
            createSwitch(
                'Забронировано',
                hideReserved,
                value => {
                    hideReserved =
                        value;

                    storageSet(
                        KEY_HIDE_RESERVED,
                        value
                    );
                }
            );


        const viewedSwitch =
            createSwitch(
                'Просмотрено',
                hideViewed,
                value => {
                    hideViewed =
                        value;

                    storageSet(
                        KEY_HIDE_VIEWED,
                        value
                    );
                }
            );


        const noDeliverySwitch =
            createSwitch(
                'Без доставки',
                hideNoDelivery,
                value => {
                    hideNoDelivery =
                        value;

                    storageSet(
                        KEY_HIDE_NO_DELIVERY,
                        value
                    );
                }
            );


        const separator =
            document.createElement(
                'div'
            );

        separator.className =
            'avito-tweaks-separator';


        const blacklistSwitch =
            createSwitch(
                'Чёрный список',
                hideBlacklist,
                value => {
                    hideBlacklist =
                        value;

                    storageSet(
                        KEY_HIDE_BLACKLIST,
                        value
                    );
                }
            );


        const blacklistContainer =
            document.createElement(
                'div'
            );

        blacklistContainer.id =
            'avito-tweaks-blacklist';


        body.append(
            subtitle,
            reservedSwitch,
            viewedSwitch,
            noDeliverySwitch,
            separator,
            blacklistSwitch,
            blacklistContainer
        );


        header.append(
            headerLeft,
            collapseButton
        );


        widget.append(
            header,
            body
        );


        document.body.appendChild(
            widget
        );


        renderBlacklist();


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

                storageSet(
                    KEY_WIDGET_COLLAPSED,
                    widgetCollapsed
                );

                updateCollapsedState(
                    widget,
                    collapseButton
                );
            }
        );


        restoreWidgetPosition(
            widget
        );


        makeWidgetDraggable(
            widget,
            header,
            collapseButton
        );
    }


    /* =========================================================
       MUTATION OBSERVER
       ========================================================= */

    function startObserver() {
        const observer =
            new MutationObserver(
                mutations => {
                    for (
                        const mutation
                        of mutations
                    ) {
                        const target =
                            mutation.target
                                .nodeType ===
                            Node.TEXT_NODE
                                ? mutation.target
                                    .parentElement
                                : mutation.target;

                        if (
                            target &&
                            target.closest &&
                            target.closest(
                                '#avito-tweaks-widget'
                            )
                        ) {
                            continue;
                        }

                        if (
                            target &&
                            target.closest &&
                            target.closest(
                                '.avito-tweaks-add-blacklist'
                            )
                        ) {
                            continue;
                        }

                        scheduleRefresh();
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


    /* =========================================================
       START
       ========================================================= */

    function start() {
        if (
            !document.body ||
            !document.head
        ) {
            requestAnimationFrame(
                start
            );

            return;
        }

        /*
         * Миграцию делаем только когда страница
         * уже действительно существует.
         */
        migrateOldSettings();

        addStyles();

        createWidget();

        refreshAll();

        startObserver();

        console.log(
            'Avito Tweaks v4.2 запущен'
        );
    }


    start();

})();
