// ==UserScript==
// @name         Avito Tweaks
// @namespace    https://www.avito.ru/
// @version      0.4
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
     * ============================================================
     * СЕЛЕКТОРЫ
     * ============================================================
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
     * Ссылки продавцов:
     *
     * /brands/<ID или slug>
     * /user/<ID или slug>/profile
     */
    const SELLER_LINK_SELECTOR = [
        'a[href^="/brands/"]',
        'a[href^="/user/"]',
        'a[href*="avito.ru/brands/"]',
        'a[href*="avito.ru/user/"]'
    ].join(', ');


    /*
     * ============================================================
     * LOCAL STORAGE
     * ============================================================
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
        'avitoTweaks_blacklistV2';

    const STORAGE_WIDGET_POSITION =
        'avitoTweaks_widgetPosition';

    const STORAGE_WIDGET_COLLAPSED =
        'avitoTweaks_widgetCollapsed';


    /*
     * ============================================================
     * CSS-КЛАССЫ
     * ============================================================
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
     * ============================================================
     * СОСТОЯНИЕ
     * ============================================================
     */

    let hideReserved =
        localStorage.getItem(STORAGE_HIDE_RESERVED) !== 'false';

    let hideViewed =
        localStorage.getItem(STORAGE_HIDE_VIEWED) !== 'false';

    let hideNoDelivery =
        localStorage.getItem(STORAGE_HIDE_NO_DELIVERY) === 'true';

    let hideBlacklist =
        localStorage.getItem(STORAGE_HIDE_BLACKLIST) === 'true';

    let widgetCollapsed =
        localStorage.getItem(STORAGE_WIDGET_COLLAPSED) === 'true';

    let blacklist =
        loadBlacklist();

    let refreshScheduled =
        false;


    /*
     * ============================================================
     * ОБЩИЕ ФУНКЦИИ
     * ============================================================
     */

    function normalizeText(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    }


    /*
     * ============================================================
     * ЧЁРНЫЙ СПИСОК
     * ============================================================
     */

    function loadBlacklist() {
        try {
            const value =
                JSON.parse(
                    localStorage.getItem(STORAGE_BLACKLIST) || '[]'
                );

            if (!Array.isArray(value)) {
                return [];
            }

            return value.filter(entry =>
                entry &&
                typeof entry.id === 'string' &&
                entry.id.length > 0
            );

        } catch (error) {
            console.warn(
                'Avito Tweaks: не удалось загрузить ЧС.',
                error
            );

            return [];
        }
    }


    function saveBlacklist() {
        localStorage.setItem(
            STORAGE_BLACKLIST,
            JSON.stringify(blacklist)
        );
    }


    function isSellerBlacklisted(id) {
        return blacklist.some(
            entry =>
                entry.id === id
        );
    }


    function addSellerToBlacklist(id, name) {
        if (!id) {
            return;
        }

        if (isSellerBlacklisted(id)) {
            return;
        }

        blacklist.push({
            id,
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


    /*
     * ============================================================
     * ЭКСПОРТ ЧС
     * ============================================================
     */

    function exportBlacklist() {
        try {
            const data =
                JSON.stringify(
                    blacklist,
                    null,
                    2
                );

            const blob =
                new Blob(
                    [data],
                    {
                        type:
                            'text/plain;charset=utf-8'
                    }
                );

            const url =
                URL.createObjectURL(blob);

            const link =
                document.createElement('a');

            link.href =
                url;

            link.download =
                'avito-tweaks-blacklist.txt';

            document.body.appendChild(
                link
            );

            link.click();

            link.remove();

            setTimeout(
                () => {
                    URL.revokeObjectURL(
                        url
                    );
                },
                1000
            );

        } catch (error) {
            console.error(
                'Avito Tweaks: ошибка экспорта.',
                error
            );

            alert(
                'Не удалось экспортировать чёрный список.'
            );
        }
    }


    /*
     * ============================================================
     * ИМПОРТ ЧС
     * ============================================================
     */

    function importBlacklistFromFile(file) {
        if (!file) {
            return;
        }

        const reader =
            new FileReader();

        reader.onload =
            () => {
                try {
                    const parsed =
                        JSON.parse(
                            String(
                                reader.result || ''
                            )
                        );

                    if (!Array.isArray(parsed)) {
                        throw new Error(
                            'Файл не содержит массив.'
                        );
                    }

                    const unique =
                        new Map();

                    for (const entry of parsed) {
                        if (
                            !entry ||
                            typeof entry !== 'object' ||
                            typeof entry.id !== 'string'
                        ) {
                            continue;
                        }

                        const id =
                            entry.id.trim();

                        if (!id) {
                            continue;
                        }

                        const name =
                            normalizeText(
                                entry.name || id
                            );

                        unique.set(
                            id,
                            {
                                id,
                                name
                            }
                        );
                    }

                    /*
                     * Полностью заменяем текущий список.
                     */
                    blacklist =
                        Array.from(
                            unique.values()
                        );

                    saveBlacklist();

                    renderBlacklist();
                    updateSellerButtons();
                    filterAllItems();

                    alert(
                        'Чёрный список импортирован.\n\n' +
                        'Записей: ' +
                        blacklist.length
                    );

                } catch (error) {
                    console.error(
                        'Avito Tweaks: ошибка импорта.',
                        error
                    );

                    alert(
                        'Не удалось импортировать ЧС.\n\n' +
                        'Выберите файл, созданный функцией «Экспорт».'
                    );
                }
            };


        reader.onerror =
            () => {
                alert(
                    'Не удалось прочитать файл.'
                );
            };


        reader.readAsText(
            file,
            'UTF-8'
        );
    }


    /*
     * ============================================================
     * ID / SLUG ПРОДАВЦА
     * ============================================================
     */

    function getSellerIdFromLink(link) {
        if (!(link instanceof HTMLAnchorElement)) {
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
         * Компания / бренд.
         *
         * Поддерживаем:
         *
         * /brands/9f02d3011e749e044cf4e382b49e20ae
         * /brands/hps_store
         * /brands/hello-ps-store
         *
         * Берём целиком сегмент после /brands/
         * до следующего слеша.
         */

        let match =
            path.match(
                /^\/brands\/([^/]+)(?:\/|$)/
            );

        if (match) {
            return decodeURIComponent(
                match[1]
            );
        }


        /*
         * Обычный пользователь.
         *
         * /user/d3b0b6466577ad9ba894a979173c8765/profile
         *
         * Также не ограничиваем ID только буквами/цифрами.
         */

        match =
            path.match(
                /^\/user\/([^/]+)(?:\/|$)/
            );

        if (match) {
            return decodeURIComponent(
                match[1]
            );
        }

        return null;
    }


    /*
     * ============================================================
     * ПРОДАВЕЦ В КАРТОЧКЕ
     * ============================================================
     */

    function findSellerInfo(item) {
        if (!(item instanceof HTMLElement)) {
            return null;
        }

        const links =
            item.querySelectorAll(
                SELLER_LINK_SELECTOR
            );

        for (const link of links) {
            const id =
                getSellerIdFromLink(
                    link
                );

            if (!id) {
                continue;
            }

            /*
             * Обычно ник находится внутри <p>
             * в ссылке продавца.
             */

            let nameElement =
                link.querySelector('p');


            /*
             * Запасной вариант.
             */

            if (!nameElement) {
                nameElement =
                    link.parentElement
                        ?.querySelector('p') ||
                    null;
            }


            let name =
                '';


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
                    id;
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


    /*
     * ============================================================
     * КНОПКА "В ЧС"
     * ============================================================
     */

    function addBlacklistButton(item) {
        if (!(item instanceof HTMLElement)) {
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
            findSellerInfo(
                item
            );


        if (!seller) {
            return;
        }


        const button =
            document.createElement(
                'span'
            );


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


        /*
         * Ставим рядом с ником.
         */

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
            event => {
                event.stopPropagation();
            },
            true
        );


        button.addEventListener(
            'keydown',
            event => {
                if (
                    event.key === 'Enter' ||
                    event.key === ' '
                ) {
                    activate(
                        event
                    );
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
            isSellerBlacklisted(
                id
            );


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


    /*
     * ============================================================
     * КОНТЕЙНЕРЫ КАРТОЧЕК
     * ============================================================
     */

    function getRecommendationTarget(item) {
        return (
            item.parentElement
                ?.parentElement ||
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
            return getRecommendationTarget(
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
     * ============================================================
     * ФИЛЬТРАЦИЯ
     * ============================================================
     */

    function filterItem(item) {
        if (!(item instanceof HTMLElement)) {
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
            findSellerInfo(
                item
            );


        const sellerBlocked =
            seller
                ? isSellerBlacklisted(
                    seller.id
                )
                : false;


        const target =
            getFilterTarget(
                item
            );


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


        requestAnimationFrame(
            () => {
                refreshScheduled =
                    false;

                refreshAll();
            }
        );
    }


    /*
     * ============================================================
     * CSS
     * ============================================================
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
            document.createElement(
                'style'
            );


        style.id =
            'avito-tweaks-styles';


        style.textContent = `

            /*
             * СКРЫТИЕ
             */

            .${HIDDEN_RESERVED_CLASS},
            .${HIDDEN_VIEWED_CLASS},
            .${HIDDEN_NO_DELIVERY_CLASS},
            .${HIDDEN_BLACKLIST_CLASS} {
                display: none !important;
            }


            /*
             * КНОПКА "В ЧС"
             */

            .avito-tweaks-add-blacklist {
                display: inline-flex;
                align-items: center;

                width: max-content;

                margin-left: 7px;
                padding: 2px 6px;

                color: #666;

                background:
                    rgba(0,0,0,.05);

                border:
                    1px solid
                    rgba(0,0,0,.10);

                border-radius: 5px;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 10px;
                line-height: 15px;

                cursor: pointer;
                user-select: none;

                vertical-align: middle;
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


            /*
             * ====================================================
             * ГЛАВНЫЙ ВИДЖЕТ
             * ====================================================
             */

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

                letter-spacing: .2px;
            }


            #avito-tweaks-collapse {
                display: flex;
                align-items: center;
                justify-content: center;

                width: 28px;
                height: 24px;

                margin-left: 8px;
                padding: 0;

                color: #fff;

                background:
                    rgba(255,255,255,.08);

                border: 0;
                border-radius: 6px;

                font-size: 18px;
                font-weight: 700;

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


            #avito-tweaks-widget.avito-tweaks-collapsed
            #avito-tweaks-header {
                border-bottom-color:
                    transparent;
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


            /*
             * Строки
             */

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


            /*
             * Переключатели
             */

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
                    rgba(255,255,255,.24);

                border-radius: 999px;

                transition:
                    background .18s ease;
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
                    0 1px 4px
                    rgba(0,0,0,.30);

                transition:
                    transform .18s ease;
            }


            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider {
                background: #00aaff;
            }


            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider::before {
                transform:
                    translateX(18px);
            }


            /*
             * Разделитель
             */

            .avito-tweaks-separator {
                height: 1px;

                margin: 10px 0;

                background:
                    rgba(255,255,255,.10);
            }


            /*
             * ====================================================
             * КНОПКИ ЧС
             * ====================================================
             */

            #avito-tweaks-blacklist-actions {
                display: flex;

                gap: 5px;

                margin-top: 8px;
            }


            .avito-tweaks-blacklist-action {
                flex: 1;

                min-width: 0;

                padding: 6px 4px;

                color: #eee;

                background:
                    rgba(255,255,255,.08);

                border:
                    1px solid
                    rgba(255,255,255,.12);

                border-radius: 7px;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 10px;

                line-height: 1.2;

                cursor: pointer;

                white-space: nowrap;
            }


            .avito-tweaks-blacklist-action:hover {
                background:
                    rgba(255,255,255,.16);

                border-color:
                    rgba(255,255,255,.22);
            }


            #avito-tweaks-blacklist-file {
                display: none !important;
            }


            /*
             * ====================================================
             * ОТДЕЛЬНОЕ ОКНО ЧС
             * ====================================================
             */

            #avito-tweaks-blacklist-window {
                position: fixed;

                right: 290px;
                bottom: 20px;

                z-index: 2147483647;

                width: 340px;

                max-height: 460px;

                overflow: hidden;

                color: #fff;

                background:
                    rgba(25,25,28,.92);

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

                font-size: 13px;

                user-select: none;
            }


            #avito-tweaks-blacklist-window * {
                box-sizing: border-box;
            }


            #avito-tweaks-blacklist-window-header {
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

                font-size: 14px;

                font-weight: 700;

                cursor: move;

                touch-action: none;
            }


            #avito-tweaks-blacklist-window-header-left {
                display: flex;
                align-items: center;
            }


            #avito-tweaks-blacklist-window-header-left::after {
                content: "⠿";

                margin-left: 8px;

                color:
                    rgba(255,255,255,.38);

                font-size: 17px;
            }


            #avito-tweaks-blacklist-window-close {
                display: flex;
                align-items: center;
                justify-content: center;

                width: 28px;
                height: 24px;

                padding: 0;

                color: #fff;

                background:
                    rgba(255,255,255,.08);

                border: 0;

                border-radius: 6px;

                font-size: 18px;

                cursor: pointer;
            }


            #avito-tweaks-blacklist-window-close:hover {
                background:
                    rgba(255,255,255,.17);
            }


            #avito-tweaks-blacklist-window-body {
                padding: 13px;

                max-height: 400px;

                overflow-y: auto;
            }


            #avito-tweaks-blacklist {
                display: flex;

                flex-wrap: wrap;

                align-items:
                    flex-start;

                gap: 7px;
            }


            .avito-tweaks-blacklist-chip {
                display: inline-flex;

                align-items: center;

                max-width: 100%;

                padding:
                    6px 7px 6px 10px;

                color: #eee;

                background:
                    rgba(255,255,255,.10);

                border:
                    1px solid
                    rgba(255,255,255,.10);

                border-radius: 10px;

                font-size: 12px;

                line-height: 1.25;
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

                flex: 0 0 auto;

                width: 18px;
                height: 18px;

                margin-left: 5px;

                border-radius: 50%;

                color:
                    rgba(255,255,255,.65);

                font-size: 16px;

                line-height: 1;

                cursor: pointer;
            }


            .avito-tweaks-blacklist-remove:hover {
                color: #fff;

                background:
                    rgba(255,255,255,.13);
            }


            #avito-tweaks-blacklist-empty {
                color:
                    rgba(255,255,255,.40);

                font-size: 11px;

                padding: 3px;
            }
        `;


        document.head.appendChild(
            style
        );
    }


    /*
     * ============================================================
     * UI — SWITCH
     * ============================================================
     */

    function createSwitch(
        labelText,
        checked,
        onChange
    ) {
        const row =
            document.createElement(
                'div'
            );


        row.className =
            'avito-tweaks-row';


        const text =
            document.createElement(
                'span'
            );


        text.textContent =
            labelText;


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
            text,
            label
        );


        return row;
    }


    /*
     * ============================================================
     * РЕНДЕР ЧС
     * ============================================================
     */

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
                'Удалить из чёрного списка';


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


    /*
     * ============================================================
     * ОКНО ЧС
     * ============================================================
     */

    function toggleBlacklistWindow() {
        const existing =
            document.getElementById(
                'avito-tweaks-blacklist-window'
            );


        if (existing) {
            existing.remove();
            return;
        }


        const windowEl =
            document.createElement(
                'div'
            );


        windowEl.id =
            'avito-tweaks-blacklist-window';


        /*
         * HEADER
         */

        const header =
            document.createElement(
                'div'
            );


        header.id =
            'avito-tweaks-blacklist-window-header';


        const headerLeft =
            document.createElement(
                'div'
            );


        headerLeft.id =
            'avito-tweaks-blacklist-window-header-left';


        const title =
            document.createElement(
                'span'
            );


        title.textContent =
            'Чёрный список';


        headerLeft.appendChild(
            title
        );


        const closeButton =
            document.createElement(
                'button'
            );


        closeButton.type =
            'button';


        closeButton.id =
            'avito-tweaks-blacklist-window-close';


        closeButton.textContent =
            '_';


        closeButton.title =
            'Закрыть';


        header.append(
            headerLeft,
            closeButton
        );


        /*
         * BODY
         */

        const body =
            document.createElement(
                'div'
            );


        body.id =
            'avito-tweaks-blacklist-window-body';


        const list =
            document.createElement(
                'div'
            );


        list.id =
            'avito-tweaks-blacklist';


        body.appendChild(
            list
        );


        windowEl.append(
            header,
            body
        );


        document.body.appendChild(
            windowEl
        );


        renderBlacklist();


        closeButton.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                windowEl.remove();
            }
        );


        makeFloatingWindowDraggable(
            windowEl,
            header,
            closeButton
        );
    }


    /*
     * ============================================================
     * DRAG ОКНА ЧС
     * ============================================================
     */

    function makeFloatingWindowDraggable(
        element,
        handle,
        ignoreElement
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
                    ignoreElement.contains(
                        event.target
                    )
                ) {
                    return;
                }


                const rect =
                    element.getBoundingClientRect();


                dragging =
                    true;


                offsetX =
                    event.clientX -
                    rect.left;


                offsetY =
                    event.clientY -
                    rect.top;


                element.style.left =
                    rect.left + 'px';


                element.style.top =
                    rect.top + 'px';


                element.style.right =
                    'auto';


                element.style.bottom =
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
                        element.offsetWidth
                    );


                const maxTop =
                    Math.max(
                        0,
                        window.innerHeight -
                        element.offsetHeight
                    );


                const left =
                    Math.min(
                        Math.max(
                            0,
                            event.clientX -
                            offsetX
                        ),
                        maxLeft
                    );


                const top =
                    Math.min(
                        Math.max(
                            0,
                            event.clientY -
                            offsetY
                        ),
                        maxTop
                    );


                element.style.left =
                    left + 'px';


                element.style.top =
                    top + 'px';
            }
        );


        function stopDragging(
            event
        ) {
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
        }


        handle.addEventListener(
            'pointerup',
            stopDragging
        );


        handle.addEventListener(
            'pointercancel',
            stopDragging
        );
    }


    /*
     * ============================================================
     * COLLAPSE
     * ============================================================
     */

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
     * ============================================================
     * ПОЗИЦИЯ ГЛАВНОГО ВИДЖЕТА
     * ============================================================
     */

    function restoreWidgetPosition(
        widget
    ) {
        try {
            const raw =
                localStorage.getItem(
                    STORAGE_WIDGET_POSITION
                );


            if (!raw) {
                return;
            }


            const saved =
                JSON.parse(
                    raw
                );


            if (
                !Number.isFinite(
                    saved?.left
                ) ||
                !Number.isFinite(
                    saved?.top
                )
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


        } catch (error) {
            console.warn(
                'Avito Tweaks: ошибка восстановления позиции.',
                error
            );
        }
    }


    function saveWidgetPosition(
        widget
    ) {
        const rect =
            widget.getBoundingClientRect();


        localStorage.setItem(
            STORAGE_WIDGET_POSITION,

            JSON.stringify({
                left:
                    Math.round(
                        rect.left
                    ),

                top:
                    Math.round(
                        rect.top
                    )
            })
        );
    }


    function keepWidgetInsideWindow(
        widget
    ) {
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
                Math.max(
                    0,
                    rect.left
                ),
                maxLeft
            ) + 'px';


        widget.style.top =
            Math.min(
                Math.max(
                    0,
                    rect.top
                ),
                maxTop
            ) + 'px';


        widget.style.right =
            'auto';


        widget.style.bottom =
            'auto';


        saveWidgetPosition(
            widget
        );
    }


    /*
     * ============================================================
     * DRAG ГЛАВНОГО ВИДЖЕТА
     * ============================================================
     */

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
                    widget.getBoundingClientRect();


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


        function stopDragging(
            event
        ) {
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


                keepWidgetInsideWindow(
                    widget
                );
            }
        );
    }


    /*
     * ============================================================
     * СОЗДАНИЕ ГЛАВНОГО ВИДЖЕТА
     * ============================================================
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
            document.createElement(
                'div'
            );


        widget.id =
            'avito-tweaks-widget';


        /*
         * HEADER
         */

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


        /*
         * BODY
         */

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


        /*
         * ЗАБРОНИРОВАНО
         */

        const reservedSwitch =
            createSwitch(
                'Забронировано',
                hideReserved,

                value => {
                    hideReserved =
                        value;

                    localStorage.setItem(
                        STORAGE_HIDE_RESERVED,
                        String(value)
                    );
                }
            );


        /*
         * ПРОСМОТРЕНО
         */

        const viewedSwitch =
            createSwitch(
                'Просмотрено',
                hideViewed,

                value => {
                    hideViewed =
                        value;

                    localStorage.setItem(
                        STORAGE_HIDE_VIEWED,
                        String(value)
                    );
                }
            );


        /*
         * БЕЗ ДОСТАВКИ
         */

        const noDeliverySwitch =
            createSwitch(
                'Без доставки',
                hideNoDelivery,

                value => {
                    hideNoDelivery =
                        value;

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
            document.createElement(
                'div'
            );


        separator.className =
            'avito-tweaks-separator';


        /*
         * ЧЁРНЫЙ СПИСОК
         */

        const blacklistSwitch =
            createSwitch(
                'Чёрный список',
                hideBlacklist,

                value => {
                    hideBlacklist =
                        value;

                    localStorage.setItem(
                        STORAGE_HIDE_BLACKLIST,
                        String(value)
                    );
                }
            );


        /*
         * ========================================================
         * КНОПКИ ЧС
         * ========================================================
         */

        const blacklistActions =
            document.createElement(
                'div'
            );


        blacklistActions.id =
            'avito-tweaks-blacklist-actions';


        const listButton =
            document.createElement(
                'button'
            );


        listButton.type =
            'button';


        listButton.className =
            'avito-tweaks-blacklist-action';


        listButton.textContent =
            'Список';


        listButton.title =
            'Открыть чёрный список';


        const exportButton =
            document.createElement(
                'button'
            );


        exportButton.type =
            'button';


        exportButton.className =
            'avito-tweaks-blacklist-action';


        exportButton.textContent =
            'Экспорт';


        exportButton.title =
            'Экспортировать ЧС';


        const importButton =
            document.createElement(
                'button'
            );


        importButton.type =
            'button';


        importButton.className =
            'avito-tweaks-blacklist-action';


        importButton.textContent =
            'Импорт';


        importButton.title =
            'Импортировать ЧС';


        const importFileInput =
            document.createElement(
                'input'
            );


        importFileInput.type =
            'file';


        importFileInput.id =
            'avito-tweaks-blacklist-file';


        importFileInput.accept =
            '.txt,.json,text/plain,application/json';


        /*
         * EVENTS
         */

        listButton.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                toggleBlacklistWindow();
            }
        );


        exportButton.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                exportBlacklist();
            }
        );


        importButton.addEventListener(
            'click',
            event => {
                event.preventDefault();
                event.stopPropagation();

                importFileInput.value =
                    '';

                importFileInput.click();
            }
        );


        importFileInput.addEventListener(
            'change',
            () => {
                const file =
                    importFileInput.files?.[0];


                if (!file) {
                    return;
                }


                const confirmed =
                    confirm(
                        'Импорт полностью заменит текущий чёрный список.\n\n' +
                        'Продолжить?'
                    );


                if (!confirmed) {
                    importFileInput.value =
                        '';

                    return;
                }


                importBlacklistFromFile(
                    file
                );
            }
        );


        blacklistActions.append(
            listButton,
            exportButton,
            importButton
        );


        body.append(
            subtitle,
            reservedSwitch,
            viewedSwitch,
            noDeliverySwitch,
            separator,
            blacklistSwitch,
            blacklistActions,
            importFileInput
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


        /*
         * COLLAPSE
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


                requestAnimationFrame(
                    () => {
                        if (
                            widget.style.left !== '' &&
                            widget.style.top !== ''
                        ) {
                            keepWidgetInsideWindow(
                                widget
                            );
                        }
                    }
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


    /*
     * ============================================================
     * MUTATION OBSERVER
     * ============================================================
     */

    function startObserver() {
        const observer =
            new MutationObserver(
                mutations => {

                    for (
                        const mutation
                        of mutations
                    ) {
                        const targetElement =
                            mutation.target
                                .nodeType ===
                            Node.TEXT_NODE

                                ? mutation.target
                                    .parentElement

                                : mutation.target;


                        if (
                            targetElement
                                instanceof Element &&

                            targetElement.closest(
                                '#avito-tweaks-widget'
                            )
                        ) {
                            continue;
                        }


                        if (
                            targetElement
                                instanceof Element &&

                            targetElement.closest(
                                '#avito-tweaks-blacklist-window'
                            )
                        ) {
                            continue;
                        }


                        if (
                            targetElement
                                instanceof Element &&

                            targetElement.closest(
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
                childList:
                    true,

                subtree:
                    true,

                characterData:
                    true,

                attributes:
                    true,

                attributeFilter: [
                    'data-icon-name',
                    'data-marker',
                    'href'
                ]
            }
        );
    }


    /*
     * ============================================================
     * START
     * ============================================================
     */

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


        addStyles();

        createWidget();

        refreshAll();

        startObserver();
    }


    start();

})();
