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

    /*
     * ============================================================
     * СЕЛЕКТОРЫ КАРТОЧЕК
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
     * /brands/<ID>
     * /user/<ID>/profile
     */
    const SELLER_LINK_SELECTOR = [
        'a[href^="/brands/"]',
        'a[href^="/user/"]',
        'a[href*="avito.ru/brands/"]',
        'a[href*="avito.ru/user/"]'
    ].join(', ');


    /*
     * ============================================================
     * КЛЮЧИ ХРАНИЛИЩА TAMPERMONKEY
     * ============================================================
     */

    const GM_HIDE_RESERVED =
        'hideReserved';

    const GM_HIDE_VIEWED =
        'hideViewed';

    const GM_HIDE_NO_DELIVERY =
        'hideNoDelivery';

    const GM_HIDE_BLACKLIST =
        'hideBlacklist';

    const GM_BLACKLIST =
        'blacklist';

    const GM_WIDGET_POSITION =
        'widgetPosition';

    const GM_WIDGET_COLLAPSED =
        'widgetCollapsed';

    const GM_MIGRATION_DONE =
        'migrationFromLocalStorageDone';


    /*
     * ============================================================
     * СТАРЫЕ КЛЮЧИ LOCALSTORAGE
     *
     * Нужны только для автоматического переноса данных
     * из предыдущей версии.
     * ============================================================
     */

    const OLD_STORAGE_HIDE_RESERVED =
        'avitoTweaks_hideReserved';

    const OLD_STORAGE_HIDE_VIEWED =
        'avitoTweaks_hideViewed';

    const OLD_STORAGE_HIDE_NO_DELIVERY =
        'avitoTweaks_hideNoDelivery';

    const OLD_STORAGE_HIDE_BLACKLIST =
        'avitoTweaks_hideBlacklist';

    const OLD_STORAGE_BLACKLIST =
        'avitoTweaks_blacklistV2';

    const OLD_STORAGE_WIDGET_POSITION =
        'avitoTweaks_widgetPosition';

    const OLD_STORAGE_WIDGET_COLLAPSED =
        'avitoTweaks_widgetCollapsed';


    /*
     * ============================================================
     * CSS-КЛАССЫ СКРЫТИЯ
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
     * МИГРАЦИЯ ИЗ LOCALSTORAGE В TAMPERMONKEY
     * ============================================================
     */

    function migrateFromLocalStorage() {

        /*
         * Миграция выполняется только один раз.
         */
        if (GM_getValue(GM_MIGRATION_DONE, false)) {
            return;
        }

        try {

            /*
             * Забронировано
             */
            const oldReserved =
                localStorage.getItem(
                    OLD_STORAGE_HIDE_RESERVED
                );

            if (
                GM_getValue(GM_HIDE_RESERVED, undefined) === undefined &&
                oldReserved !== null
            ) {
                GM_setValue(
                    GM_HIDE_RESERVED,
                    oldReserved !== 'false'
                );
            }


            /*
             * Просмотрено
             */
            const oldViewed =
                localStorage.getItem(
                    OLD_STORAGE_HIDE_VIEWED
                );

            if (
                GM_getValue(GM_HIDE_VIEWED, undefined) === undefined &&
                oldViewed !== null
            ) {
                GM_setValue(
                    GM_HIDE_VIEWED,
                    oldViewed !== 'false'
                );
            }


            /*
             * Без доставки
             */
            const oldNoDelivery =
                localStorage.getItem(
                    OLD_STORAGE_HIDE_NO_DELIVERY
                );

            if (
                GM_getValue(GM_HIDE_NO_DELIVERY, undefined) === undefined &&
                oldNoDelivery !== null
            ) {
                GM_setValue(
                    GM_HIDE_NO_DELIVERY,
                    oldNoDelivery === 'true'
                );
            }


            /*
             * Чёрный список включён / выключен
             */
            const oldBlacklistEnabled =
                localStorage.getItem(
                    OLD_STORAGE_HIDE_BLACKLIST
                );

            if (
                GM_getValue(GM_HIDE_BLACKLIST, undefined) === undefined &&
                oldBlacklistEnabled !== null
            ) {
                GM_setValue(
                    GM_HIDE_BLACKLIST,
                    oldBlacklistEnabled === 'true'
                );
            }


            /*
             * Сам чёрный список
             */
            const oldBlacklist =
                localStorage.getItem(
                    OLD_STORAGE_BLACKLIST
                );

            if (
                GM_getValue(GM_BLACKLIST, undefined) === undefined &&
                oldBlacklist
            ) {
                try {
                    const parsed =
                        JSON.parse(oldBlacklist);

                    if (Array.isArray(parsed)) {
                        GM_setValue(
                            GM_BLACKLIST,
                            parsed
                        );
                    }

                } catch (error) {
                    console.warn(
                        'Avito Tweaks: не удалось перенести старый ЧС.',
                        error
                    );
                }
            }


            /*
             * Положение виджета
             */
            const oldPosition =
                localStorage.getItem(
                    OLD_STORAGE_WIDGET_POSITION
                );

            if (
                GM_getValue(GM_WIDGET_POSITION, undefined) === undefined &&
                oldPosition
            ) {
                try {
                    const parsed =
                        JSON.parse(oldPosition);

                    GM_setValue(
                        GM_WIDGET_POSITION,
                        parsed
                    );

                } catch (error) {
                    console.warn(
                        'Avito Tweaks: не удалось перенести позицию окна.',
                        error
                    );
                }
            }


            /*
             * Свернуто / развернуто
             */
            const oldCollapsed =
                localStorage.getItem(
                    OLD_STORAGE_WIDGET_COLLAPSED
                );

            if (
                GM_getValue(GM_WIDGET_COLLAPSED, undefined) === undefined &&
                oldCollapsed !== null
            ) {
                GM_setValue(
                    GM_WIDGET_COLLAPSED,
                    oldCollapsed === 'true'
                );
            }

        } catch (error) {
            console.warn(
                'Avito Tweaks: ошибка миграции.',
                error
            );
        }

        /*
         * Старые данные специально НЕ удаляем.
         * Пусть остаются как страховочная копия.
         */
        GM_setValue(
            GM_MIGRATION_DONE,
            true
        );
    }


    /*
     * Выполняем миграцию до чтения настроек.
     */
    migrateFromLocalStorage();


    /*
     * ============================================================
     * СОСТОЯНИЕ
     * ============================================================
     */

    /*
     * По умолчанию:
     *
     * Забронировано  = скрывать
     * Просмотрено    = скрывать
     * Без доставки   = показывать
     * Чёрный список  = выключен
     */

    let hideReserved =
        GM_getValue(
            GM_HIDE_RESERVED,
            true
        );

    let hideViewed =
        GM_getValue(
            GM_HIDE_VIEWED,
            true
        );

    let hideNoDelivery =
        GM_getValue(
            GM_HIDE_NO_DELIVERY,
            false
        );

    let hideBlacklist =
        GM_getValue(
            GM_HIDE_BLACKLIST,
            false
        );

    let widgetCollapsed =
        GM_getValue(
            GM_WIDGET_COLLAPSED,
            false
        );

    let blacklist =
        loadBlacklist();

    let filterScheduled =
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

        const value =
            GM_getValue(
                GM_BLACKLIST,
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
        GM_setValue(
            GM_BLACKLIST,
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

        if (
            isSellerBlacklisted(id)
        ) {
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


    /*
     * ============================================================
     * ПОЛУЧЕНИЕ ID ПРОДАВЦА
     * ============================================================
     */

    function getSellerIdFromLink(link) {

        if (
            !(link instanceof HTMLAnchorElement)
        ) {
            return null;
        }

        let url;

        try {
            url = new URL(
                link.getAttribute('href'),
                location.origin
            );
        } catch {
            return null;
        }

        const path =
            url.pathname;


        /*
         * Компания / бренд
         *
         * /brands/9f02d3011e749e044cf4e382b49e20ae
         */
        let match =
            path.match(
                /^\/brands\/([a-zA-Z0-9]+)/
            );

        if (match) {
            return match[1];
        }


        /*
         * Обычный пользователь
         *
         * /user/d3b0b6466577ad9ba894a979173c8765/profile
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


    /*
     * ============================================================
     * ИНФОРМАЦИЯ О ПРОДАВЦЕ
     * ============================================================
     */

    function findSellerInfo(item) {

        if (
            !(item instanceof HTMLElement)
        ) {
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

            /*
             * Ник продавца обычно находится
             * внутри <p>.
             */
            let nameElement =
                link.querySelector('p');


            /*
             * Запасной вариант:
             * <p> расположен рядом с самой ссылкой.
             */
            if (!nameElement) {

                const parent =
                    link.parentElement;

                nameElement =
                    parent?.querySelector('p') ||
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


            /*
             * Ещё один fallback.
             */
            if (!name) {

                name =
                    normalizeText(
                        link.innerText ||
                        link.textContent
                    );
            }


            /*
             * Если Avito совсем поменял разметку,
             * хотя бы сохраним ID.
             */
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


    /*
     * ============================================================
     * КНОПКА "В ЧС"
     * ============================================================
     */

    function addBlacklistButton(item) {

        if (
            !(item instanceof HTMLElement)
        ) {
            return;
        }

        /*
         * Если кнопку в этой карточке
         * уже создавали — ничего не делаем.
         */
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

        /*
         * Используем span, а не button,
         * поскольку блок продавца часто находится
         * внутри ссылки <a>.
         */
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


        /*
         * Ставим кнопку рядом с ником.
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

        const blacklisted =
            isSellerBlacklisted(id);

        button.classList.toggle(
            'avito-tweaks-add-blacklist-active',
            blacklisted
        );

        button.textContent =
            blacklisted
                ? 'В ЧС ✓'
                : 'В ЧС';

        button.title =
            blacklisted
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

        /*
         * У рекомендованных товаров
         * скрываем контейнер на два уровня выше.
         */
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
            item.parentElement?.parentElement
        ];

        for (const element of elements) {

            if (
                !(element instanceof HTMLElement)
            ) {
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

        if (
            !(item instanceof HTMLElement)
        ) {
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


        const sellerInBlacklist =
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
            sellerInBlacklist
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

        if (filterScheduled) {
            return;
        }

        filterScheduled =
            true;

        requestAnimationFrame(
            () => {

                filterScheduled =
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
             * СКРЫТИЕ КАРТОЧЕК
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

                vertical-align: middle;

                color: #666;

                background:
                    rgba(0, 0, 0, 0.05);

                border:
                    1px solid
                    rgba(0, 0, 0, 0.10);

                border-radius: 5px;

                font-family:
                    Arial,
                    Helvetica,
                    sans-serif;

                font-size: 10px;
                font-weight: 500;

                line-height: 15px;

                cursor: pointer;
                user-select: none;

                transition:
                    color 0.12s ease,
                    background 0.12s ease,
                    border-color 0.12s ease;
            }

            .avito-tweaks-add-blacklist:hover {
                color: #111;

                background:
                    rgba(0, 0, 0, 0.10);
            }

            .avito-tweaks-add-blacklist-active {
                color: #9b2525;

                background:
                    rgba(180, 40, 40, 0.08);

                border-color:
                    rgba(180, 40, 40, 0.18);
            }


            /*
             * ОСНОВНОЙ ВИДЖЕТ
             */

            #avito-tweaks-widget {
                position: fixed;

                right: 20px;
                bottom: 20px;

                z-index: 2147483647;

                width: 250px;

                overflow: hidden;

                color: #ffffff;

                background:
                    rgba(25, 25, 28, 0.82);

                border:
                    1px solid
                    rgba(255, 255, 255, 0.18);

                border-radius: 14px;

                box-shadow:
                    0 8px 30px
                    rgba(0, 0, 0, 0.30);

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


            /*
             * HEADER
             */

            #avito-tweaks-header {
                display: flex;
                align-items: center;
                justify-content: space-between;

                padding:
                    11px 11px 11px 15px;

                background:
                    rgba(255, 255, 255, 0.08);

                border-bottom:
                    1px solid
                    rgba(255, 255, 255, 0.12);

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


            /*
             * СВЕРНУТЬ
             */

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
                    rgba(255,255,255,0.08);

                font-size: 18px;

                font-weight: 700;

                cursor: pointer;
            }

            #avito-tweaks-collapse:hover {
                background:
                    rgba(255,255,255,0.17);
            }


            /*
             * BODY
             */

            #avito-tweaks-body {
                padding:
                    12px 15px 15px;

                max-height: 500px;

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

                border-bottom-color:
                    transparent;
            }


            /*
             * ПОДЗАГОЛОВОК
             */

            #avito-tweaks-subtitle {
                margin-bottom: 8px;

                color:
                    rgba(255,255,255,0.60);

                font-size: 12px;

                font-weight: 600;

                text-transform:
                    uppercase;

                letter-spacing:
                    0.7px;
            }


            /*
             * СТРОКИ
             */

            .avito-tweaks-row {
                display: flex;

                align-items: center;

                justify-content:
                    space-between;

                gap: 12px;

                min-height: 34px;
            }

            .avito-tweaks-row
            + .avito-tweaks-row {

                margin-top: 5px;
            }


            /*
             * SWITCH
             */

            .avito-tweaks-switch {
                position: relative;

                display:
                    inline-block;

                flex:
                    0 0 auto;

                width: 42px;

                height: 24px;
            }

            .avito-tweaks-switch input {
                position: absolute;

                width: 1px;

                height: 1px;

                opacity: 0;

                pointer-events:
                    none;
            }

            .avito-tweaks-slider {
                position: absolute;

                inset: 0;

                cursor: pointer;

                background:
                    rgba(255,255,255,0.24);

                border-radius:
                    999px;

                transition:
                    background 0.18s ease;
            }

            .avito-tweaks-slider::before {
                content: "";

                position: absolute;

                left: 3px;

                bottom: 3px;

                width: 18px;

                height: 18px;

                background:
                    #ffffff;

                border-radius:
                    50%;

                box-shadow:
                    0 1px 4px
                    rgba(0,0,0,0.30);

                transition:
                    transform 0.18s ease;
            }

            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider {

                background:
                    #00aaff;
            }

            .avito-tweaks-switch
            input:checked
            + .avito-tweaks-slider::before {

                transform:
                    translateX(18px);
            }


            /*
             * РАЗДЕЛИТЕЛЬ
             */

            .avito-tweaks-separator {
                height: 1px;

                margin:
                    10px 0;

                background:
                    rgba(255,255,255,0.10);
            }


            /*
             * ЧЁРНЫЙ СПИСОК
             */

            #avito-tweaks-blacklist {
                display: flex;

                flex-wrap: wrap;

                gap: 6px;

                margin-top: 8px;

                max-height: 110px;

                overflow-y: auto;
            }


            /*
             * Плашка пользователя
             */

            .avito-tweaks-blacklist-chip {
                display:
                    inline-flex;

                align-items:
                    center;

                max-width:
                    100%;

                padding:
                    4px 6px 4px 9px;

                color:
                    #eeeeee;

                background:
                    rgba(255,255,255,0.10);

                border:
                    1px solid
                    rgba(255,255,255,0.08);

                border-radius:
                    10px;

                font-size:
                    11px;
            }

            .avito-tweaks-blacklist-name {
                overflow:
                    hidden;

                white-space:
                    nowrap;

                text-overflow:
                    ellipsis;
            }

            .avito-tweaks-blacklist-remove {
                display: flex;

                align-items:
                    center;

                justify-content:
                    center;

                flex:
                    0 0 auto;

                width: 17px;

                height: 17px;

                margin-left:
                    4px;

                border-radius:
                    50%;

                color:
                    rgba(255,255,255,0.65);

                font-size:
                    15px;

                line-height:
                    1;

                cursor:
                    pointer;
            }

            .avito-tweaks-blacklist-remove:hover {
                color:
                    #ffffff;

                background:
                    rgba(255,255,255,0.12);
            }

            #avito-tweaks-blacklist-empty {
                margin-top: 7px;

                color:
                    rgba(255,255,255,0.35);

                font-size:
                    10px;
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
     * РЕНДЕР ЧЁРНОГО СПИСКА
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

        container.innerHTML =
            '';


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


        for (
            const entry
            of blacklist
        ) {

            const chip =
                document.createElement(
                    'div'
                );

            chip.className =
                'avito-tweaks-blacklist-chip';

            /*
             * При наведении можно посмотреть
             * настоящий ID.
             */
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
     * ПОЛОЖЕНИЕ ВИДЖЕТА
     * ============================================================
     */

    function restoreWidgetPosition(widget) {

        const saved =
            GM_getValue(
                GM_WIDGET_POSITION,
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


    function saveWidgetPosition(widget) {

        const rect =
            widget.getBoundingClientRect();

        GM_setValue(
            GM_WIDGET_POSITION,
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
     * DRAG
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


        function stopDragging(event) {

            if (!dragging) {
                return;
            }


            dragging =
                false;


            if (
                handle.hasPointerCapture(
                    event.pointerId
                )
            ) {

                handle.releasePointerCapture(
                    event.pointerId
                );
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
     * СОЗДАНИЕ ВИДЖЕТА
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
         * Забронировано
         */

        const reservedSwitch =
            createSwitch(
                'Забронировано',
                hideReserved,

                value => {

                    hideReserved =
                        value;

                    GM_setValue(
                        GM_HIDE_RESERVED,
                        value
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

                    hideViewed =
                        value;

                    GM_setValue(
                        GM_HIDE_VIEWED,
                        value
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

                    hideNoDelivery =
                        value;

                    GM_setValue(
                        GM_HIDE_NO_DELIVERY,
                        value
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
         * Чёрный список
         */

        const blacklistSwitch =
            createSwitch(
                'Чёрный список',
                hideBlacklist,

                value => {

                    hideBlacklist =
                        value;

                    GM_setValue(
                        GM_HIDE_BLACKLIST,
                        value
                    );
                }
            );


        /*
         * Плашки ЧС
         */

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


        /*
         * Чёрный список
         */

        renderBlacklist();


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


                GM_setValue(
                    GM_WIDGET_COLLAPSED,
                    widgetCollapsed
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
                            mutation.target.nodeType ===
                            Node.TEXT_NODE

                                ? mutation.target
                                    .parentElement

                                : mutation.target;


                        /*
                         * Собственный виджет игнорируем.
                         */

                        if (
                            targetElement instanceof Element &&

                            targetElement.closest(
                                '#avito-tweaks-widget'
                            )
                        ) {
                            continue;
                        }


                        /*
                         * Наши кнопки "В ЧС"
                         * тоже не должны запускать
                         * бесконечное обновление.
                         */

                        if (
                            targetElement instanceof Element &&

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
