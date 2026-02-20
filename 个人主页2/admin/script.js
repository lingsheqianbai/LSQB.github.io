/**
 * 小狐务器 - 管理后台交互逻辑
 */
(function () {
    'use strict';

    const API = 'api.php';

    // ========== CSRF Token ==========

    var csrfToken = '';
    var csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) csrfToken = csrfMeta.getAttribute('content') || '';

    // ========== 工具函数 ==========

    function toast(msg, type) {
        type = type || 'success';
        var container = document.getElementById('toastContainer');
        var el = document.createElement('div');
        el.className = 'toast ' + type;
        el.textContent = msg;
        container.appendChild(el);
        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
        }, 3200);
    }

    function api(action, data, method) {
        method = method || 'POST';
        var opts = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            }
        };
        if (method !== 'GET' && data) {
            opts.body = JSON.stringify(data);
        }
        var url = API + '?action=' + encodeURIComponent(action);
        return fetch(url, opts)
            .then(function (r) { return r.json(); })
            .catch(function () {
                return { success: false, message: '网络请求失败' };
            });
    }

    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }

    (function tamperCheck() {
        var state = window.__TAMPER_STATE__ || {};
        var overlay = document.getElementById('tamperOverlay');
        var countdownEl = document.getElementById('tamperCountdown');

        function showLock(deadlineTs, serverTs) {
            if (!overlay) return;
            overlay.style.display = 'flex';
            // 计算服务器时间与本地时间的偏移
            var offset = (serverTs * 1000) - Date.now();
            function tick() {
                var serverNow = Date.now() + offset;
                var remaining = Math.max(0, (deadlineTs * 1000) - serverNow);
                var mins = Math.floor(remaining / 60000);
                var secs = Math.floor((remaining % 60000) / 1000);
                if (countdownEl) {
                    countdownEl.textContent = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
                }
                if (remaining <= 0) {
                    if (countdownEl) countdownEl.textContent = '00:00';
                    // 触发后端跑路检测
                    fetch(API + '?action=check_ad_tamper')
                        .then(function () { location.reload(); })
                        .catch(function () { location.reload(); });
                    return;
                }
                setTimeout(tick, 1000);
            }
            tick();
        }

        // 先用服务端预检状态（防止 JS 被篡改也能锁定）
        if (state.locked && state.deadline_ts) {
            showLock(state.deadline_ts, state.server_ts);
        }

        // 再异步调用 API 做实时检测
        fetch(API + '?action=check_ad_tamper')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.tampered && !data.nuked) {
                    showLock(data.deadline_ts, data.server_ts);
                } else if (data.nuked) {
                    location.reload();
                }
            })
            .catch(function () {});
    })();

    // ========== 标签页切换 ==========

    var navItems = $$('.nav-item');
    var tabPanels = $$('.tab-panel');

    navItems.forEach(function (item) {
        item.addEventListener('click', function () {
            var tab = this.getAttribute('data-tab');
            if (!tab) return;

            navItems.forEach(function (n) { n.classList.remove('active'); });
            tabPanels.forEach(function (p) { p.classList.remove('active'); });

            this.classList.add('active');
            var panel = document.getElementById('tab-' + tab);
            if (panel) panel.classList.add('active');

            // 切换到消息时加载
            if (tab === 'messages') loadMessages();
            // 切换到 SMTP 时加载
            if (tab === 'smtp') loadSmtp();
        });
    });

    // ========== 站点设置 ==========

    var siteForm = document.getElementById('siteForm');
    if (siteForm) {
        siteForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var data = {
                title_prefix: siteForm.querySelector('[name="title_prefix"]').value,
                title: siteForm.querySelector('[name="title"]').value,
                subtitle_prefix: siteForm.querySelector('[name="subtitle_prefix"]').value,
                subtitle_name: siteForm.querySelector('[name="subtitle_name"]').value,
                pixel_text: siteForm.querySelector('[name="pixel_text"]').value
            };
            if (data.pixel_text && data.pixel_text.length > 4) {
                toast('像素横幅文字最多 4 个字', 'error');
                return;
            }
            api('save_content', { data: data }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 背景设置 ==========

    var bgModeOptions = $$('.bg-mode-option');
    var bgImageSection = document.getElementById('bgImageSection');
    var bgFile = document.getElementById('bgFile');
    var bgThumbImg = document.getElementById('bgThumbImg');
    var bgThumbEmpty = document.getElementById('bgThumbEmpty');
    var deleteBgBtn = document.getElementById('deleteBgBtn');
    var bgBlurRange = document.getElementById('bgBlurRange');
    var bgOpacityRange = document.getElementById('bgOpacityRange');
    var blurValue = document.getElementById('blurValue');
    var opacityValue = document.getElementById('opacityValue');
    var saveBgBtn = document.getElementById('saveBgBtn');
    var bgModeImageThumb = document.getElementById('bgModeImageThumb');
    var currentBgMode = 'default';

    function setBgMode(mode) {
        currentBgMode = mode;
        bgModeOptions.forEach(function (opt) {
            opt.classList.toggle('active', opt.getAttribute('data-mode') === mode);
        });
        if (bgImageSection) {
            bgImageSection.style.display = mode === 'image' ? '' : 'none';
        }
    }

    function showBgThumb(url) {
        if (url) {
            bgThumbImg.src = url;
            bgThumbImg.style.display = '';
            bgThumbEmpty.style.display = 'none';
            deleteBgBtn.style.display = '';
            if (bgModeImageThumb) bgModeImageThumb.style.backgroundImage = 'url(' + url + ')';
        } else {
            bgThumbImg.style.display = 'none';
            bgThumbImg.src = '';
            bgThumbEmpty.style.display = '';
            deleteBgBtn.style.display = 'none';
            if (bgModeImageThumb) bgModeImageThumb.style.backgroundImage = '';
        }
    }

    // 加载背景设置
    function loadBgSettings() {
        api('get_content', null, 'GET').then(function (r) {
            if (!r.success || !r.data) return;
            var d = r.data;
            setBgMode(d.bg_mode || 'default');
            if (bgBlurRange) { bgBlurRange.value = d.bg_blur ?? 6; blurValue.textContent = bgBlurRange.value; }
            if (bgOpacityRange) { bgOpacityRange.value = d.bg_opacity ?? 70; opacityValue.textContent = bgOpacityRange.value; }
            if (d.bg_image) {
                showBgThumb('../' + d.bg_image);
            }
        });
    }
    loadBgSettings();

    // 模式切换
    bgModeOptions.forEach(function (opt) {
        opt.addEventListener('click', function () {
            setBgMode(this.getAttribute('data-mode'));
        });
    });

    // 滑条实时数值
    if (bgBlurRange) {
        bgBlurRange.addEventListener('input', function () { blurValue.textContent = this.value; });
    }
    if (bgOpacityRange) {
        bgOpacityRange.addEventListener('input', function () { opacityValue.textContent = this.value; });
    }

    // 上传背景图
    if (bgFile) {
        bgFile.addEventListener('change', function () {
            var file = this.files[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) { toast('图片不能超过 10MB', 'error'); return; }

            var formData = new FormData();
            formData.append('bg', file);
            fetch('api.php?action=upload_bg', { method: 'POST', body: formData, headers: { 'X-CSRF-Token': csrfToken } })
                .then(function (r) { return r.json(); })
                .then(function (r) {
                    toast(r.message, r.success ? 'success' : 'error');
                    if (r.success && r.url) {
                        showBgThumb(r.url);
                        setBgMode('image');
                    }
                    bgFile.value = '';
                })
                .catch(function () { toast('上传失败', 'error'); });
        });
    }

    // 删除背景图
    if (deleteBgBtn) {
        deleteBgBtn.addEventListener('click', function () {
            if (!confirm('确认删除背景图？')) return;
            api('delete_bg', {}).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) {
                    showBgThumb('');
                    setBgMode('default');
                }
            });
        });
    }

    // 保存背景设置
    if (saveBgBtn) {
        saveBgBtn.addEventListener('click', function () {
            var data = {
                bg_mode: currentBgMode,
                bg_blur: parseInt(bgBlurRange.value, 10),
                bg_opacity: parseInt(bgOpacityRange.value, 10)
            };
            api('save_content', { data: data }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 渐变色设置 ==========

    var gradientColorsEl = document.getElementById('gradientColors');
    var addColorBtn = document.getElementById('addColorBtn');
    var resetColorsBtn = document.getElementById('resetColorsBtn');
    var gradientPreview = document.getElementById('gradientPreviewText');
    var gradientAnimateToggle = document.getElementById('gradientAnimateToggle');
    var saveGradientBtn = document.getElementById('saveGradientBtn');
    var gradientPresetsEl = document.getElementById('gradientPresets');

    var defaultColors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#9b59b6'];
    var currentColors = defaultColors.slice();

    function updateGradientPreview() {
        if (!gradientPreview) return;
        var colors = currentColors.join(', ');
        var grad = 'linear-gradient(135deg, ' + colors + ')';
        gradientPreview.style.background = grad;
        gradientPreview.style.webkitBackgroundClip = 'text';
        gradientPreview.style.webkitTextFillColor = 'transparent';
        gradientPreview.style.backgroundClip = 'text';
        if (gradientAnimateToggle && gradientAnimateToggle.checked) {
            gradientPreview.style.backgroundSize = '200% 200%';
            gradientPreview.style.animation = 'gradShift 4s ease infinite';
        } else {
            gradientPreview.style.backgroundSize = '100% 100%';
            gradientPreview.style.animation = 'none';
        }
    }

    function renderColorSwatches() {
        if (!gradientColorsEl) return;
        gradientColorsEl.innerHTML = '';
        currentColors.forEach(function (color, i) {
            var item = document.createElement('div');
            item.className = 'gradient-color-item';
            item.innerHTML =
                '<div class="gradient-color-swatch" style="background:' + color + '">' +
                '  <input type="color" value="' + color + '" data-index="' + i + '">' +
                '</div>' +
                '<button type="button" class="gradient-color-remove" data-index="' + i + '">&times;</button>';

            // 颜色选择
            item.querySelector('input[type="color"]').addEventListener('input', function () {
                currentColors[this.getAttribute('data-index')] = this.value;
                this.parentElement.style.background = this.value;
                updateGradientPreview();
            });

            // 删除按钮
            item.querySelector('.gradient-color-remove').addEventListener('click', function () {
                if (currentColors.length <= 2) { toast('至少保留 2 个颜色', 'error'); return; }
                currentColors.splice(parseInt(this.getAttribute('data-index')), 1);
                renderColorSwatches();
                updateGradientPreview();
            });

            gradientColorsEl.appendChild(item);
        });
    }

    // 加载渐变设置
    function loadGradientSettings() {
        api('get_content', null, 'GET').then(function (r) {
            if (!r.success || !r.data) return;
            var d = r.data;
            if (d.gradient_colors && d.gradient_colors.length >= 2) {
                currentColors = d.gradient_colors.slice();
            }
            if (gradientAnimateToggle) {
                gradientAnimateToggle.checked = d.gradient_animate !== false;
            }
            if (gradientPreview && d.title) {
                gradientPreview.textContent = d.title;
            }
            renderColorSwatches();
            updateGradientPreview();
        });
    }
    loadGradientSettings();

    if (addColorBtn) {
        addColorBtn.addEventListener('click', function () {
            if (currentColors.length >= 10) { toast('最多 10 个颜色', 'error'); return; }
            // 随机 hex 颜色
            var hex = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
            currentColors.push(hex);
            renderColorSwatches();
            updateGradientPreview();
        });
    }

    if (resetColorsBtn) {
        resetColorsBtn.addEventListener('click', function () {
            currentColors = defaultColors.slice();
            renderColorSwatches();
            updateGradientPreview();
        });
    }

    // 预设点击
    if (gradientPresetsEl) {
        gradientPresetsEl.querySelectorAll('.gradient-preset').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var colorsStr = this.getAttribute('data-colors');
                currentColors = colorsStr.split(',');
                renderColorSwatches();
                updateGradientPreview();
            });
        });
    }

    // 动画开关
    if (gradientAnimateToggle) {
        gradientAnimateToggle.addEventListener('change', updateGradientPreview);
    }

    // 保存渐变
    if (saveGradientBtn) {
        saveGradientBtn.addEventListener('click', function () {
            if (currentColors.length < 2) { toast('至少需要 2 个颜色', 'error'); return; }

            // 确保所有颜色都是 hex 格式
            var hexColors = currentColors.map(function (c) {
                if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
                // 用 canvas 转换非 hex 颜色
                var cvs = document.createElement('canvas');
                cvs.width = 1; cvs.height = 1;
                var cx = cvs.getContext('2d');
                cx.fillStyle = c;
                cx.fillRect(0, 0, 1, 1);
                var px = cx.getImageData(0, 0, 1, 1).data;
                return '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
            });

            api('save_content', {
                data: {
                    gradient_colors: hexColors,
                    gradient_animate: gradientAnimateToggle ? gradientAnimateToggle.checked : true
                }
            }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 个人简介 ==========

    var introForm = document.getElementById('introForm');
    if (introForm) {
        introForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var data = {
                intro: introForm.querySelector('[name="intro"]').value
            };
            api('save_content', { data: data }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 技能管理 ==========

    var skillsList = document.getElementById('skillsList');
    var newSkillInput = document.getElementById('newSkill');
    var addSkillBtn = document.getElementById('addSkillBtn');
    var saveSkillsBtn = document.getElementById('saveSkillsBtn');

    function createSkillItem(text) {
        var div = document.createElement('div');
        div.className = 'skill-item';
        div.innerHTML = '<span class="skill-text">' + escHtml(text) + '</span>' +
            '<button type="button" class="skill-remove" title="删除">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
            '</button>';
        div.querySelector('.skill-remove').addEventListener('click', function () {
            div.remove();
        });
        return div;
    }

    function escHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // 给已有的技能项绑定删除
    if (skillsList) {
        skillsList.querySelectorAll('.skill-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                btn.closest('.skill-item').remove();
            });
        });
    }

    if (addSkillBtn) {
        addSkillBtn.addEventListener('click', function () {
            var val = newSkillInput.value.trim();
            if (!val) return;
            skillsList.appendChild(createSkillItem(val));
            newSkillInput.value = '';
            newSkillInput.focus();
        });
    }

    if (newSkillInput) {
        newSkillInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSkillBtn.click();
            }
        });
    }

    if (saveSkillsBtn) {
        saveSkillsBtn.addEventListener('click', function () {
            var skills = [];
            skillsList.querySelectorAll('.skill-text').forEach(function (el) {
                var t = el.textContent.trim();
                if (t) skills.push(t);
            });
            api('save_content', { data: { skills: skills } }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 项目管理 ==========

    var projectsEditor = document.getElementById('projectsEditor');
    var addProjectBtn = document.getElementById('addProjectBtn');
    var saveProjectsBtn = document.getElementById('saveProjectsBtn');

    var iconOptions = [
        { value: 'globe', label: '地球' },
        { value: 'code', label: '代码' },
        { value: 'layout', label: '布局' },
        { value: 'sparkle', label: '星光' },
        { value: 'server', label: '服务器' },
        { value: 'palette', label: '调色板' },
        { value: 'terminal', label: '终端' },
        { value: 'book', label: '书本' }
    ];

    function createProjectCard(proj, index) {
        var div = document.createElement('div');
        div.className = 'project-edit-card';
        div.setAttribute('data-index', index);

        var optionsHtml = iconOptions.map(function (opt) {
            var sel = (proj && proj.icon === opt.value) ? ' selected' : '';
            return '<option value="' + opt.value + '"' + sel + '>' + opt.label + '</option>';
        }).join('');

        div.innerHTML =
            '<div class="project-edit-header">' +
            '  <span class="project-edit-num">#' + (index + 1) + '</span>' +
            '  <button type="button" class="btn-icon project-remove" title="删除项目">' +
            '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
            '  </button>' +
            '</div>' +
            '<div class="form-grid">' +
            '  <div class="form-group">' +
            '    <label>项目名称</label>' +
            '    <input type="text" name="proj_title" value="' + escHtml((proj && proj.title) || '') + '">' +
            '  </div>' +
            '  <div class="form-group">' +
            '    <label>图标类型</label>' +
            '    <select name="proj_icon">' + optionsHtml + '</select>' +
            '  </div>' +
            '</div>' +
            '<div class="form-group">' +
            '  <label>项目描述</label>' +
            '  <input type="text" name="proj_desc" value="' + escHtml((proj && proj.desc) || '') + '">' +
            '</div>';

        div.querySelector('.project-remove').addEventListener('click', function () {
            div.remove();
            renumberProjects();
        });

        return div;
    }

    function renumberProjects() {
        projectsEditor.querySelectorAll('.project-edit-card').forEach(function (card, i) {
            card.setAttribute('data-index', i);
            card.querySelector('.project-edit-num').textContent = '#' + (i + 1);
        });
    }

    // 绑定已有项目的删除按钮
    if (projectsEditor) {
        projectsEditor.querySelectorAll('.project-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                btn.closest('.project-edit-card').remove();
                renumberProjects();
            });
        });
    }

    if (addProjectBtn) {
        addProjectBtn.addEventListener('click', function () {
            var count = projectsEditor.querySelectorAll('.project-edit-card').length;
            var card = createProjectCard(null, count);
            projectsEditor.appendChild(card);
        });
    }

    if (saveProjectsBtn) {
        saveProjectsBtn.addEventListener('click', function () {
            var projects = [];
            projectsEditor.querySelectorAll('.project-edit-card').forEach(function (card) {
                projects.push({
                    title: card.querySelector('[name="proj_title"]').value.trim(),
                    desc: card.querySelector('[name="proj_desc"]').value.trim(),
                    icon: card.querySelector('[name="proj_icon"]').value
                });
            });
            api('save_content', { data: { projects: projects } }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== 联系方式 ==========

    var contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var data = {
                contact: {
                    email: contactForm.querySelector('[name="email"]').value,
                    wechat: contactForm.querySelector('[name="wechat"]').value,
                    github: contactForm.querySelector('[name="github"]').value
                }
            };
            api('save_content', { data: data }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // ========== SMTP 设置 ==========

    var smtpForm = document.getElementById('smtpForm');
    var testSmtpBtn = document.getElementById('testSmtpBtn');

    function loadSmtp() {
        api('get_smtp', null, 'GET').then(function (r) {
            if (!r.success || !r.data) return;
            var d = r.data;
            if (smtpForm) {
                var setVal = function (name, val) {
                    var el = smtpForm.querySelector('[name="' + name + '"]');
                    if (el) el.value = val || '';
                };
                setVal('host', d.host);
                setVal('port', d.port);
                setVal('encryption', d.encryption);
                setVal('username', d.username);
                setVal('from_name', d.from_name);
                setVal('from_email', d.from_email);
                // 密码字段不回填
                var pwEl = smtpForm.querySelector('[name="password"]');
                if (pwEl) pwEl.placeholder = d.password_display ? '已设置 (' + d.password_display + ')' : '留空表示不修改';
            }
        });
    }

    if (smtpForm) {
        smtpForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var data = {
                host: smtpForm.querySelector('[name="host"]').value,
                port: smtpForm.querySelector('[name="port"]').value,
                encryption: smtpForm.querySelector('[name="encryption"]').value,
                username: smtpForm.querySelector('[name="username"]').value,
                password: smtpForm.querySelector('[name="password"]').value,
                from_name: smtpForm.querySelector('[name="from_name"]').value,
                from_email: smtpForm.querySelector('[name="from_email"]').value
            };
            api('save_smtp', { data: data }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    if (testSmtpBtn) {
        testSmtpBtn.addEventListener('click', function () {
            testSmtpBtn.disabled = true;
            testSmtpBtn.textContent = '测试中...';
            var logDiv = document.getElementById('smtpLog');
            var logPre = document.getElementById('smtpLogContent');

            api('test_smtp', {}).then(function (r) {
                testSmtpBtn.disabled = false;
                testSmtpBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>测试连接';
                toast(r.message, r.success ? 'success' : 'error');

                if (r.log && r.log.length > 0) {
                    logDiv.style.display = 'block';
                    logPre.textContent = r.log.join('\n');
                }
            });
        });
    }

    // ========== 消息免打扰 ==========

    var dndToggle = document.getElementById('dndToggle');
    var dndStatusText = document.getElementById('dndStatusText');

    function updateDndStatus(enabled) {
        if (dndStatusText) {
            dndStatusText.textContent = enabled
                ? '已开启 · 新消息不会发送邮件通知'
                : '关闭 · 新消息将发送邮件通知';
        }
        if (dndToggle) {
            // 更新图标样式
            var card = dndToggle.closest('.dnd-card');
            if (card) card.classList.toggle('dnd-active', enabled);
        }
    }

    function loadDndStatus() {
        api('get_dnd', null, 'GET').then(function (r) {
            if (!r.success) return;
            if (dndToggle) dndToggle.checked = r.enabled;
            updateDndStatus(r.enabled);
        });
    }
    loadDndStatus();

    if (dndToggle) {
        dndToggle.addEventListener('change', function () {
            var enabled = this.checked;
            updateDndStatus(enabled);
            api('toggle_dnd', { enabled: enabled }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (!r.success) {
                    // 恢复原状态
                    dndToggle.checked = !enabled;
                    updateDndStatus(!enabled);
                }
            });
        });
    }

    // ========== 消息管理 ==========

    var messagesList = document.getElementById('messagesList');
    var refreshMsgsBtn = document.getElementById('refreshMsgsBtn');
    var msgBadge = document.getElementById('msgBadge');

    function loadMessages() {
        api('get_messages', null, 'GET').then(function (r) {
            if (!r.success) return;
            renderMessages(r.data || []);
        });
    }

    function renderMessages(messages) {
        if (!messagesList) return;

        if (messages.length === 0) {
            messagesList.innerHTML =
                '<div class="messages-empty">' +
                '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>' +
                '  <p>暂无消息</p>' +
                '</div>';
            if (msgBadge) msgBadge.style.display = 'none';
            return;
        }

        var unreadCount = 0;
        var html = '';
        messages.forEach(function (msg) {
            if (!msg.read) unreadCount++;
            var statusHtml = '';
            if (msg.replied) {
                statusHtml = '<span class="msg-status replied">已回复</span>';
            }
            html +=
                '<div class="msg-card' + (msg.read ? '' : ' unread') + '" data-id="' + escHtml(msg.id) + '">' +
                '  <div class="msg-header">' +
                '    <div>' +
                '      <span class="msg-sender">' + escHtml(msg.name) + '</span> ' +
                '      <span class="msg-email">' + escHtml(msg.email) + '</span> ' +
                       statusHtml +
                '    </div>' +
                '    <span class="msg-time">' + escHtml(msg.time) + '</span>' +
                '  </div>' +
                '  <div class="msg-preview">' + escHtml(msg.message) + '</div>' +
                '  <div class="msg-body">' + escHtml(msg.message) + '</div>' +
                '  <div class="msg-actions">' +
                '    <button type="button" class="btn btn-primary btn-sm msg-reply-btn" data-email="' + escHtml(msg.email) + '" data-name="' + escHtml(msg.name) + '" data-id="' + escHtml(msg.id) + '">回复</button>' +
                '    <button type="button" class="btn btn-danger btn-sm msg-delete-btn" data-id="' + escHtml(msg.id) + '">删除</button>' +
                '  </div>' +
                '</div>';
        });

        messagesList.innerHTML = html;

        // 展开/收起
        messagesList.querySelectorAll('.msg-card').forEach(function (card) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('.msg-actions')) return;
                card.classList.toggle('expanded');
                // 标记已读
                if (card.classList.contains('unread')) {
                    card.classList.remove('unread');
                    var mid = card.getAttribute('data-id');
                    api('mark_read', { id: mid });
                }
            });
        });

        // 回复
        messagesList.querySelectorAll('.msg-reply-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                openReplyModal(btn.getAttribute('data-id'), btn.getAttribute('data-email'), btn.getAttribute('data-name'));
            });
        });

        // 删除
        messagesList.querySelectorAll('.msg-delete-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (!confirm('确认删除这条消息？')) return;
                api('delete_message', { id: btn.getAttribute('data-id') }).then(function (r) {
                    toast(r.message, r.success ? 'success' : 'error');
                    if (r.success) loadMessages();
                });
            });
        });

        // 未读徽章
        if (msgBadge) {
            if (unreadCount > 0) {
                msgBadge.textContent = unreadCount;
                msgBadge.style.display = 'flex';
            } else {
                msgBadge.style.display = 'none';
            }
        }
    }

    if (refreshMsgsBtn) {
        refreshMsgsBtn.addEventListener('click', loadMessages);
    }

    // ========== 回复弹窗 ==========

    var replyModal = document.getElementById('replyModal');
    var closeReplyModal = document.getElementById('closeReplyModal');
    var cancelReply = document.getElementById('cancelReply');
    var replyForm = document.getElementById('replyForm');

    function openReplyModal(msgId, email, name) {
        document.getElementById('replyMsgId').value = msgId;
        document.getElementById('replyTo').value = email;
        document.getElementById('replySubject').value = '回复: 来自 ' + name + ' 的留言';
        document.getElementById('replyBody').value = '';
        replyModal.classList.add('show');
    }

    function closeReply() {
        replyModal.classList.remove('show');
    }

    if (closeReplyModal) closeReplyModal.addEventListener('click', closeReply);
    if (cancelReply) cancelReply.addEventListener('click', closeReply);

    if (replyModal) {
        replyModal.addEventListener('click', function (e) {
            if (e.target === replyModal) closeReply();
        });
    }

    if (replyForm) {
        replyForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var submitBtn = replyForm.querySelector('.btn-primary');
            submitBtn.disabled = true;
            submitBtn.textContent = '发送中...';

            api('reply_message', {
                id: document.getElementById('replyMsgId').value,
                to: document.getElementById('replyTo').value,
                subject: document.getElementById('replySubject').value,
                body: document.getElementById('replyBody').value
            }).then(function (r) {
                submitBtn.disabled = false;
                submitBtn.textContent = '发送回复';
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) {
                    closeReply();
                    loadMessages();
                }
            });
        });
    }

    // ========== 修改密码 ==========

    var passwordForm = document.getElementById('passwordForm');
    if (passwordForm) {
        passwordForm.addEventListener('submit', function (e) {
            e.preventDefault();
            var newPass = passwordForm.querySelector('[name="new_password"]').value;
            var confirmPass = passwordForm.querySelector('[name="confirm_password"]').value;

            if (newPass.length < 8) {
                toast('新密码不能少于 8 位', 'error');
                return;
            }
            if (newPass !== confirmPass) {
                toast('两次输入的密码不一致', 'error');
                return;
            }

            api('change_password', {
                old_password: passwordForm.querySelector('[name="old_password"]').value,
                new_password: newPass
            }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) {
                    passwordForm.reset();
                }
            });
        });
    }

    // ========== 头像上传 ==========

    var avatarFile = document.getElementById('avatarFile');
    var avatarImg = document.getElementById('avatarImg');
    var avatarPlaceholder = document.getElementById('avatarPlaceholder');
    var deleteAvatarBtn = document.getElementById('deleteAvatarBtn');

    function showAvatar(url) {
        if (url) {
            avatarImg.src = url;
            avatarImg.style.display = 'block';
            avatarPlaceholder.style.display = 'none';
            deleteAvatarBtn.style.display = '';
        } else {
            avatarImg.style.display = 'none';
            avatarImg.src = '';
            avatarPlaceholder.style.display = '';
            deleteAvatarBtn.style.display = 'none';
        }
    }

    // 加载当前头像
    function loadAvatar() {
        api('get_avatar', null, 'GET').then(function (r) {
            if (r.success && r.url) {
                showAvatar('../' + r.url);
            }
        });
    }
    loadAvatar();

    if (avatarFile) {
        avatarFile.addEventListener('change', function () {
            var file = this.files[0];
            if (!file) return;

            if (file.size > 5 * 1024 * 1024) {
                toast('图片不能超过 5MB', 'error');
                return;
            }

            var formData = new FormData();
            formData.append('avatar', file);

            fetch('api.php?action=upload_avatar', {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRF-Token': csrfToken }
            })
            .then(function (r) { return r.json(); })
            .then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success && r.url) {
                    showAvatar(r.url);
                }
                avatarFile.value = '';
            })
            .catch(function () {
                toast('上传失败', 'error');
            });
        });
    }

    if (deleteAvatarBtn) {
        deleteAvatarBtn.addEventListener('click', function () {
            if (!confirm('确认删除头像？')) return;
            api('delete_avatar', {}).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) showAvatar('');
            });
        });
    }

    // ========== 一键跑路 ==========

    var nukeBtn = document.getElementById('nukeBtn');
    var nukeModal = document.getElementById('nukeModal');
    var closeNukeModal = document.getElementById('closeNukeModal');
    var nukeCancelBtn = document.getElementById('nukeCancelBtn');
    var nukeConfirmInput = document.getElementById('nukeConfirmInput');
    var nukePasswordInput = document.getElementById('nukePasswordInput');
    var nukeConfirmBtn = document.getElementById('nukeConfirmBtn');

    var nukeModeCards = $$('.nuke-mode-card');
    var nukeAutoSettings = document.getElementById('nukeAutoSettings');
    var nukeDaysInput = document.getElementById('nukeDaysInput');
    var saveNukeModeBtn = document.getElementById('saveNukeModeBtn');
    var nukeCancelAutoBtn = document.getElementById('nukeCancelAutoBtn');
    var nukeCountdownStatus = document.getElementById('nukeCountdownStatus');
    var nukeCountdownTime = document.getElementById('nukeCountdownTime');
    var currentNukeMode = 'manual';
    var nukeCountdownTimer = null;

    function showByeScreen(redirectUrl) {
        if (redirectUrl) {
            window.location.href = redirectUrl;
            return;
        }
        document.body.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#181c21;color:#fff;font-family:sans-serif;">' +
            '<div style="text-align:center;padding:40px;">' +
            '<div style="font-size:48px;margin-bottom:16px;">&#128075;</div>' +
            '<h1 style="font-size:28px;margin-bottom:8px;">再见！</h1>' +
            '<p style="color:rgba(255,255,255,0.5);font-size:14px;">所有文件已删除，网站已清空。</p>' +
            '</div></div>';
    }

    // --- 模式选择 ---
    function setNukeMode(mode) {
        currentNukeMode = mode;
        nukeModeCards.forEach(function (card) {
            card.classList.toggle('active', card.getAttribute('data-mode') === mode);
        });
        if (nukeAutoSettings) {
            nukeAutoSettings.style.display = mode === 'auto' ? '' : 'none';
        }
    }

    nukeModeCards.forEach(function (card) {
        card.addEventListener('click', function () {
            setNukeMode(this.getAttribute('data-mode'));
        });
    });

    // --- 倒计时显示 ---
    function startCountdownDisplay(deadlineTs) {
        if (nukeCountdownTimer) clearInterval(nukeCountdownTimer);
        if (!nukeCountdownStatus || !nukeCountdownTime) return;

        function update() {
            var now = Math.floor(Date.now() / 1000);
            var diff = deadlineTs - now;
            if (diff <= 0) {
                nukeCountdownTime.textContent = '已到期，等待触发...';
                clearInterval(nukeCountdownTimer);
                return;
            }
            var days = Math.floor(diff / 86400);
            var hours = Math.floor((diff % 86400) / 3600);
            var mins = Math.floor((diff % 3600) / 60);
            var secs = diff % 60;
            var parts = [];
            if (days > 0) parts.push(days + ' 天');
            parts.push(String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0'));
            nukeCountdownTime.textContent = parts.join(' ');
        }

        nukeCountdownStatus.style.display = 'flex';
        update();
        nukeCountdownTimer = setInterval(update, 1000);
    }

    function hideCountdown() {
        if (nukeCountdownTimer) clearInterval(nukeCountdownTimer);
        if (nukeCountdownStatus) nukeCountdownStatus.style.display = 'none';
    }

    // --- 跳转设置 ---
    var nukeRedirectToggle = document.getElementById('nukeRedirectToggle');
    var nukeRedirectSection = document.getElementById('nukeRedirectSection');
    var nukeRedirectUrl = document.getElementById('nukeRedirectUrl');
    var saveNukeRedirectBtn = document.getElementById('saveNukeRedirectBtn');

    if (nukeRedirectToggle) {
        nukeRedirectToggle.addEventListener('change', function () {
            if (nukeRedirectSection) {
                nukeRedirectSection.style.display = this.checked ? '' : 'none';
            }
        });
    }

    if (saveNukeRedirectBtn) {
        saveNukeRedirectBtn.addEventListener('click', function () {
            var enabled = nukeRedirectToggle ? nukeRedirectToggle.checked : false;
            var url = nukeRedirectUrl ? nukeRedirectUrl.value.trim() : '';
            if (enabled && !url) {
                toast('请填写跳转链接', 'error');
                return;
            }
            api('save_nuke_redirect', { enabled: enabled, url: url }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
            });
        });
    }

    // --- 加载当前模式 ---
    function loadNukeMode() {
        api('get_nuke_mode', null, 'GET').then(function (r) {
            if (!r.success || !r.data) return;
            var d = r.data;
            setNukeMode(d.mode || 'manual');
            if (nukeDaysInput && d.days) nukeDaysInput.value = d.days;
            if (d.mode === 'auto' && d.deadline_ts) {
                startCountdownDisplay(d.deadline_ts);
            } else {
                hideCountdown();
            }
            // 加载跳转设置
            if (nukeRedirectToggle) nukeRedirectToggle.checked = !!d.redirect_enabled;
            if (nukeRedirectUrl) nukeRedirectUrl.value = d.redirect_url || '';
            if (nukeRedirectSection) {
                nukeRedirectSection.style.display = d.redirect_enabled ? '' : 'none';
            }
        });
    }
    loadNukeMode();

    // --- 保存模式 ---
    if (saveNukeModeBtn) {
        saveNukeModeBtn.addEventListener('click', function () {
            var data = { mode: currentNukeMode };
            if (currentNukeMode === 'auto') {
                var days = parseInt(nukeDaysInput ? nukeDaysInput.value : 7, 10);
                if (isNaN(days) || days < 1) { toast('请输入有效天数', 'error'); return; }
                data.days = days;
            }
            api('save_nuke_mode', data).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) loadNukeMode();
            });
        });
    }

    // --- 取消自动 ---
    if (nukeCancelAutoBtn) {
        nukeCancelAutoBtn.addEventListener('click', function () {
            api('cancel_nuke_auto', {}).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success) {
                    hideCountdown();
                    setNukeMode('manual');
                }
            });
        });
    }

    // --- 手动确认弹窗 ---
    function openNukeModal() {
        if (nukeModal) {
            nukeModal.classList.add('show');
            if (nukeConfirmInput) { nukeConfirmInput.value = ''; nukeConfirmInput.focus(); }
            if (nukePasswordInput) nukePasswordInput.value = '';
            if (nukeConfirmBtn) nukeConfirmBtn.disabled = true;
        }
    }

    function closeNuke() {
        if (nukeModal) nukeModal.classList.remove('show');
        if (nukeConfirmInput) nukeConfirmInput.value = '';
        if (nukePasswordInput) nukePasswordInput.value = '';
        if (nukeConfirmBtn) nukeConfirmBtn.disabled = true;
    }

    if (nukeBtn) nukeBtn.addEventListener('click', openNukeModal);
    if (closeNukeModal) closeNukeModal.addEventListener('click', closeNuke);
    if (nukeCancelBtn) nukeCancelBtn.addEventListener('click', closeNuke);
    if (nukeModal) {
        nukeModal.addEventListener('click', function (e) { if (e.target === nukeModal) closeNuke(); });
    }

    function checkNukeReady() {
        if (!nukeConfirmBtn) return;
        var confirmOk = nukeConfirmInput && nukeConfirmInput.value.trim() === '确认删除';
        var passOk = nukePasswordInput && nukePasswordInput.value.length > 0;
        nukeConfirmBtn.disabled = !(confirmOk && passOk);
    }

    if (nukeConfirmInput) {
        nukeConfirmInput.addEventListener('input', checkNukeReady);
    }
    if (nukePasswordInput) {
        nukePasswordInput.addEventListener('input', checkNukeReady);
    }

    if (nukeConfirmBtn) {
        nukeConfirmBtn.addEventListener('click', function () {
            if (nukeConfirmInput.value.trim() !== '确认删除') return;
            var password = nukePasswordInput ? nukePasswordInput.value : '';
            if (!password) { toast('请输入当前登录密码', 'error'); return; }
            nukeConfirmBtn.disabled = true;
            nukeConfirmBtn.textContent = '正在删除...';

            api('nuke_site', { confirm: '确认删除', password: password }).then(function (r) {
                if (r.success) { showByeScreen(r.redirect_url || ''); }
                else {
                    toast(r.message || '操作失败', 'error');
                    nukeConfirmBtn.disabled = false;
                    nukeConfirmBtn.textContent = '永久删除所有文件';
                }
            }).catch(function () { showByeScreen(''); });
        });
    }

    var adBanner = document.getElementById('adBanner');
    var adCloseBtn = document.getElementById('adCloseBtn');
    var hideAdToggle = document.getElementById('hideAdToggle');

    // 临时关闭（仅当前页面，刷新后恢复显示）
    function updateLayoutHeights() {
        var header = document.querySelector('.admin-header');
        if (!header) return;
        var nav = document.querySelector('.admin-nav');
        var main = document.querySelector('.admin-main');

        // 移动端（≤900px）由 CSS 媒体查询控制，不设置内联样式
        if (window.innerWidth <= 900) {
            if (nav) { nav.style.top = ''; nav.style.height = ''; }
            if (main) { main.style.height = ''; }
            return;
        }

        var h = header.offsetHeight;
        if (nav) {
            nav.style.top = h + 'px';
            nav.style.height = 'calc(100vh - ' + h + 'px)';
        }
        if (main) {
            main.style.height = 'calc(100vh - ' + h + 'px)';
        }
    }

    // 初始化时根据 header 实际高度设置布局
    updateLayoutHeights();

    if (adCloseBtn) {
        adCloseBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (adBanner) {
                adBanner.style.transition = 'opacity 0.25s ease, max-height 0.3s ease, padding 0.3s ease';
                adBanner.style.opacity = '0';
                adBanner.style.maxHeight = '0';
                adBanner.style.padding = '0';
                adBanner.style.overflow = 'hidden';
                setTimeout(function () {
                    adBanner.style.display = 'none';
                    updateLayoutHeights();
                }, 300);
            }
        });
    }

    // 永久开关
    if (hideAdToggle) {
        hideAdToggle.addEventListener('change', function () {
            var hide = this.checked;
            api('toggle_ad', { hide: hide }).then(function (r) {
                toast(r.message, r.success ? 'success' : 'error');
                if (r.success && hide && adBanner) {
                    adBanner.style.display = 'none';
                }
            });
        });
    }

    // ========== 初始化 ==========

    // 首次加载消息计数
    api('get_messages', null, 'GET').then(function (r) {
        if (!r.success || !r.data) return;
        var unread = 0;
        r.data.forEach(function (m) { if (!m.read) unread++; });
        if (msgBadge && unread > 0) {
            msgBadge.textContent = unread;
            msgBadge.style.display = 'flex';
        }
    });

})();
