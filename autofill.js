// ==UserScript==
// @name         西南交大教务系统一键评价助手
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  极速完成所有课程评价。
// @author       Antigravity
// @match        https://jwc.swjtu.edu.cn/vatuu/AssessAction?setAction=list*
// @match        https://jwc.swjtu.edu.cn/vatuu/AssessAction?setAction=viewAssess&sid=*
// @match        https://jwc.swjtu.edu.cn/vatuu/AssessAction
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /**
     * ======================================
     * CONFIGURATION & CONSTANTS
     * ======================================
     */
    const CONFIG = {
        STORAGE_KEY_RUNNING: 'AF_IS_RUNNING',   // 'true' or 'false'
        STORAGE_KEY_QUEUE: 'AF_COURSE_QUEUE',   // JSON Array of URLs
        STORAGE_KEY_STATE: 'AF_CURRENT_STATE',  // 'IDLE', 'ATTEMPT_1', 'RETRY'

        // Timeouts (ms)
        DELAY_LIST_JUMP: 1000,
        DELAY_SUBMIT_FAST: 50,
        DELAY_BACK_CLICK: 500,

        // Selectors
        SEL_RADIO_5: 'input[type="radio"][score="5.0"]',
        SEL_TEXTAREA: 'textarea',
        SEL_SUBMIT: 'input[value="提交"], button[onclick*="Submit"]',
        SEL_BACK_LINK: 'a[href*="history.go(-1)"]',

        // Texts
        TEXT_ASK_START: "确定要开始全自动极速评价吗？\n脚本将尝试绕过时间限制。",
        TEXT_ERROR_SIG: "参数错误"
    };

    /**
     * ======================================
     * UTILITIES
     * ======================================
     */
    const Utils = {
        sleep: (ms) => new Promise(res => setTimeout(res, ms)),

        log: (msg) => {
            console.log(`[EvalBot] ${msg}`);
            UI.appendLog(msg);
        },

        State: {
            isRunning: () => sessionStorage.getItem(CONFIG.STORAGE_KEY_RUNNING) === 'true',
            setRunning: (val) => sessionStorage.setItem(CONFIG.STORAGE_KEY_RUNNING, val),

            getQueue: () => JSON.parse(sessionStorage.getItem(CONFIG.STORAGE_KEY_QUEUE) || '[]'),
            setQueue: (arr) => sessionStorage.setItem(CONFIG.STORAGE_KEY_QUEUE, JSON.stringify(arr)),

            getStatus: () => sessionStorage.getItem(CONFIG.STORAGE_KEY_STATE) || 'IDLE',
            setStatus: (val) => sessionStorage.setItem(CONFIG.STORAGE_KEY_STATE, val),

            reset: () => {
                sessionStorage.removeItem(CONFIG.STORAGE_KEY_QUEUE);
                sessionStorage.removeItem(CONFIG.STORAGE_KEY_STATE);
                sessionStorage.setItem(CONFIG.STORAGE_KEY_RUNNING, 'false');
            }
        },

        // Helper to check precise page type
        PageType: {
            // Strictly match List page (exclude listOthers, termAppraise etc.)
            isList: () => location.href.indexOf('setAction=list') !== -1 && location.href.indexOf('setAction=listOthers') === -1,
            isDetail: () => location.href.indexOf('setAction=viewAssess') !== -1,
            isError: () => document.body.innerText.includes(CONFIG.TEXT_ERROR_SIG) || (document.querySelector(CONFIG.SEL_BACK_LINK) && !document.querySelector('#answerForm'))
        }
    };

    /**
     * ======================================
     * UI MODULE
     * ======================================
     */
    const UI = {
        panelId: 'af-smart-panel',

        init: () => {
            if (document.getElementById(UI.panelId)) return;

            const style = document.createElement('style');
            style.textContent = `
                #${UI.panelId} {
                    position: fixed; top: 80px; right: 20px; width: 220px;
                    background: rgba(255, 255, 255, 0.98); 
                    border: 1px solid #1488F5; border-top: 4px solid #1488F5;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px;
                    padding: 12px; z-index: 999999; 
                    font-family: 'Microsoft YaHei', sans-serif; font-size: 13px;
                }
                .af-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
                .af-title { font-weight: bold; color: #1488F5; }
                .af-close { cursor: pointer; font-size: 16px; color: #999; line-height: 1; }
                .af-close:hover { color: #333; }
                .af-btn {
                    display: block; width: 100%; padding: 6px 0; margin-bottom: 6px;
                    background: #1488F5; color: white; border: none; border-radius: 3px;
                    cursor: pointer; transition: 0.2s;
                }
                .af-btn:hover { opacity: 0.9; }
                .af-btn.stop { background: #e74c3c; }
                .af-btn.scnd { background: #f8f9fa; color: #333; border: 1px solid #ddd; }
                #af-log-area {
                    height: 80px; overflow-y: auto; background: #f8f9fa; 
                    border: 1px solid #eee; padding: 5px; color: #555;
                    font-size: 11px; margin-top: 5px; text-align: left;
                }
            `;
            document.head.appendChild(style);

            const div = document.createElement('div');
            div.id = UI.panelId;
            document.body.appendChild(div);
        },

        close: () => {
            const el = document.getElementById(UI.panelId);
            if (el) el.style.display = 'none';
        },

        renderRunning: (queueLen, statusTxt) => {
            const panel = document.getElementById(UI.panelId);
            panel.innerHTML = `
                <div class="af-header">
                    <span class="af-title">🤖 智能运行中</span>
                    <span class="af-close" id="af-close-btn">×</span>
                </div>
                <div style="margin-bottom:5px;">剩余课程: <b>${queueLen}</b></div>
                <div style="margin-bottom:5px;">状态: ${statusTxt}</div>
                <button id="af-stop" class="af-btn stop">⏹ 停止</button>
                <div id="af-log-area"></div>
            `;
            document.getElementById('af-stop').onclick = () => {
                Utils.State.reset();
                location.reload();
            };
            document.getElementById('af-close-btn').onclick = UI.close;
        },

        renderIdle: () => {
            const panel = document.getElementById(UI.panelId);

            let buttonsHtml = '';
            if (Utils.PageType.isList()) {
                buttonsHtml = `<button id="af-start" class="af-btn">🚀 开始全自动评价</button>`;
            } else if (Utils.PageType.isDetail()) {
                buttonsHtml = `<button id="af-test-one" class="af-btn scnd">⚡ 仅填写当前页</button>`;
            }

            panel.innerHTML = `
                <div class="af-header">
                    <span class="af-title">✨ 评价助手</span>
                    <span class="af-close" id="af-close-btn">×</span>
                </div>
                ${buttonsHtml}
                <div style="color:#999; font-size:11px;">自动完成课程评价</div>
            `;

            if (document.getElementById('af-start')) {
                document.getElementById('af-start').onclick = () => {
                    if (confirm(CONFIG.TEXT_ASK_START)) {
                        Utils.State.setRunning('true');
                        sessionStorage.removeItem(CONFIG.STORAGE_KEY_QUEUE);
                        location.reload();
                    }
                };
            }

            if (document.getElementById('af-test-one')) {
                document.getElementById('af-test-one').onclick = function () { // Use full function to access 'this' if needed, or getElement
                    Actions.fillForm();
                    const btn = document.getElementById('af-test-one');
                    btn.innerText = "✅ 已填写";
                    setTimeout(() => btn.innerText = "⚡ 仅填写当前页", 2000);
                };
            }

            document.getElementById('af-close-btn').onclick = UI.close;
        },

        appendLog: (txt) => {
            const el = document.getElementById('af-log-area');
            if (el) {
                el.innerHTML = `<div>> ${txt}</div>` + el.innerHTML;
            }
        }
    };

    /**
     * ======================================
     * CORE ACTIONS
     * ======================================
     */
    const Actions = {
        scanCourses: () => {
            const links = Array.from(document.querySelectorAll('a[href*="setAction=viewAssess"]'));
            const uniqueUrls = new Set();
            links.forEach(a => {
                if (a.innerText.includes("填写问卷")) uniqueUrls.add(a.href);
            });
            return Array.from(uniqueUrls);
        },

        fillForm: () => {
            document.querySelectorAll('.questionDiv, .answerDiv').forEach(d => d.style.display = 'block');

            const radios = document.querySelectorAll(CONFIG.SEL_RADIO_5);
            radios.forEach(r => { if (!r.checked) r.click(); });

            const comments = [
                "老师授课认真负责，知识点讲解清晰",
                "课程内容充实，收获良多",
                "无",
                "暂无建议"
            ];
            // Q17 (comments[0]), Q18 (comments[2]) if structured like before
            // Or simple iteration:
            const textareas = document.querySelectorAll(CONFIG.SEL_TEXTAREA);
            textareas.forEach((ta, i) => {
                // If it's the first textarea, positive comment. If second, "None".
                if (!ta.value) ta.value = i === 0 ? comments[0] : comments[2];
            });

            return radios.length;
        },

        submitForm: () => {
            if (typeof window.goSubmitForm === 'function') {
                window.goSubmitForm();
            } else {
                const btn = document.querySelector(CONFIG.SEL_SUBMIT);
                if (btn) btn.click();
            }
        },

        clickBack: () => {
            const link = document.querySelector(CONFIG.SEL_BACK_LINK);
            if (link) link.click();
            else window.history.go(-1);
        }
    };

    /**
     * ======================================
     * LOGIC CONTROLLERS
     * ======================================
     */
    const Controllers = {
        onListPage: async () => {
            // Only show UI if idle or running
            if (!Utils.State.isRunning()) {
                UI.init();
                UI.renderIdle();
                return;
            } else {
                UI.init();
            }

            let queue = Utils.State.getQueue();

            // Initial Scan
            if (queue.length === 0) {
                UI.renderRunning(0, "正在扫描课程...");
                queue = Actions.scanCourses();
                Utils.State.setQueue(queue);
                Utils.log(`扫描到 ${queue.length} 门未评课程`);
            }

            UI.renderRunning(queue.length, "准备评价下一门...");

            if (queue.length > 0) {
                const nextUrl = queue.shift();
                Utils.State.setQueue(queue);
                Utils.State.setStatus('IDLE');

                Utils.log("3秒后跳转...");
                await Utils.sleep(CONFIG.DELAY_LIST_JUMP);
                window.location.href = nextUrl;
            } else {
                // Done or Empty
                Utils.State.reset();

                // Try to find the "View Grades" link/button
                // Usually it's "我已完成全部评价，现在查看成绩" or similar on the list page
                // Selector based on value attribute of input button
                const finishBtn = document.querySelector('input[value*="我已完成全部评价"], input[value*="查看成绩"]');

                if (finishBtn) {
                    // alert("🎉 全部完成！即将跳转查看成绩..."); // Optional: Remove alert for full automation
                    finishBtn.click();
                } else {
                    alert("🎉 全部完成！(未找到自动跳转按钮，请手动查看成绩)");
                    location.reload();
                }
            }
        },

        onDetailPage: async () => {
            // Only show UI if idle or running
            if (!Utils.State.isRunning()) {
                UI.init();
                UI.renderIdle();
                return;
            } else {
                UI.init(); // Show running state
            }

            const queue = Utils.State.getQueue();
            const status = Utils.State.getStatus();
            UI.renderRunning(queue.length, `填写中 [${status}]`);

            // Phase 1: Fail it
            if (status === 'IDLE' || status === 'ATTEMPT_1') {
                Utils.log("第一次提交 (尝试诱发错误)...");
                Utils.State.setStatus('ATTEMPT_1');

                Actions.fillForm();
                await Utils.sleep(CONFIG.DELAY_SUBMIT_FAST);
                Actions.submitForm();
            }
            // Phase 2: Retry it
            else if (status === 'RETRY') {
                Utils.log("检测到返回，第二次提交...");
                Actions.fillForm();
                await Utils.sleep(CONFIG.DELAY_SUBMIT_FAST);
                Actions.submitForm();
            }
        },

        onErrorPage: async () => {
            // Error page logic only relevant if we are Running
            if (!Utils.State.isRunning()) return;

            UI.init(); // Show UI on error page too if running

            const status = Utils.State.getStatus();

            if (status === 'ATTEMPT_1') {
                UI.renderRunning(Utils.State.getQueue().length, "⚠️ 捕获错误页");
                Utils.log("成功触发限制，正在返回...");

                Utils.State.setStatus('RETRY');

                await Utils.sleep(CONFIG.DELAY_BACK_CLICK);
                Actions.clickBack();
            } else {
                Utils.log("未知错误状态，停止运行");
                Utils.State.setRunning('false');
            }
        }
    };

    /**
     * ======================================
     * MAIN ROUTER
     * ======================================
     */
    function main() {
        // Strict Page Routing
        if (Utils.PageType.isError()) {
            Controllers.onErrorPage();
        } else if (Utils.PageType.isDetail()) {
            Controllers.onDetailPage();
        } else if (Utils.PageType.isList()) {
            Controllers.onListPage();
        }
    }

    main();

})();
